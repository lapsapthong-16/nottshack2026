import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import type {
  PublicPackageVersionData,
  FindingRecord,
  SnippetRecord,
  SeveritySummary,
} from "@/lib/shared/auditSchemas";

// ─── Helpers ───────────────────────────────────────────────

function severityColor(sev: string): string {
  switch (sev) {
    case "high":     return "bg-[#e85c5c] text-white";
    case "medium":   return "bg-[#e8a85c] text-white";
    case "low":      return "bg-[#e8d85c] text-[#1a1a1a]";
    default:         return "bg-[#d6d0c8] text-[#6b6b6b]";
  }
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "safe":    return "text-[#2d7a2d]";
    case "flagged": return "text-[#e85c5c]";
    case "error":   return "text-[#e8a85c]";
    default:        return "text-[#8a8580]";
  }
}

function verdictIcon(verdict: string): string {
  switch (verdict) {
    case "safe":    return "✓";
    case "flagged": return "⚠";
    case "error":   return "✕";
    default:        return "?";
  }
}

function decodeBase64(b64: string): string {
  try {
    return Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    // Fallback for browser
    try { return atob(b64); } catch { return "[decode error]"; }
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

// ─── Subcomponents ─────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityColor(severity)}`}
    >
      {severity}
    </span>
  );
}

function SeverityBar({ summary }: { summary: SeveritySummary }) {
  const total = summary.high + summary.medium + summary.low + summary.none;
  if (total === 0) return <span className="text-xs text-[#a8a09a]">No findings</span>;

  const segments = [
    { key: "high",     count: summary.high,     color: "#e85c5c" },
    { key: "medium",   count: summary.medium,   color: "#e8a85c" },
    { key: "low",      count: summary.low,      color: "#e8d85c" },
    { key: "none",     count: summary.none,      color: "#d6d0c8" },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[#e8e4df]">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
              title={`${s.key}: ${s.count}`}
            />
          ) : null
        )}
      </div>
      <span className="text-xs text-[#8a8580]">{total}</span>
    </div>
  );
}

function SnippetViewer({ snippet, flaggedLineStart, flaggedLineEnd }: {
  snippet: SnippetRecord;
  flaggedLineStart?: number;
  flaggedLineEnd?: number;
}) {
  const decoded = decodeBase64(snippet.snippet_decoded || snippet.snippet_raw);
  const lines = decoded.split("\n");
  const lineStart = snippet.line_start ?? 1;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#e0dbd4] bg-[#faf8f5]">
      <div className="flex items-center gap-2 border-b border-[#e0dbd4] bg-[#f7f3ee] px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">
          Evidence Snippet
        </span>
        <span className="text-[10px] text-[#a8a09a]">
          {snippet.file} • L{snippet.line_start ?? snippet.char_start}–
          {snippet.line_end ?? snippet.char_end}
        </span>
        {flaggedLineStart !== undefined && (
          <span className="rounded-full bg-[#e85c5c] px-1.5 py-0.5 text-[9px] font-bold text-white">
            ISSUE L{flaggedLineStart}{flaggedLineEnd && flaggedLineEnd !== flaggedLineStart ? `–${flaggedLineEnd}` : ""}
          </span>
        )}
        {snippet.was_minified && (
          <span className="rounded-full bg-[#e8d85c] px-1.5 py-0.5 text-[9px] font-bold text-[#1a1a1a]">
            MINIFIED
          </span>
        )}
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          const lineNum = lineStart + idx;
          const isFlagged =
            flaggedLineStart !== undefined &&
            flaggedLineEnd !== undefined &&
            lineNum >= flaggedLineStart &&
            lineNum <= flaggedLineEnd;

          return (
            <div
              key={idx}
              className={`flex ${isFlagged ? "bg-[#e85c5c18] border-l-2 border-[#e85c5c] -ml-1 pl-1" : ""}`}
            >
              <span className={`mr-3 inline-block w-8 select-none text-right ${isFlagged ? "text-[#e85c5c] font-bold" : "text-[#c5c0b8]"}`}>
                {lineNum}
              </span>
              <span className={isFlagged ? "text-[#1a1a1a] font-medium" : "text-[#3a3a3a]"}>{line}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function ScanDetail() {
  const router = useRouter();
  const { scanId } = router.query;

  const [data, setData] = useState<PublicPackageVersionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [locked, setLocked] = useState<{ scanId: string } | null>(null);

  useEffect(() => {
    if (!scanId || typeof scanId !== "string") return;

    fetch(`/api/audit/scan?id=${encodeURIComponent(scanId)}`)
      .then(async (r) => {
        const payload = await r.json();
        if (r.status === 402) {
          setLocked({ scanId: payload.scanId ?? scanId });
          setLoading(false);
          return null;
        }
        if (!r.ok) throw new Error(payload.error || `Scan not found (${r.status})`);
        return payload;
      })
      .then((d: PublicPackageVersionData | null) => {
        if (!d) return;
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [scanId]);

  // Group findings by normalized file path
  const findingsByFile = useMemo(() => {
    if (!data?.findings) return {};
    const map: Record<string, FindingRecord[]> = {};
    for (const f of data.findings) {
      // Normalize: strip leading slash, remove parenthetical labels like "(helpers)"
      const key = f.file
        .replace(/^\/?/, "")            // strip leading /
        .replace(/\s*\(.*?\)\s*$/, "")  // strip trailing (...)
        .trim();
      if (!map[key]) map[key] = [];
      map[key].push(f);
    }
    return map;
  }, [data]);

  // Map snippet_id → SnippetRecord
  const snippetMap = useMemo(() => {
    if (!data?.snippets) return {};
    const map: Record<string, SnippetRecord> = {};
    for (const s of data.snippets) {
      map[s.snippet_id] = s;
    }
    return map;
  }, [data]);

  // List of unique files with findings
  const fileList = useMemo(() => {
    return Object.keys(findingsByFile).sort();
  }, [findingsByFile]);

  // Which findings to show
  const activeFindings = selectedFile ? (findingsByFile[selectedFile] ?? []) : data?.findings ?? [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0ebe4]">
        <div className="text-sm text-[#8a8580]">Loading scan data…</div>
      </div>
    );
  }

  if (error || !data) {
    if (locked) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f0ebe4] px-6">
          <div className="max-w-md rounded-2xl border border-[#d6d0c8] bg-white p-6 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">Report Locked</p>
            <h1 className="mt-2 text-2xl font-bold text-[#1a1a1a]">Payment required to view this scan</h1>
            <p className="mt-3 text-sm leading-6 text-[#6b6b6b]">
              The scan finished successfully, but the full report stays private until the dynamic final amount is approved.
            </p>
            <Link
              href={`/pay/${encodeURIComponent(locked.scanId)}`}
              className="mt-5 inline-flex rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              Go to payment
            </Link>
          </div>
          <Link href="/report" className="text-xs text-[#b8a9c8] hover:text-[#8a7a9a]">
            ← Back to reports
          </Link>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0ebe4] gap-4">
        <div className="rounded-xl border border-[#e85c5c33] bg-[#e85c5c11] px-6 py-4 text-sm text-[#e85c5c]">
          {error ?? "Scan data not available"}
        </div>
        <Link href="/report" className="text-xs text-[#b8a9c8] hover:text-[#8a7a9a]">
          ← Back to reports
        </Link>
      </div>
    );
  }

  const { scan_run } = data;

  return (
    <>
      <Head>
        <title>Validus — {scan_run.package}@{scan_run.version}</title>
        <meta
          name="description"
          content={`Security audit report for ${scan_run.package}@${scan_run.version} — Verdict: ${scan_run.verdict}`}
        />
      </Head>

      <div className="min-h-screen bg-[#f0ebe4] text-[#1a1a1a]">
        {/* Header */}
        <header className="flex items-center gap-4 border-b border-[#e0dbd4] bg-white px-6 py-3">
          <Link href="/report" className="text-sm text-[#b8a9c8] hover:text-[#8a7a9a]">
            ← Reports
          </Link>
          <div className="h-4 w-px bg-[#e0dbd4]" />
          <h1 className="text-sm font-semibold">
            {scan_run.package}
            <span className="ml-1.5 font-mono text-xs text-[#8a8580]">@{scan_run.version}</span>
          </h1>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-lg font-bold ${verdictColor(scan_run.verdict)}`}>
              {verdictIcon(scan_run.verdict)} {scan_run.verdict.toUpperCase()}
            </span>
            <span className="text-xs text-[#a8a09a]">
              {new Date(scan_run.scanned_at).toLocaleDateString()} •{" "}
              {formatDuration(scan_run.duration_ms)}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-8">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">Verdict</p>
              <p className={`mt-1 text-xl font-bold ${verdictColor(scan_run.verdict)}`}>
                {scan_run.verdict.toUpperCase()}
              </p>
            </div>
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">Files Scanned</p>
              <p className="mt-1 text-xl font-bold">{scan_run.files_scanned}</p>
            </div>
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">Findings</p>
              <p className="mt-1 text-xl font-bold text-[#e85c5c]">{data.findings.length}</p>
            </div>
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">Snippets</p>
              <p className="mt-1 text-xl font-bold">{data.snippets?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">Duration</p>
              <p className="mt-1 text-xl font-bold">{formatDuration(scan_run.duration_ms)}</p>
            </div>
          </div>

          {/* Severity bar */}
          <div className="mt-6 rounded-xl border border-[#e0dbd4] bg-white p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">
              Severity Distribution
            </p>
            <SeverityBar summary={scan_run.severity_summary} />
            <div className="mt-2 flex gap-4 text-[10px] text-[#8a8580]">
              {(["high", "medium", "low", "none"] as const).map((s) => (
                <span key={s}>
                  <span className="font-bold">{scan_run.severity_summary[s]}</span> {s}
                </span>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="mt-6 rounded-xl border border-[#e0dbd4] bg-white p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">
              Scan Metadata
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div>
                <span className="text-[#8a8580]">Scan ID:</span>{" "}
                <span className="font-mono text-[#3a3a3a]">{scan_run.scan_id}</span>
              </div>
              <div>
                <span className="text-[#8a8580]">Triggered by:</span>{" "}
                <span className="text-[#3a3a3a]">{scan_run.triggered_by}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-[#8a8580]">Tarball:</span>{" "}
                <span className="break-all font-mono text-[10px] text-[#3a3a3a]">
                  {scan_run.registry_tarball_url}
                </span>
              </div>
              {scan_run.tarball_sha512 && (
                <div className="sm:col-span-2">
                  <span className="text-[#8a8580]">SHA-512:</span>{" "}
                  <span className="break-all font-mono text-[10px] text-[#a8a09a]">
                    {scan_run.tarball_sha512}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Findings section */}
          <div className="mt-8 flex gap-6">
            {/* File sidebar */}
            {fileList.length > 0 && (
              <div className="w-56 shrink-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">
                  Files ({fileList.length})
                </p>
                <div className="rounded-xl border border-[#e0dbd4] bg-white">
                  <button
                    onClick={() => setSelectedFile(null)}
                    className={`w-full border-b border-[#f0ebe4] px-3 py-2 text-left text-xs transition hover:bg-[#faf8f5] ${
                      selectedFile === null ? "bg-[#f0ebe4] font-semibold" : ""
                    }`}
                  >
                    All findings ({data.findings.length})
                  </button>
                  {fileList.map((fp) => (
                    <button
                      key={fp}
                      onClick={() => setSelectedFile(fp)}
                      className={`flex w-full items-center justify-between border-b border-[#f0ebe4] px-3 py-2 text-left text-xs transition hover:bg-[#faf8f5] ${
                        selectedFile === fp ? "bg-[#f0ebe4] font-semibold" : ""
                      }`}
                    >
                      <span className="truncate font-mono text-[11px]" title={fp}>
                        {fp.split("/").pop()}
                      </span>
                      <span className="ml-2 shrink-0 rounded-full bg-[#e85c5c] px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {findingsByFile[fp]?.length ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Findings list */}
            <div className="flex-1">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#8a8580]">
                {selectedFile ? `Findings — ${selectedFile}` : `All Findings (${data.findings.length})`}
              </p>

              {activeFindings.length === 0 ? (
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-8 text-center text-sm text-[#a8a09a]">
                  No findings — package appears safe.
                </div>
              ) : (
                <div className="space-y-4">
                  {activeFindings.map((finding) => (
                    <div
                      key={finding.finding_id}
                      className="rounded-xl border border-[#e0dbd4] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <SeverityBadge severity={finding.severity} />
                            <span className="font-mono text-xs text-[#8a8580]">{finding.file}</span>
                            {finding.line_start !== undefined && (
                              <span className="rounded bg-[#1a1a1a] px-1.5 py-0.5 font-mono text-[10px] text-white">
                                L{finding.line_start}{finding.line_end && finding.line_end !== finding.line_start ? `–${finding.line_end}` : ""}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-[#3a3a3a]">
                            {finding.reasoning}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {finding.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-[#f0ebe4] px-2 py-0.5 text-[10px] text-[#8a8580]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-[#a8a09a]">
                          <div className="font-mono">{finding.finding_id.slice(0, 20)}</div>
                          {finding.reviewed && (
                            <span className="mt-1 inline-block rounded-full bg-[#4ade80] px-1.5 py-0.5 text-[9px] font-bold text-[#1a1a1a]">
                              REVIEWED
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Snippet evidence with highlighted flagged lines */}
                      {snippetMap[finding.snippet_id] && (
                        <SnippetViewer
                          snippet={snippetMap[finding.snippet_id]}
                          flaggedLineStart={finding.line_start}
                          flaggedLineEnd={finding.line_end}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
