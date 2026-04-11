import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";
import type {
  PublicPackageVersionData,
  FindingRecord,
  SnippetRecord,
  SeveritySummary,
} from "@/lib/shared/auditSchemas";

// ─── Helpers ───────────────────────────────────────────────

function severityColor(sev: string): string {
  switch (sev) {
    case "high":     return "bg-[#e85c5c] text-white shadow-[#e85c5c33]";
    case "medium":   return "bg-[#e8a85c] text-white shadow-[#e8a85c33]";
    case "low":      return "bg-[#e8d85c] text-[#1a1a1a] shadow-[#e8d85c33]";
    default:         return "bg-[#d6d0c8] text-[#6b6b6b]";
  }
}

function verdictColor(verdict: string): string {
  switch (verdict) {
    case "safe":    return "text-emerald-600";
    case "flagged": return "text-rose-500";
    case "error":   return "text-amber-500";
    default:        return "text-[#8a8580]";
  }
}

function verdictBg(verdict: string): string {
  switch (verdict) {
    case "safe":    return "bg-emerald-50 border-emerald-100";
    case "flagged": return "bg-rose-50 border-rose-100";
    case "error":   return "bg-amber-50 border-amber-100";
    default:        return "bg-gray-50 border-gray-100";
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
      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${severityColor(severity)}`}
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
    <div className="w-full">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#e8e4df] shadow-inner">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.key}
              style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
              title={`${s.key}: ${s.count}`}
              className="transition-all duration-500 hover:brightness-110"
            />
          ) : null
        )}
      </div>
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
    <div className="mt-4 overflow-hidden rounded-xl border border-[#e0dbd4] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#e0dbd4] bg-[#f8f6f2] px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#8a8580]">
          Evidence Snippet
        </span>
        <div className="h-3 w-px bg-[#e0dbd4]" />
        <span className="font-mono text-[10px] text-[#6b6b6b]">
          {snippet.file} : {snippet.line_start ?? snippet.char_start}–{snippet.line_end ?? snippet.char_end}
        </span>
        {flaggedLineStart !== undefined && (
          <span className="ml-auto rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-600">
            ISSUE L{flaggedLineStart}{flaggedLineEnd && flaggedLineEnd !== flaggedLineStart ? `–${flaggedLineEnd}` : ""}
          </span>
        )}
      </div>
      <div className="max-h-[450px] overflow-auto bg-[#fafafa]">
        <pre className="p-4 text-xs leading-relaxed">
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
                className={`flex -ml-4 pl-4 ${isFlagged ? "bg-rose-50 border-l-4 border-rose-500" : "border-l-4 border-transparent hover:bg-gray-100"}`}
              >
                <span className={`mr-4 inline-block w-8 shrink-0 select-none text-right font-mono text-[11px] ${isFlagged ? "text-rose-500 font-bold" : "text-[#c5c0b8]"}`}>
                  {lineNum}
                </span>
                <span className={`whitespace-pre font-mono ${isFlagged ? "text-rose-900 font-medium" : "text-[#3a3a3a]"}`}>
                  {line || " "}
                </span>
              </div>
            );
          })}
        </pre>
      </div>
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
  const [locked, setLocked] = useState<{ scanId: string; paymentRoute: "dash" | "dcai" } | null>(null);

  useEffect(() => {
    if (!scanId || typeof scanId !== "string") return;

    fetch(`/api/audit/scan?id=${encodeURIComponent(scanId)}`)
      .then(async (r) => {
        const payload = await r.json();
        if (r.status === 402) {
          setLocked({ scanId: payload.scanId ?? scanId, paymentRoute: payload.paymentRoute ?? "dash" });
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

  const findingsByFile = useMemo(() => {
    if (!data?.findings) return {};
    const map: Record<string, FindingRecord[]> = {};
    for (const f of data.findings) {
      const key = f.file.replace(/^\/?/, "").replace(/\s*\(.*?\)\s*$/, "").trim();
      if (!map[key]) map[key] = [];
      map[key].push(f);
    }
    return map;
  }, [data]);

  const snippetMap = useMemo(() => {
    if (!data?.snippets) return {};
    const map: Record<string, SnippetRecord> = {};
    for (const s of data.snippets) {
      map[s.snippet_id] = s;
    }
    return map;
  }, [data]);

  const fileList = useMemo(() => {
    return Object.keys(findingsByFile).sort();
  }, [findingsByFile]);

  const activeFindings = selectedFile ? (findingsByFile[selectedFile] ?? []) : data?.findings ?? [];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f0ebe4]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b8a9c8] border-t-transparent" />
          <div className="text-sm font-medium text-[#8a8580]">Analyzing scan data...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    if (locked) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f0ebe4] px-6">
          <div className="max-w-md rounded-3xl border border-[#d6d0c8] bg-white p-8 text-center shadow-xl">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8580]">Report Locked</p>
            <h1 className="mt-3 text-2xl font-bold text-[#1a1a1a]">
              {locked.paymentRoute === "dash" ? "Unlock detailed report" : "Finalizing publication"}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#6b6b6b]">
              {locked.paymentRoute === "dash"
                ? "This audit is complete, but the full findings stay private until the final amount is approved in tDASH."
                : "Your scan is ready! Secure publication to Dash Drive is in progress and will unlock the findings shortly."}
            </p>
            <Link
              href={locked.paymentRoute === "dash" ? `/pay/${encodeURIComponent(locked.scanId)}` : "/?paymentRoute=dcai"}
              className="mt-6 block w-full rounded-2xl bg-[#1a1a1a] py-4 text-sm font-bold text-white transition hover:opacity-90 shadow-lg shadow-black/10"
            >
              {locked.paymentRoute === "dash" ? "Proceed to Payment" : "Resume Publication"}
            </Link>
          </div>
          <Link href="/report" className="text-xs font-medium text-[#b8a9c8] hover:text-[#8a7a9a] transition-colors">
            ← Back to all reports
          </Link>
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f0ebe4] gap-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-8 py-5 text-sm font-medium text-rose-600 shadow-sm transition-all animate-in fade-in zoom-in duration-300">
          {error ?? "Scan data not available"}
        </div>
        <Link href="/report" className="text-xs font-medium text-[#b8a9c8] hover:text-[#8a7a9a]">
          ← Back to all reports
        </Link>
      </div>
    );
  }

  const { scan_run } = data;

  return (
    <>
      <Head>
        <title>Report: {scan_run.package}@{scan_run.version} – Validus</title>
      </Head>

      <div className="min-h-screen bg-[#f0ebe4] text-[#1a1a1a]">
        <Header />

        {/* Local Page Header */}
        <div className="border-b border-[#e0dbd4] bg-white px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/report" className="group flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition hover:bg-gray-100 hover:text-gray-900 border border-gray-100">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </Link>
              <div>
                <nav className="mb-0.5 flex gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <Link href="/report" className="hover:text-gray-600">Reports</Link>
                  <span>/</span>
                  <span className="text-gray-600">{scan_run.scan_id.slice(0, 12)}...</span>
                </nav>
                <h1 className="flex items-baseline gap-2 text-xl font-bold tracking-tight text-gray-900">
                  {scan_run.package}
                  <span className="font-mono text-sm font-medium text-gray-400">@{scan_run.version}</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`flex items-center gap-2 rounded-2xl border px-4 py-2 ${verdictBg(scan_run.verdict)} shadow-sm`}>
                <span className={`text-xl font-black ${verdictColor(scan_run.verdict)}`}>
                  {verdictIcon(scan_run.verdict)}
                </span>
                <span className={`text-sm font-bold uppercase tracking-widest ${verdictColor(scan_run.verdict)}`}>
                  {scan_run.verdict}
                </span>
              </div>
              <div className="hidden h-8 w-px bg-gray-100 sm:block" />
              <div className="hidden text-right sm:block">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Audited At</p>
                <p className="text-sm font-semibold text-gray-700">{new Date(scan_run.scanned_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-6 py-8">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
            {[
              { label: "Verdict", value: scan_run.verdict.toUpperCase(), color: verdictColor(scan_run.verdict), sub: "AI Logic" },
              { label: "Files", value: scan_run.files_scanned, sub: "Package size" },
              { label: "Findings", value: data.findings.length, color: data.findings.length > 0 ? "text-rose-500" : "text-emerald-500", sub: "Potential risks" },
              { label: "Evidence", value: data.snippets?.length ?? 0, sub: "Code snippets" },
              { label: "Time", value: formatDuration(scan_run.duration_ms), sub: "Scan dynamic" },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl border border-[#e0dbd4] bg-white p-5 shadow-sm transition hover:shadow-md">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8580]">{card.label}</p>
                <p className={`mt-2 text-2xl font-black tracking-tight ${card.color || "text-[#1a1a1a]"}`}>{card.value}</p>
                <p className="mt-1 text-[11px] text-[#a8a09a]">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Severity Distribution */}
            <div className="rounded-2xl border border-[#e0dbd4] bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8580]">Severity Focus</h2>
                <span className="text-[11px] font-bold text-[#1a1a1a]">{data.findings.length} Total</span>
              </div>
              <SeverityBar summary={scan_run.severity_summary} />
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
                {(["high", "medium", "low", "none"] as const).map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${s === "high" ? "bg-rose-500" : s === "medium" ? "bg-amber-400" : s === "low" ? "bg-yellow-300" : "bg-gray-300"}`} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{s}</span>
                    <span className="text-sm font-bold text-gray-900">{scan_run.severity_summary[s]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Technical Metadata (spans 2 on lg) */}
            <div className="lg:col-span-2 rounded-2xl border border-[#e0dbd4] bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8580]">Metadata Reference</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400">Environment Hub</label>
                    <p className="mt-1 break-all font-mono text-xs font-semibold text-gray-700">{scan_run.scan_id}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400">Trigger Origin</label>
                    <p className="mt-1 text-sm font-semibold text-gray-700 underline decoration-gray-200 underline-offset-2">{scan_run.triggered_by}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-400">Tarball Distribution</label>
                    <p className="mt-1 break-all font-mono text-[11px] text-gray-600 line-clamp-1 hover:line-clamp-none transition-all cursor-help">{scan_run.registry_tarball_url}</p>
                  </div>
                  {scan_run.tarball_sha512 && (
                    <div>
                      <label className="text-[10px] font-bold uppercase text-gray-400">Integrity — SHA512</label>
                      <p className="mt-1 break-all font-mono text-[10px] text-gray-400">{scan_run.tarball_sha512.slice(0, 64)}...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Sidebar: File Explorer (Column Span 3) */}
            <div className="lg:col-span-3">
              <div className="sticky top-24 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#8a8580]">Findings Map</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold border border-gray-200">{fileList.length} Files</span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#e0dbd4] bg-white shadow-sm">
                  <button
                    onClick={() => setSelectedFile(null)}
                    className={`flex items-center justify-between w-full border-b border-gray-50 px-4 py-3.5 text-left text-xs transition hover:bg-gray-50 ${selectedFile === null ? "bg-gray-50 font-bold text-[#1a1a1a]" : "text-gray-500"}`}
                  >
                    <span>Overview (All)</span>
                    <span className="text-[10px] text-gray-400">{data.findings.length}</span>
                  </button>
                  <div className="max-h-[60vh] overflow-y-auto">
                    {fileList.map((fp) => (
                      <button
                        key={fp}
                        onClick={() => setSelectedFile(fp)}
                        className={`flex w-full items-center justify-between border-b border-gray-50 px-4 py-3 text-left text-xs transition hover:bg-gray-50 ${selectedFile === fp ? "bg-gray-100 font-bold text-[#1a1a1a]" : "text-gray-500"}`}
                      >
                        <span className="truncate pr-2 font-mono text-[11px]" title={fp}>
                          {fp.split("/").pop()}
                        </span>
                        <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[9px] font-black ${findingsByFile[fp]?.some(f => f.severity === 'high') ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {findingsByFile[fp]?.length ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Content: Findings List (Column Span 9) */}
            <div className="lg:col-span-9">
              <div className="flex items-end justify-between mb-4 pb-1 border-b border-gray-200">
                <h2 className="text-xl font-black tracking-tight text-gray-900">
                  {selectedFile ? selectedFile : `Complete Findings`}
                </h2>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{activeFindings.length} Items</span>
              </div>

              {activeFindings.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-[#e0dbd4] bg-white/50 p-16 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-500 shadow-sm shadow-emerald-100/50">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Clear Scan</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm text-[#8a8580]">
                    Validated results show no structural anomalies or malicious patterns for these files.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  {activeFindings.map((finding) => (
                    <div
                      key={finding.finding_id}
                      className="group relative"
                    >
                      <div className="absolute -inset-2 rounded-[32px] bg-gray-50 opacity-0 transition group-hover:opacity-100" />
                      <div className="relative overflow-hidden rounded-3xl border border-[#e0dbd4] bg-white p-6 shadow-sm ring-1 ring-black/5 transition hover:shadow-xl hover:ring-black/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-4 flex flex-wrap items-center gap-3">
                              <SeverityBadge severity={finding.severity} />
                              <div className="h-4 w-px bg-gray-200" />
                              <span className="font-mono text-xs font-bold text-gray-400">
                                {finding.file}
                              </span>
                              {finding.line_start !== undefined && (
                                <span className="rounded bg-black px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-sm">
                                  L{finding.line_start}{finding.line_end && finding.line_end !== finding.line_start ? `–${finding.line_end}` : ""}
                                </span>
                              )}
                            </div>
                            <p className="text-base font-medium leading-relaxed text-[#1a1a1a]">
                              {finding.reasoning}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {finding.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-lg bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-gray-500 border border-gray-100"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex shrink-0 flex-col items-end gap-3 text-right">
                             {finding.reviewed && (
                               <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-600 border border-emerald-100">
                                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                 AUDIT VERIFIED
                               </div>
                             )}
                            <div className="font-mono text-[9px] font-bold text-gray-300">#{finding.finding_id.slice(0, 8)}</div>
                          </div>
                        </div>

                        {/* Snippet Viewer inside the card */}
                        {snippetMap[finding.snippet_id] && (
                          <div className="mt-6 border-t border-gray-100 pt-2">
                             <SnippetViewer
                                snippet={snippetMap[finding.snippet_id]}
                                flaggedLineStart={finding.line_start}
                                flaggedLineEnd={finding.line_end}
                             />
                          </div>
                        )}
                      </div>
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
