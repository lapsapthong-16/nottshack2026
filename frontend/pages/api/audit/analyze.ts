import type { NextApiRequest, NextApiResponse } from "next";

/**
 * POST /api/audit/analyze
 *
 * Body: { name: string, version?: string }
 *
 * Fetches the package source from unpkg, then uses the GitHub Copilot SDK
 * to perform a security analysis on each code chunk.
 * Streams progress via Server-Sent Events (SSE).
 */

// ── Helpers ────────────────────────────────────────────────────────

type UnpkgNode = {
  type: string;
  path: string;
  size?: number;
  files?: UnpkgNode[];
};

function extractFiles(node: UnpkgNode): UnpkgNode[] {
  let result: UnpkgNode[] = [];
  if (node.type !== "directory" && node.path) {
    result.push(node);
  }
  if (node.files && Array.isArray(node.files)) {
    for (const child of node.files) {
      result = result.concat(extractFiles(child));
    }
  }
  return result;
}

async function fetchPackageCode(name: string, version: string) {
  const metaRes = await fetch(`https://unpkg.com/${name}@${version}/?meta`);
  if (!metaRes.ok) throw new Error(`Failed to fetch package metadata from unpkg (${metaRes.status})`);

  const meta: UnpkgNode = await metaRes.json();
  const allFiles = extractFiles(meta);

  // Filter for code files and sort by importance
  const codeFiles = allFiles
    .filter(
      (f) =>
        (f.size ?? 0) < 50000 &&
        (f.path.endsWith(".js") ||
          f.path.endsWith(".ts") ||
          f.path.endsWith(".json") ||
          f.path.endsWith(".md"))
    )
    .sort((a, b) => {
      if (a.path === "/package.json") return -1;
      if (b.path === "/package.json") return 1;
      return (a.size ?? 0) - (b.size ?? 0);
    });

  const MAX_TOTAL_SIZE = 80000;
  const chunks: string[] = [];
  let currentChunk = "";
  const fetchedFiles: { path: string; size: number }[] = [];

  for (const file of codeFiles) {
    const fileSize = file.size ?? 0;
    if (currentChunk.length + fileSize > MAX_TOTAL_SIZE) {
      if (currentChunk.length > 0) chunks.push(currentChunk);
      currentChunk = "";
    }
    if (fileSize > MAX_TOTAL_SIZE) continue;

    try {
      const fileRes = await fetch(`https://unpkg.com/${name}@${version}${file.path}`);
      if (fileRes.ok) {
        const content = await fileRes.text();
        currentChunk += `\n--- FILE: ${file.path} ---\n${content}\n`;
        fetchedFiles.push({ path: file.path, size: fileSize });
      }
    } catch {
      // skip failed files
    }
  }

  if (currentChunk.length > 0) chunks.push(currentChunk);

  return {
    chunks: chunks.length > 0 ? chunks : ["No readable code files found."],
    fetchedFiles,
    totalFiles: allFiles.length,
  };
}

// ── Main handler ──────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, version = "latest" } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: "Missing package name" });
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  function sendEvent(type: string, data: any) {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  }

  try {
    // ── Step 1: Resolve package ──
    sendEvent("phase", { label: "Resolving package" });

    // Verify the package exists on npm
    const npmRes = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!npmRes.ok) {
      sendEvent("error", { message: `Package "${name}" not found on npm` });
      res.end();
      return;
    }
    const npmData = await npmRes.json();
    const resolvedVersion = version === "latest"
      ? (npmData["dist-tags"]?.latest ?? version)
      : version;

    sendEvent("info", { label: `Resolved ${name}@${resolvedVersion}` });

    // ── Step 2: Fetch source code ──
    sendEvent("phase", { label: "Scanning package structure" });

    const { chunks, fetchedFiles, totalFiles } = await fetchPackageCode(name, resolvedVersion);

    sendEvent("info", {
      label: `Found ${totalFiles} files, fetched ${fetchedFiles.length} code files`,
    });
    sendEvent("filelist", {
      label: "Source files",
      files: fetchedFiles.map((f) => f.path),
    });

    // ── Step 3: Copilot analysis ──
    sendEvent("phase", { label: "Analyzing source files with Audit Agent" });

    const { CopilotClient, approveAll } = await import("@github/copilot-sdk");
    const client = new CopilotClient();

    const allAnalyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      sendEvent("info", {
        label: `Analyzing chunk ${i + 1}/${chunks.length} (${Math.round(chunk.length / 1024)}KB)...`,
      });

      const session = await client.createSession({
        model: "gpt-5-mini",
        onPermissionRequest: approveAll,
      });

      const prompt = `You are a security auditor. Analyze the npm package "${name}" (version ${resolvedVersion}) for safety and security. I have fetched a chunk of the source code for you to review. (This is chunk ${i + 1} of ${chunks.length}).

Look through the provided files for any suspicious patterns, malicious obfuscation, auto-executing commands, data exfiltration, supply chain attack indicators, or other security concerns.

PACKAGE SOURCE CODE (CHUNK ${i + 1}/${chunks.length}):
${chunk}

Respond in this EXACT JSON format (no markdown, no code fences):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "MALICIOUS",
  "riskScore": <number 0-10>,
  "findings": [
    { "file": "<filepath>", "risk": <number 0-10>, "description": "<brief description>" }
  ],
  "summary": "<2-3 sentence overall summary for this chunk>"
}`;

      try {
        const response = await session.sendAndWait({ prompt });
        const content = response?.data?.content ?? "";
        allAnalyses.push(content);

        // Try to parse the JSON response
        try {
          // Strip any markdown code fences if present
          const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);

          // Send each finding as a flag
          if (parsed.findings && Array.isArray(parsed.findings)) {
            for (const finding of parsed.findings) {
              sendEvent("flag", {
                label: "flagged",
                flag: {
                  file: finding.file,
                  risk: finding.risk ?? 5,
                  description: finding.description,
                },
              });
            }
          }

          sendEvent("chunk_result", {
            chunkIndex: i,
            totalChunks: chunks.length,
            verdict: parsed.verdict,
            riskScore: parsed.riskScore,
            summary: parsed.summary,
            findings: parsed.findings,
          });
        } catch {
          // If JSON parsing fails, send the raw text
          sendEvent("chunk_result", {
            chunkIndex: i,
            totalChunks: chunks.length,
            verdict: "UNKNOWN",
            riskScore: 5,
            summary: content.slice(0, 500),
            findings: [],
          });
        }
      } catch (err: any) {
        sendEvent("chunk_result", {
          chunkIndex: i,
          totalChunks: chunks.length,
          verdict: "ERROR",
          riskScore: 0,
          summary: `Analysis failed: ${err.message}`,
          findings: [],
        });
      }
    }

    // ── Step 4: Final triage (Agent 1) ──
    sendEvent("triage", { label: "Agent 1: Compiling initial assessment..." });

    let agent1Verdict: any = null;

    // Ask Copilot for a final combined verdict from Agent 1
    try {
      const finalSession = await client.createSession({
        model: "gpt-5-mini",
        onPermissionRequest: approveAll,
      });

      const finalPrompt = `You previously analyzed the npm package "${name}@${resolvedVersion}" in ${chunks.length} chunks. Here are your chunk analyses:

${allAnalyses.join("\n\n---\n\n")}

Now provide a FINAL combined security assessment. Respond in this EXACT JSON format (no markdown, no code fences):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "MALICIOUS",
  "riskScore": <number 0-10>,
  "summary": "<3-5 sentence final security assessment>",
  "recommendations": ["<action item 1>", "<action item 2>"]
}`;

      const finalResponse = await finalSession.sendAndWait({ prompt: finalPrompt });
      const finalContent = finalResponse?.data?.content ?? "";

      try {
        const cleaned = finalContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
        agent1Verdict = JSON.parse(cleaned);
      } catch {
        agent1Verdict = {
          verdict: "UNKNOWN",
          riskScore: 5,
          summary: finalContent.slice(0, 500),
          recommendations: [],
        };
      }

      sendEvent("agent1_verdict", { agent: "Analyzer", ...agent1Verdict });
    } catch {
      agent1Verdict = {
        verdict: "ERROR",
        riskScore: 0,
        summary: "Agent 1 failed to generate assessment",
        recommendations: [],
      };
      sendEvent("agent1_verdict", { agent: "Analyzer", ...agent1Verdict });
    }

    // ═══════════════════════════════════════════════════════════════
    // ── Step 5: VERIFIER AGENT (Agent 2) ──
    // An independent agent that reviews the SAME source code AND
    // the first agent's findings, looking for:
    //   • False positives (overblown risks)
    //   • False negatives (missed threats)
    //   • Verdict accuracy
    // ═══════════════════════════════════════════════════════════════
    sendEvent("phase", { label: "🔍 Verifier Agent: Independent review starting..." });

    const verifierAnalyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const analyzerResult = allAnalyses[i] ?? "No analysis available";

      sendEvent("info", {
        label: `Verifier reviewing chunk ${i + 1}/${chunks.length}...`,
      });

      try {
        const verifierSession = await client.createSession({
          model: "gpt-5-mini",
          onPermissionRequest: approveAll,
        });

        const verifierPrompt = `You are an INDEPENDENT security verification agent. Your job is to double-check another agent's security analysis of the npm package "${name}" (version ${resolvedVersion}).

You must:
1. Independently analyze the source code below for security issues
2. Compare your findings against Agent 1's analysis
3. Identify any FALSE POSITIVES (things Agent 1 flagged that are actually safe)
4. Identify any FALSE NEGATIVES (real threats Agent 1 missed)
5. Confirm or challenge Agent 1's verdict

=== AGENT 1's ANALYSIS (CHUNK ${i + 1}/${chunks.length}) ===
${analyzerResult}

=== PACKAGE SOURCE CODE (CHUNK ${i + 1}/${chunks.length}) ===
${chunk}

Respond in this EXACT JSON format (no markdown, no code fences):
{
  "independentVerdict": "SAFE" | "SUSPICIOUS" | "MALICIOUS",
  "independentRiskScore": <number 0-10>,
  "agreesWithAgent1": true | false,
  "falsePositives": ["<description of incorrectly flagged items>"],
  "falseNegatives": ["<description of missed threats>"],
  "findings": [
    { "file": "<filepath>", "risk": <number 0-10>, "description": "<finding>" }
  ],
  "verificationNotes": "<2-3 sentences explaining your independent assessment and where you agree/disagree with Agent 1>"
}`;

        const verifierResponse = await verifierSession.sendAndWait({ prompt: verifierPrompt });
        const verifierContent = verifierResponse?.data?.content ?? "";
        verifierAnalyses.push(verifierContent);

        try {
          const cleaned = verifierContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
          const parsed = JSON.parse(cleaned);

          // Send false positives as resolved flags
          if (parsed.falsePositives && Array.isArray(parsed.falsePositives)) {
            for (const fp of parsed.falsePositives) {
              if (fp && fp.trim()) {
                sendEvent("verification", {
                  label: "false_positive",
                  detail: fp,
                });
              }
            }
          }

          // Send false negatives as new flags
          if (parsed.falseNegatives && Array.isArray(parsed.falseNegatives)) {
            for (const fn of parsed.falseNegatives) {
              if (fn && fn.trim()) {
                sendEvent("verification", {
                  label: "missed_threat",
                  detail: fn,
                });
              }
            }
          }

          // Send any new findings from verifier
          if (parsed.findings && Array.isArray(parsed.findings)) {
            for (const finding of parsed.findings) {
              sendEvent("flag", {
                label: "verifier_flagged",
                flag: {
                  file: finding.file,
                  risk: finding.risk ?? 5,
                  description: `[Verifier] ${finding.description}`,
                },
              });
            }
          }

          sendEvent("verifier_chunk", {
            chunkIndex: i,
            totalChunks: chunks.length,
            independentVerdict: parsed.independentVerdict,
            agreesWithAgent1: parsed.agreesWithAgent1,
            notes: parsed.verificationNotes,
          });
        } catch {
          sendEvent("verifier_chunk", {
            chunkIndex: i,
            totalChunks: chunks.length,
            independentVerdict: "UNKNOWN",
            agreesWithAgent1: true,
            notes: verifierContent.slice(0, 500),
          });
        }
      } catch (err: any) {
        sendEvent("verifier_chunk", {
          chunkIndex: i,
          totalChunks: chunks.length,
          independentVerdict: "ERROR",
          agreesWithAgent1: true,
          notes: `Verification failed: ${err.message}`,
        });
      }
    }

    // ── Step 6: Verifier's final verdict ──
    sendEvent("triage", { label: "Verifier Agent: Compiling verification report..." });

    let agent2Verdict: any = null;

    try {
      const verifierFinalSession = await client.createSession({
        model: "gpt-5-mini",
        onPermissionRequest: approveAll,
      });

      const verifierFinalPrompt = `You are the VERIFIER agent. You have independently reviewed the npm package "${name}@${resolvedVersion}" and cross-checked Agent 1's analysis.

=== AGENT 1's FINAL VERDICT ===
${JSON.stringify(agent1Verdict, null, 2)}

=== YOUR CHUNK-BY-CHUNK VERIFICATION ===
${verifierAnalyses.join("\n\n---\n\n")}

Now provide your FINAL verification report. If you disagree with Agent 1, explain why. Respond in this EXACT JSON format (no markdown, no code fences):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "MALICIOUS",
  "riskScore": <number 0-10>,
  "agreesWithAgent1": true | false,
  "confidence": <number 0-100>,
  "summary": "<3-5 sentence verification summary>",
  "disagreements": ["<point of disagreement>"],
  "recommendations": ["<action item>"]
}`;

      const verifierFinalResponse = await verifierFinalSession.sendAndWait({ prompt: verifierFinalPrompt });
      const verifierFinalContent = verifierFinalResponse?.data?.content ?? "";

      try {
        const cleaned = verifierFinalContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
        agent2Verdict = JSON.parse(cleaned);
      } catch {
        agent2Verdict = {
          verdict: "UNKNOWN",
          riskScore: 5,
          agreesWithAgent1: true,
          confidence: 50,
          summary: verifierFinalContent.slice(0, 500),
          disagreements: [],
          recommendations: [],
        };
      }

      sendEvent("agent2_verdict", { agent: "Verifier", ...agent2Verdict });
    } catch {
      agent2Verdict = {
        verdict: "ERROR",
        riskScore: 0,
        agreesWithAgent1: true,
        confidence: 0,
        summary: "Verifier agent failed",
        disagreements: [],
        recommendations: [],
      };
      sendEvent("agent2_verdict", { agent: "Verifier", ...agent2Verdict });
    }

    // ── Step 7: Resolve final verdict (tie-break if agents disagree) ──
    const agent1V = agent1Verdict?.verdict ?? "UNKNOWN";
    const agent2V = agent2Verdict?.verdict ?? "UNKNOWN";
    const agrees = agent2Verdict?.agreesWithAgent1 !== false && agent1V === agent2V;

    if (agrees) {
      // Both agents agree — use the consensus verdict
      sendEvent("final_verdict", {
        verdict: agent1V,
        riskScore: Math.round(((agent1Verdict?.riskScore ?? 0) + (agent2Verdict?.riskScore ?? 0)) / 2),
        summary: `✅ Both agents agree: ${agent1Verdict?.summary ?? ""}\n\nVerifier confirms: ${agent2Verdict?.summary ?? ""}`,
        recommendations: [
          ...(agent1Verdict?.recommendations ?? []),
          ...(agent2Verdict?.recommendations ?? []),
        ],
        consensus: true,
        agent1Verdict: agent1V,
        agent2Verdict: agent2V,
      });
    } else {
      // Agents DISAGREE — use the more cautious (higher risk) verdict
      sendEvent("phase", { label: "⚖️ Agents disagree — resolving with tie-breaker..." });

      const riskOrder: Record<string, number> = { SAFE: 0, SUSPICIOUS: 1, MALICIOUS: 2, UNKNOWN: 1, ERROR: 0 };
      const moreRisky = (riskOrder[agent2V] ?? 0) >= (riskOrder[agent1V] ?? 0) ? agent2V : agent1V;
      const higherRisk = Math.max(agent1Verdict?.riskScore ?? 0, agent2Verdict?.riskScore ?? 0);

      sendEvent("final_verdict", {
        verdict: moreRisky,
        riskScore: higherRisk,
        summary: `⚠️ Agents disagreed: Agent 1 says ${agent1V} (risk ${agent1Verdict?.riskScore ?? "?"}), Verifier says ${agent2V} (risk ${agent2Verdict?.riskScore ?? "?"}). Using the more cautious assessment.\n\nAgent 1: ${agent1Verdict?.summary ?? ""}\n\nVerifier: ${agent2Verdict?.summary ?? ""}`,
        recommendations: [
          ...(agent1Verdict?.recommendations ?? []),
          ...(agent2Verdict?.recommendations ?? []),
          ...(agent2Verdict?.disagreements ?? []).map((d: string) => `[Disagreement] ${d}`),
        ],
        consensus: false,
        agent1Verdict: agent1V,
        agent2Verdict: agent2V,
      });
    }

    await client.stop();
    sendEvent("done", { label: "Audit complete — verified by 2 independent agents" });
  } catch (err: any) {
    sendEvent("error", { message: err.message ?? "Audit failed" });
  }

  res.end();
}

