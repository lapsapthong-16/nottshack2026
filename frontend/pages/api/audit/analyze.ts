import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fetchPackageCode } from "../../../lib/audit/unpkg";
import { buildSkillManifest, loadSelectedSkills } from "../../../lib/audit/skills";
import { AuditLogger } from "../../../lib/audit/logger";
import { extractSnippets } from "../../../lib/audit/snippets";
import type {
  AuditVerdict,
  FindingRecord,
  PublicPackageVersionData,
  ScanRunRecord,
  Severity,
  SeveritySummary,
  SnippetRecord,
} from "../../../lib/shared/auditSchemas";
import {
  buildPackageVersionKey,
  emptySeveritySummary,
  normalizePackageName,
  normalizeVersion,
} from "../../../lib/shared/auditSchemas";
import {
  runAgent0SkillRouter,
  runAgent1Analyzer,
  runAgent1FinalTriage,
  runAgent2Verifier,
  runAgent2FinalVerdict,
} from "../../../lib/audit/agents";

type CollectedFinding = {
  file: string;
  severity: Severity;
  description: string;
  lineNumbers: number[];
  source: "auditor" | "verifier";
};

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function parseSeverityFromLLM(value: unknown): Severity {
  const s = (typeof value === "string" ? value : "").toLowerCase();
  if (s === "high" || s === "medium" || s === "low" || s === "none") return s;
  return "low"; // default fallback
}

function toAuditVerdict(input: string): AuditVerdict {
  const verdict = (input ?? "").toUpperCase();
  if (verdict === "SAFE") return "safe";
  if (verdict === "SUSPICIOUS" || verdict === "MALICIOUS") return "flagged";
  if (verdict === "ERROR") return "error";
  return "unknown";
}

function bumpSeverity(summary: SeveritySummary, severity: Severity): void {
  summary[severity] += 1;
}

function safeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9@._-]/g, "_");
}

function persistArtifacts(payload: {
  packageName: string;
  version: string;
  scanRun: ScanRunRecord;
  findings: FindingRecord[];
  snippets: SnippetRecord[];
}): { scanDir: string; files: Record<string, string> } {
  const key = buildPackageVersionKey(payload.packageName, payload.version);
  const baseDir = path.join(process.cwd(), "logs", "audit", "json");
  const scanDir = path.join(baseDir, payload.scanRun.scan_id);
  const packageDir = path.join(baseDir, "by-package");

  fs.mkdirSync(scanDir, { recursive: true });
  fs.mkdirSync(packageDir, { recursive: true });

  const scanRunFile = path.join(scanDir, "scan_run.json");
  const findingsFile = path.join(scanDir, "findings.json");
  const snippetsFile = path.join(scanDir, "snippets.json");
  const publicFile = path.join(scanDir, "public_package_version.json");
  const pointerFile = path.join(packageDir, `${safeName(key)}.json`);

  const publicPayload: PublicPackageVersionData = {
    key,
    scan_run: payload.scanRun,
    findings: payload.findings,
    snippets: payload.snippets,
  };

  fs.writeFileSync(scanRunFile, `${JSON.stringify(payload.scanRun, null, 2)}\n`, "utf-8");
  fs.writeFileSync(findingsFile, `${JSON.stringify(payload.findings, null, 2)}\n`, "utf-8");
  fs.writeFileSync(snippetsFile, `${JSON.stringify(payload.snippets, null, 2)}\n`, "utf-8");
  fs.writeFileSync(publicFile, `${JSON.stringify(publicPayload, null, 2)}\n`, "utf-8");
  fs.writeFileSync(
    pointerFile,
    `${JSON.stringify({ key, scan_id: payload.scanRun.scan_id, public_payload_file: publicFile }, null, 2)}\n`,
    "utf-8"
  );

  return {
    scanDir,
    files: {
      scan_run: scanRunFile,
      findings: findingsFile,
      snippets: snippetsFile,
      public_payload: publicFile,
      package_pointer: pointerFile,
    },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, version = "latest" } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: "Missing package name" });
  }

  const normalizedName = normalizePackageName(String(name));
  const requestedVersion = normalizeVersion(String(version));
  const logger = new AuditLogger(normalizedName, requestedVersion, res);

  try {
    // ── Step 1: Resolve package ──
    logger.sendEvent("phase", { label: "Resolving package" });

    // Verify the package exists on npm
    const npmRes = await fetch(`https://registry.npmjs.org/${encodeURIComponent(normalizedName)}`);
    if (!npmRes.ok) {
      logger.sendEvent("error", { message: `Package "${normalizedName}" not found on npm` });
      res.end();
      return;
    }
    const npmData = await npmRes.json();
    const resolvedVersion = requestedVersion === "latest"
      ? (npmData["dist-tags"]?.latest ?? requestedVersion)
      : requestedVersion;
    const normalizedResolvedVersion = normalizeVersion(resolvedVersion);
    const versionMetadata = npmData?.versions?.[normalizedResolvedVersion] ?? {};
    const registryTarballUrl = String(versionMetadata?.dist?.tarball ?? "");
    const tarballSha512 = String(versionMetadata?.dist?.integrity ?? "");

    logger.sendEvent("info", { label: `Resolved ${normalizedName}@${normalizedResolvedVersion}` });

    // ── Step 2: Fetch source code ──
    logger.sendEvent("phase", { label: "Scanning package structure" });

    const { chunks, chunkFileMap, fileContentMap, fetchedFiles, totalFiles } = await fetchPackageCode(normalizedName, normalizedResolvedVersion);
  const collectedFindings: CollectedFinding[] = [];


    logger.sendEvent("info", {
      label: `Found ${totalFiles} files, fetched ${fetchedFiles.length} code files`,
    });
    logger.sendEvent("filelist", {
      label: "Source files",
      files: fetchedFiles.map((f) => f.path),
    });

    // ── Step 2.5: Dynamic Skill Selection (Agent 0) ──
    logger.sendEvent("phase", { label: "🧭 Skill Router: Selecting relevant security guides..." });

    const { CopilotClient, approveAll } = await import("@github/copilot-sdk");
    const client = new CopilotClient();

    // Build manifest of all available skill files
    const { skillDir, manifest } = buildSkillManifest();
    logger.log(`Skill manifest: ${manifest.length} files available`);

    // Agent 0: Let the LLM pick which skills are relevant
    const fileListForRouter = fetchedFiles.map((f) => f.path);
    const firstChunkForRouter = chunks[0] ?? "";

    const { selectedIds, reason, usedFallback } = await runAgent0SkillRouter(
      manifest,
      fileListForRouter,
      firstChunkForRouter,
      client,
      approveAll,
      logger
    );

    logger.sendEvent("skill_selection", {
      available: manifest.length,
      selected: selectedIds,
      reason,
      usedFallback,
    });

    // Load only the selected skill files
    const securitySkill = loadSelectedSkills(skillDir, manifest, selectedIds);
    if (securitySkill) {
      logger.log(`Loaded ${selectedIds.length} selected skills (${Math.round(securitySkill.length / 1024)}KB)`);
      logger.sendEvent("info", { label: `Selected skills: ${selectedIds.join(", ")} ✓${usedFallback ? " (fallback)" : ""}` });
    } else {
      logger.log("No skill files could be loaded — using default prompts");
    }

    // ── Step 3: Copilot analysis (Agent 1) ──
    logger.sendEvent("phase", { label: "Analyzing source files with Audit Agent" });

    const allAnalyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      logger.sendEvent("info", {
        label: `Analyzing chunk ${i + 1}/${chunks.length} (${Math.round(chunk.length / 1024)}KB)...`,
      });

      const { text, parsed, error } = await runAgent1Analyzer(
        chunk,
        i,
        chunks.length,
        normalizedName,
        normalizedResolvedVersion,
        securitySkill,
        client,
        approveAll
      );

      allAnalyses.push(text);

      if (error) {
        logger.sendEvent("chunk_result", {
          chunkIndex: i,
          totalChunks: chunks.length,
          chunkFiles: chunkFileMap[i] ?? [],
          verdict: "ERROR",
          riskScore: 0,
          summary: `Analysis failed: ${error.message}`,
          findings: [],
        });
      } else if (parsed) {
        // Send each finding as a flag
        if (parsed.findings && Array.isArray(parsed.findings)) {
          for (const finding of parsed.findings) {
            const fileRaw = typeof finding.file === "string" ? finding.file : "unknown";
            const file = fileRaw.replace(/^\/?/, "").replace(/\s*\(.*?\)\s*$/, "").trim();
            const severity = parseSeverityFromLLM(finding.severity);
            const description = typeof finding.description === "string" ? finding.description : "No description provided";
            const lineNumbers = Array.isArray(finding.lineNumbers)
              ? finding.lineNumbers.filter((n: unknown) => typeof n === "number")
              : [];

            if (severity === "none" || severity === "safe") continue;

            collectedFindings.push({
              file,
              severity,
              description,
              lineNumbers,
              source: "auditor",
            });

            logger.sendEvent("flag", {
              label: "flagged",
              flag: {
                file,
                severity,
                description,
                lineNumbers,
              },
            });
          }
        }

        logger.sendEvent("chunk_result", {
          chunkIndex: i,
          totalChunks: chunks.length,
          chunkFiles: chunkFileMap[i] ?? [],
          verdict: parsed.verdict,
          riskScore: parsed.riskScore,
          summary: parsed.summary,
          findings: parsed.findings,
        });
      } else {
        logger.sendEvent("chunk_result", {
          chunkIndex: i,
          totalChunks: chunks.length,
          chunkFiles: chunkFileMap[i] ?? [],
          verdict: "UNKNOWN",
          riskScore: 5,
          summary: text.slice(0, 500),
          findings: [],
        });
      }
    }

    // ── Step 4: Final triage (Agent 1) ──
    logger.sendEvent("triage", { label: "Agent 1: Compiling initial assessment..." });

    const agent1Verdict = await runAgent1FinalTriage(
      allAnalyses,
      normalizedName,
      normalizedResolvedVersion,
      client,
      approveAll
    );
    logger.sendEvent("agent1_verdict", { agent: "Auditor Agent", ...agent1Verdict });

    // ── Step 5: VERIFIER AGENT (Agent 2) ──
    logger.sendEvent("phase", { label: "🔍 Verifier Agent: Independent review starting..." });

    const verifierAnalyses: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const analyzerResult = allAnalyses[i] ?? "No analysis available";

        logger.sendEvent("info", {
            label: `Verifier reviewing chunk ${i + 1}/${chunks.length}...`,
        });

        const { text, parsed, error } = await runAgent2Verifier(
            chunk,
            analyzerResult,
            i,
            chunks.length,
            normalizedName,
            normalizedResolvedVersion,
            securitySkill,
            client,
            approveAll
        );

        verifierAnalyses.push(text);

        if (error) {
            logger.sendEvent("verifier_chunk", {
                chunkIndex: i,
                totalChunks: chunks.length,
                independentVerdict: "ERROR",
                agreesWithAgent1: true,
                notes: `Verification failed: ${error.message}`,
            });
        } else if (parsed) {
            // Send false positives as resolved flags
            if (parsed.falsePositives && Array.isArray(parsed.falsePositives)) {
                for (const fp of parsed.falsePositives) {
                if (fp && fp.trim()) {
                    logger.sendEvent("verification", {
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
                    logger.sendEvent("verification", {
                    label: "missed_threat",
                    detail: fn,
                    });
                }
                }
            }

            // Send any new findings from verifier
            if (parsed.findings && Array.isArray(parsed.findings)) {
                for (const finding of parsed.findings) {
                const fileRaw = typeof finding.file === "string" ? finding.file : "unknown";
                const file = fileRaw.replace(/^\/?/, "").replace(/\s*\(.*?\)\s*$/, "").trim();
                const severity = parseSeverityFromLLM(finding.severity);
                const description = typeof finding.description === "string" ? finding.description : "No description provided";
                const lineNumbers = Array.isArray(finding.lineNumbers)
                  ? finding.lineNumbers.filter((n: unknown) => typeof n === "number")
                  : [];

                if (severity === "none" || severity === "safe") continue;

                collectedFindings.push({
                  file,
                  severity,
                  description,
                  lineNumbers,
                  source: "verifier",
                });

                logger.sendEvent("flag", {
                    label: "verifier_flagged",
                    flag: {
                    file,
                    severity,
                    description: `[Verifier Agent] ${description}`,
                    },
                });
                }
            }

            logger.sendEvent("verifier_chunk", {
                chunkIndex: i,
                totalChunks: chunks.length,
                independentVerdict: parsed.independentVerdict,
                agreesWithAgent1: parsed.agreesWithAgent1,
                notes: parsed.verificationNotes,
            });
        } else {
            logger.sendEvent("verifier_chunk", {
                chunkIndex: i,
                totalChunks: chunks.length,
                independentVerdict: "UNKNOWN",
                agreesWithAgent1: true,
                notes: text.slice(0, 500),
            });
        }
    }

    // ── Step 6: Verifier's final verdict ──
    logger.sendEvent("triage", { label: "Verifier Agent: Compiling verification report..." });

    const agent2Verdict = await runAgent2FinalVerdict(
        agent1Verdict,
        verifierAnalyses,
        normalizedName,
        normalizedResolvedVersion,
        client,
        approveAll
    );
    logger.sendEvent("agent2_verdict", { agent: "Verifier", ...agent2Verdict });


    // ── Step 7: Resolve final verdict (tie-break if agents disagree) ──
    const agent1V = agent1Verdict?.verdict ?? "UNKNOWN";
    const agent2V = agent2Verdict?.verdict ?? "UNKNOWN";
    const agrees = agent2Verdict?.agreesWithAgent1 !== false && agent1V === agent2V;
    const riskOrder: Record<string, number> = { SAFE: 0, SUSPICIOUS: 1, MALICIOUS: 2, UNKNOWN: 1, ERROR: 0 };

    // Deduplicate recommendations
    const getUniqueRecs = (v1: any, v2: any) => {
        const all = [...(v1?.recommendations ?? []), ...(v2?.recommendations ?? [])];
        return Array.from(new Set(all));
    };


    if (agrees) {
      // Both agents agree — use the consensus verdict
      logger.sendEvent("final_verdict", {
        verdict: agent1V,
        overallSeverity: agent1Verdict?.overallSeverity ?? "none",
        summary: `✅ Both agents agree: ${agent1Verdict?.summary ?? ""}\n\nVerifier Agent confirms: ${agent2Verdict?.summary ?? ""}`,
        recommendations: getUniqueRecs(agent1Verdict, agent2Verdict),
        consensus: true,
        agent1Verdict: agent1V,
        agent2Verdict: agent2V,
      });
    } else {
      // Agents DISAGREE — use the more cautious verdict
      logger.sendEvent("phase", { label: "⚖️ Agents disagree — resolving with tie-breaker..." });

      const moreRisky = (riskOrder[agent2V] ?? 0) >= (riskOrder[agent1V] ?? 0) ? agent2V : agent1V;

      logger.sendEvent("final_verdict", {
        verdict: moreRisky,
        overallSeverity: agent2Verdict?.overallSeverity ?? agent1Verdict?.overallSeverity ?? "none",
        summary: `⚠️ Agents disagreed: Auditor Agent says ${agent1V}, Verifier Agent says ${agent2V}. Using the more cautious assessment.\n\nAuditor Agent: ${agent1Verdict?.summary ?? ""}\n\nVerifier Agent: ${agent2Verdict?.summary ?? ""}`,
        recommendations: [
          ...getUniqueRecs(agent1Verdict, agent2Verdict),
          ...(agent2Verdict?.disagreements ?? []).map((d: string) => `[Disagreement] ${d}`),
        ],
        consensus: false,
        agent1Verdict: agent1V,
        agent2Verdict: agent2V,
      });
    }

    const finalVerdictValue = agrees ? agent1V : ((riskOrder[agent2V] ?? 0) >= (riskOrder[agent1V] ?? 0) ? agent2V : agent1V);
    const severitySummary = emptySeveritySummary();

    // ── Step 8: Deduplicate collectedFindings (Prefer Verifier if both found issues in same file/severity) ──
    const verifierFindings = collectedFindings.filter(f => f.source === "verifier");
    const auditorFindings = collectedFindings.filter(f => f.source === "auditor");
    
    // We keep all verifier findings. 
    // We only keep auditor findings if there isn't already a verifier finding for the same file and severity.
    const dedupedFindings: CollectedFinding[] = [...verifierFindings];
    for (const af of auditorFindings) {
        const alreadyFound = verifierFindings.some(vf => vf.file === af.file && vf.severity === af.severity);
        if (!alreadyFound) {
            dedupedFindings.push(af);
        }
    }

    const scanId = `scan_${Date.now()}_${sha256(`${normalizedName}@${normalizedResolvedVersion}`).slice(0, 10)}`;
    const findings: FindingRecord[] = dedupedFindings.map((item, idx) => {
      const severity = item.severity;
      bumpSeverity(severitySummary, severity);

      const findingSeed = `${scanId}|${item.source}|${item.file}|${item.description}|${idx}`;
      const snippetSeed = `${scanId}|snippet|${item.file}|${idx}`;

      // Compute line range from flagged line numbers
      const lineStart = item.lineNumbers.length > 0 ? Math.min(...item.lineNumbers) : undefined;
      const lineEnd = item.lineNumbers.length > 0 ? Math.max(...item.lineNumbers) : undefined;

      return {
        finding_id: `finding_${sha256(findingSeed).slice(0, 16)}`,
        scan_id: scanId,
        package: normalizedName,
        version: normalizedResolvedVersion,
        file: item.file,
        file_sha256: sha256(fileContentMap[item.file] ?? fileContentMap["/" + item.file] ?? item.file),
        severity,
        tags: ["automated-audit", item.source],
        line_start: lineStart,
        line_end: lineEnd,
        reasoning: item.description,
        snippet_id: `snippet_${sha256(snippetSeed).slice(0, 16)}`,
        reviewed: false,
        reviewer_notes: null,
        false_positive: null,
      };
    });

    const snippets: SnippetRecord[] = extractSnippets(
      findings,
      collectedFindings,
      fileContentMap,
      normalizedName,
      normalizedResolvedVersion,
      tarballSha512,
    );
    const scanRun: ScanRunRecord = {
      scan_id: scanId,
      package: normalizedName,
      version: normalizedResolvedVersion,
      registry_tarball_url: registryTarballUrl,
      tarball_sha512: tarballSha512,
      scanned_at: new Date().toISOString(),
      triggered_by: "api.audit.analyze",
      verdict: toAuditVerdict(finalVerdictValue),
      severity_summary: severitySummary,
      files_scanned: fetchedFiles.length,
      duration_ms: Date.now() - logger.getStartTime(),
    };

    const artifacts = persistArtifacts({
      packageName: normalizedName,
      version: normalizedResolvedVersion,
      scanRun,
      findings,
      snippets,
    });

    logger.sendEvent("artifacts", {
      label: "Persisted JSON artifacts",
      scanId,
      outputDir: artifacts.scanDir,
      files: artifacts.files,
      counts: {
        findings: findings.length,
        snippets: snippets.length,
      },
    });

    await client.stop();
    logger.log(`═══════════════════════════════════════════════════`);
    logger.log(`AUDIT COMPLETE: ${normalizedName}@${normalizedResolvedVersion}`);
    logger.log(`Total events: ${logger.getLogLinesCount()}`);
    logger.log(`Duration: ${((Date.now() - logger.getStartTime()) / 1000).toFixed(1)}s`);
    logger.log(`JSON output dir: ${artifacts.scanDir}`);
    logger.log(`═══════════════════════════════════════════════════`);
    logger.sendEvent("done", { label: "Audit complete — verified by 2 independent agents" });
  } catch (err: any) {
    logger.log(`ERROR: ${err.message ?? "Audit failed"}`);
    logger.sendEvent("error", { message: err.message ?? "Audit failed" });
  }

  logger.flushLog();
  res.end();
}
