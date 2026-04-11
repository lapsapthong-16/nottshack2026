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
    sendEvent("phase", { label: "Analyzing source files with Copilot AI" });

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

    // ── Step 4: Final triage ──
    sendEvent("triage", { label: "Compiling final assessment..." });

    // Ask Copilot for a final combined verdict
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
        const finalParsed = JSON.parse(cleaned);
        sendEvent("final_verdict", finalParsed);
      } catch {
        sendEvent("final_verdict", {
          verdict: "UNKNOWN",
          riskScore: 5,
          summary: finalContent.slice(0, 500),
          recommendations: [],
        });
      }
    } catch {
      sendEvent("final_verdict", {
        verdict: "ERROR",
        riskScore: 0,
        summary: "Failed to generate final assessment",
        recommendations: [],
      });
    }

    await client.stop();
    sendEvent("done", { label: "Audit complete" });
  } catch (err: any) {
    sendEvent("error", { message: err.message ?? "Audit failed" });
  }

  res.end();
}
