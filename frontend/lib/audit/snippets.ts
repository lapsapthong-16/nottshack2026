import crypto from "crypto";
import type { SnippetRecord } from "../shared/auditSchemas";
import { SNIPPET_EXTRACTION_RULES } from "../shared/auditSchemas";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function toBase64(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64");
}

function isMinified(content: string): boolean {
  const lines = content.split("\n");
  // If fewer than 3 lines and any line > 500 chars, consider it minified
  return lines.length < 3 && lines.some((l) => l.length > 500);
}

type CollectedFinding = {
  file: string;
  severity: string;
  description: string;
  lineNumbers: number[];
  source: "auditor" | "verifier";
};

/**
 * Extracts code snippets as forensic evidence for each finding.
 * Snippets are stored as base64 blobs — evidence, not runnable code.
 */
export function extractSnippets(
  findings: { snippet_id: string; file: string; finding_id: string }[],
  collectedFindings: CollectedFinding[],
  fileContentMap: Record<string, string>,
  packageName: string,
  version: string,
  tarballSha512: string,
): SnippetRecord[] {
  const snippets: SnippetRecord[] = [];
  const { contextLinesBefore, contextLinesAfter, hardCapLines } = SNIPPET_EXTRACTION_RULES;

  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i];
    const collected = collectedFindings[i];
    if (!collected) continue;

    // Normalize the file path — try with and without leading /
    const content =
      fileContentMap[collected.file] ??
      fileContentMap["/" + collected.file] ??
      fileContentMap[collected.file.replace(/^\//, "")] ??
      null;

    if (!content) continue;

    const fileSha256 = sha256(content);
    const minified = isMinified(content);
    const lines = content.split("\n");
    const flaggedLines = collected.lineNumbers;

    if (minified) {
      // For minified files, use character range
      // Pick the region around the first flagged line (or start of file)
      const charStart = 0;
      const charEnd = Math.min(content.length, 2000); // First 2000 chars
      const rawSnippet = content.slice(charStart, charEnd);

      snippets.push({
        snippet_id: finding.snippet_id,
        package: packageName,
        version,
        file: collected.file,
        file_sha256: fileSha256,
        tarball_sha512: tarballSha512,
        char_start: charStart,
        char_end: charEnd,
        snippet_raw: toBase64(rawSnippet),
        snippet_decoded: toBase64(rawSnippet), // same for non-obfuscated
        was_minified: true,
        was_obfuscated: false,
        decoded_payloads: [],
      });
    } else {
      // For normal files, use line range
      let lineStart: number;
      let lineEnd: number;

      if (flaggedLines.length > 0) {
        const minLine = Math.min(...flaggedLines);
        const maxLine = Math.max(...flaggedLines);
        lineStart = Math.max(1, minLine - contextLinesBefore);
        lineEnd = Math.min(lines.length, maxLine + contextLinesAfter);
      } else {
        // No specific lines flagged — take the first portion of the file
        lineStart = 1;
        lineEnd = Math.min(lines.length, hardCapLines);
      }

      // Enforce hard cap
      if (lineEnd - lineStart + 1 > hardCapLines) {
        lineEnd = lineStart + hardCapLines - 1;
      }

      const snippetLines = lines.slice(lineStart - 1, lineEnd);
      const rawSnippet = snippetLines.join("\n");

      snippets.push({
        snippet_id: finding.snippet_id,
        package: packageName,
        version,
        file: collected.file,
        file_sha256: fileSha256,
        tarball_sha512: tarballSha512,
        line_start: lineStart,
        line_end: lineEnd,
        snippet_raw: toBase64(rawSnippet),
        snippet_decoded: toBase64(rawSnippet),
        was_minified: false,
        was_obfuscated: false,
        decoded_payloads: [],
      });
    }
  }

  return snippets;
}
