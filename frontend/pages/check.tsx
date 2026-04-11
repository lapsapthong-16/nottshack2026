import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import Head from "next/head";
import Header from "@/components/Header";
import { normalizePackageName, normalizePaymentRoute, normalizeVersion } from "@/lib/shared/auditSchemas";

// --- Types ---

type FileEntry = {
  name: string;
  path: string;
  risk: number | null;
  isEntry?: boolean;
  isDir?: boolean;
};

type Flag = {
  file: string;
  risk: number;
  description: string;
  lineNumbers?: number[];
};

type ActivityStep = {
  type: "phase" | "info" | "filelist" | "flag" | "triage" | "done" | "verdict" | "verification" | "agent_verdict" | "skill_selection";
  label: string;
  files?: string[];
  flag?: Flag;
  verdict?: string;
  riskScore?: string;
  summary?: string;
  agent?: string;
  agreesWithAgent1?: boolean;
  confidence?: number;
  detail?: string;
  selected?: string[];
  usedFallback?: boolean;
  reason?: string;
};

type CodeLine = {
  num: number;
  text: string;
  highlighted?: boolean;
};

type FileView = {
  name: string;
  path: string;
  tags: string[];
  lines: CodeLine[];
  findings: string[];
  summary: string;
};

type ChunkResult = {
  chunkIndex: number;
  totalChunks: number;
  chunkFiles?: string[];
  verdict: string;
  riskScore: string;
  summary: string;
  findings: { file: string; severity: string; description: string; lineNumbers?: number[] }[];
};

type BillingSummary = {
  scanId: string;
  paymentRoute: "dash" | "dcai";
  finalAmountCredits: string;
  finalAmountTDash?: string | null;
  finalAmountTDcai?: string | null;
  estimateAmountTDash?: string | null;
  estimateAmountTDcai?: string | null;
  paymentStatus: string;
  reportLocked: boolean;
  nextAction: "go_to_dash_payment" | "view_report";
  publicationStatus?: "pending" | "published" | "failed";
  billableLines: number;
  actualMinutes: number;
};

// ─── Syntax highlighting ────────────────────────────────────────

const JS_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "class", "new", "this", "import", "export", "default", "from", "require",
  "module", "exports", "async", "await", "try", "catch", "throw", "typeof",
  "instanceof", "in", "of", "switch", "case", "break", "continue", "do",
  "yield", "delete", "void", "null", "undefined", "true", "false",
  "extends", "super", "static", "get", "set",
]);

const JS_BUILTINS = new Set([
  "console", "window", "document", "process", "Buffer", "Promise",
  "JSON", "Math", "Array", "Object", "String", "Number", "Error",
  "setTimeout", "setInterval", "fetch", "require", "module",
  "Proxy", "Map", "Set", "RegExp", "Date",
]);

type TokenSpan = { text: string; className: string };

function tokenizeLine(text: string): TokenSpan[] {
  if (!text.trim()) return [{ text, className: "" }];

  const spans: TokenSpan[] = [];
  // Simple regex-based tokenizer
  const regex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$|\/\*[\s\S]*?\*\/|\b\d+\.?\d*\b|[a-zA-Z_$][\w$]*|[^\s]|\s+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const token = match[0];

    if (/^["'`]/.test(token)) {
      spans.push({ text: token, className: "text-[#a3501a]" }); // strings — burnt orange
    } else if (/^\/\//.test(token) || /^\/\*/.test(token)) {
      spans.push({ text: token, className: "text-[#6a8a4a] italic" }); // comments — olive green
    } else if (/^\d/.test(token)) {
      spans.push({ text: token, className: "text-[#1a6fb5]" }); // numbers — blue
    } else if (JS_KEYWORDS.has(token)) {
      spans.push({ text: token, className: "text-[#8b3fad] font-medium" }); // keywords — purple
    } else if (JS_BUILTINS.has(token)) {
      spans.push({ text: token, className: "text-[#267f7a]" }); // builtins — teal
    } else if (/^[{}()\[\];,.]$/.test(token)) {
      spans.push({ text: token, className: "text-[#8a8580]" }); // punctuation — muted
    } else {
      spans.push({ text: token, className: "text-[#1a1a1a]" });
    }
  }

  return spans.length > 0 ? spans : [{ text, className: "" }];
}

// ─── Markdown-like text renderer ─────────────────────────────────

function RichText({ text, className = "" }: { text: string; className?: string }) {
  if (!text) return null;

  // Split on newlines and render paragraphs
  const paragraphs = text.split(/\n\n|\n/);

  return (
    <div className={`space-y-2 ${className}`}>
      {paragraphs.map((para, pi) => {
        // Process inline markdown
        const rendered = para
          .replace(/`([^`]+)`/g, '<code class="rounded bg-[#ede8e1] px-1.5 py-0.5 text-[12px] font-mono text-[#8b3fad] border border-[#d6d0c8]">$1</code>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-[#1a1a1a]">$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

        if (para.startsWith("✅") || para.startsWith("⚠️") || para.startsWith("⚖️")) {
          return (
            <p key={pi} className="text-sm font-medium leading-6" dangerouslySetInnerHTML={{ __html: rendered }} />
          );
        }

        return (
          <p key={pi} className="text-sm leading-6" dangerouslySetInnerHTML={{ __html: rendered }} />
        );
      })}
    </div>
  );
}

// ─── Risk badge ────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: number | string | null | undefined }) {
  if (risk === null || risk === undefined) return null;
  // Accept both legacy numeric and new string severity
  let sev: string;
  if (typeof risk === "number") {
    sev = risk >= 7 ? "high" : risk >= 4 ? "medium" : risk >= 1 ? "low" : "none";
  } else {
    sev = risk || "none";
  }
  const color = sev === "high" ? "bg-[#e85c5c]" : sev === "medium" ? "bg-[#d4a03c]" : sev === "low" ? "bg-[#e8d85c] !text-[#1a1a1a]" : "bg-[#4a9a4a]";
  const label = sev.toUpperCase();
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ${color}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/40" />
      {label}
    </span>
  );
}

// --- Components ---

function ActivityPanel({
  steps,
  visibleCount,
}: {
  steps: ActivityStep[];
  visibleCount: number;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleCount]);

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <h2 className="px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
        Activity
      </h2>
      <div className="flex-1 space-y-3 px-4 pb-4">
        {steps.slice(0, visibleCount).map((step, i) => (
          <div key={i} className="animate-fadeIn">
            {step.type === "phase" && (
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#b8a9c8] animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8b6fad]">
                  phase
                </span>
                <div className="flex-1 h-px bg-[#e0dbd4]" />
              </div>
            )}
            {step.type === "phase" && (
              <p className="mt-1 ml-3.5 text-sm font-medium text-[#1a1a1a]">{step.label}</p>
            )}

            {step.type === "info" && (
              <div className="ml-3.5 flex items-start gap-2">
                <span className="mt-1.5 text-[#a8a09a] text-[10px]">▸</span>
                <p className="text-[13px] text-[#6b6b6b] leading-5">{step.label}</p>
              </div>
            )}

            {step.type === "filelist" && step.files && (
              <div className="ml-3.5 space-y-0.5 max-h-32 overflow-y-auto rounded-md border border-[#e8e4de] bg-white/60 p-2">
                {step.files.map((f, fi) => (
                  <div key={`${fi}-${f}`} className="flex items-center gap-2 py-0.5">
                    <span className="text-[10px] text-[#c8c0b8]">📄</span>
                    <span className="text-[12px] font-mono text-[#4a4a4a] truncate">{f}</span>
                  </div>
                ))}
              </div>
            )}

            {step.type === "flag" && step.flag && (
              <div className={`ml-3.5 rounded-lg border-l-[3px] p-3 ${step.label === "verifier_flagged"
                  ? "border-l-[#6b5c94] bg-[#f5f3fa]"
                  : "border-l-[#e85c5c] bg-[#fdf6f6]"
                }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${step.label === "verifier_flagged" ? "bg-[#6b5c94]" : "bg-[#e85c5c]"
                    }`}>
                    {step.label === "verifier_flagged" ? "🔍 verifier" : "⚠ flagged"}
                  </span>
                  <RiskBadge risk={step.flag.risk} />
                </div>
                <p className="text-[12px] font-mono text-[#4a4040] leading-5">
                  <span className="font-semibold text-[#1a1a1a]">{step.flag.file}</span>
                </p>
                <RichText text={step.flag.description} className="mt-1 text-[12px] text-[#5a4a4a]" />
              </div>
            )}

            {step.type === "verification" && (
              <div className={`ml-3.5 rounded-lg border-l-[3px] p-3 ${step.label === "false_positive"
                  ? "border-l-[#4a9a4a] bg-[#f5faf8]"
                  : "border-l-[#d47a3c] bg-[#fdf9f5]"
                }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${step.label === "false_positive" ? "bg-[#4a9a4a]" : "bg-[#d47a3c]"
                    }`}>
                    {step.label === "false_positive" ? "✓ false positive" : "⚠ missed threat"}
                  </span>
                </div>
                <RichText text={step.detail ?? ""} className="text-[12px] text-[#4a4a4a]" />
              </div>
            )}

            {step.type === "agent_verdict" && (
              <div className={`ml-3.5 rounded-lg border p-3 ${step.verdict === "SAFE"
                  ? "border-[#c0dcc0] bg-[#f5faf5]"
                  : step.verdict === "MALICIOUS"
                    ? "border-[#dcc0c0] bg-[#faf5f5]"
                    : "border-[#dcd8c0] bg-[#fafaf5]"
                }`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="rounded bg-[#6b5c94] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {step.agent}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${step.verdict === "SAFE" ? "bg-[#4a9a4a]"
                      : step.verdict === "MALICIOUS" ? "bg-[#e85c5c]"
                        : "bg-[#d4a03c]"
                    }`}>
                    {step.verdict}
                  </span>
                  {step.riskScore !== undefined && (
                    <RiskBadge risk={step.riskScore} />
                  )}
                  {step.agreesWithAgent1 !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${step.agreesWithAgent1
                        ? "bg-[#e8f5e8] text-[#2d7a2d]"
                        : "bg-[#f5e8e8] text-[#c85c3c]"
                      }`}>
                      {step.agreesWithAgent1 ? "✓ Agrees" : "✗ Disagrees"}
                    </span>
                  )}
                </div>
                <RichText text={step.summary ?? ""} className="text-[12px] text-[#4a4a4a]" />
              </div>
            )}

            {step.type === "skill_selection" && step.selected && (
              <div className="ml-3.5 rounded-lg border border-[#c8d0e0] bg-gradient-to-br from-[#f0f3fa] to-[#e8ecf5] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded bg-[#5c6e94] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    🧭 Skill Router
                  </span>
                  {step.usedFallback && (
                    <span className="rounded-full bg-[#f0e8d0] px-2 py-0.5 text-[10px] font-bold text-[#94763d]">
                      fallback
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {step.selected.map((skill, si) => (
                    <span
                      key={`skill-${si}-${skill}`}
                      className="inline-flex items-center rounded-md border border-[#c0c8d8] bg-white/80 px-2 py-0.5 text-[11px] font-mono font-medium text-[#4a5a7a]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
                {step.reason && (
                  <p className="text-[11px] text-[#6b7b9b] leading-4 italic">{step.reason}</p>
                )}
              </div>
            )}

            {step.type === "triage" && (
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d4a03c] animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b89830]">
                  triage
                </span>
                <div className="flex-1 h-px bg-[#e0dbd4]" />
              </div>
            )}
            {step.type === "triage" && (
              <p className="mt-1 ml-3.5 text-[13px] text-[#6b6b6b]">{step.label}</p>
            )}

            {step.type === "verdict" && (
              <div className={`rounded-xl border-2 p-4 shadow-sm ${step.verdict === "SAFE"
                  ? "border-[#4a9a4a]/30 bg-gradient-to-br from-[#f0faf0] to-[#e8f5e8]"
                  : step.verdict === "MALICIOUS"
                    ? "border-[#e85c5c]/30 bg-gradient-to-br from-[#faf0f0] to-[#f5e8e8]"
                    : "border-[#d4a03c]/30 bg-gradient-to-br from-[#fafaf0] to-[#f5f0e8]"
                }`}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a8580]">
                    {step.label}
                  </span>
                  <span className={`rounded-md px-3 py-1 text-[11px] font-bold uppercase text-white shadow-sm ${step.verdict === "SAFE" ? "bg-[#4a9a4a]"
                      : step.verdict === "MALICIOUS" ? "bg-[#e85c5c]"
                        : "bg-[#d4a03c]"
                    }`}>
                    {step.verdict}
                  </span>
                  {step.riskScore !== undefined && (
                    <span className="text-sm font-bold text-[#4a4a4a]">
                      Severity: {step.riskScore.toUpperCase()}
                    </span>
                  )}
                </div>
                <RichText text={step.summary ?? ""} className="text-[#4a4a4a]" />
              </div>
            )}

            {step.type === "done" && (
              <div className="rounded-xl border border-[#c0dcc0] bg-gradient-to-r from-[#f0faf0] to-[#e8f5e8] p-3 text-center">
                <p className="text-sm font-semibold text-[#2d7a2d]">
                  ✅ {step.label}
                </p>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function CodeViewer({
  fileView,
  isLoading,
}: {
  fileView: FileView | null;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white text-[#a8a8a8]">
        <div className="animate-pulse text-center">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-sm text-[#8a8580]">Loading source code...</p>
        </div>
      </div>
    );
  }

  if (!fileView) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white text-[#a8a8a8]">
        <div className="text-center">
          <div className="text-4xl mb-3">📄</div>
          <p className="text-sm text-[#8a8580]">Click any file in the right panel to view its source</p>
          <p className="text-xs mt-1 text-[#a8a09a]">Files with findings will appear as tabs automatically</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Current file header */}
      <div className="flex items-center justify-between border-b border-[#e0dbd4] bg-[#f7f3ee] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#a8a09a]">📄</span>
          <span className="font-mono text-[13px] font-medium text-[#1a1a1a]">
            {fileView.path}
          </span>
        </div>
        {/* Tags */}
        <div className="flex items-center gap-1.5">
          {fileView.tags.map((tag, ti) => {
            const colors: Record<string, string> = {
              DOM_MANIPULATION: "bg-[#f0dde0] text-[#943d4a]",
              NETWORK: "bg-[#dde8f0] text-[#3d5e94]",
              CRYPTO: "bg-[#e8e0f0] text-[#6b3d94]",
              SAFE: "bg-[#d8eed8] text-[#2d7a2d]",
              SUSPICIOUS: "bg-[#f0e8d0] text-[#94763d]",
              MALICIOUS: "bg-[#f0dde0] text-[#943d4a]",
            };
            return (
              <span
                key={`tag-${ti}-${tag}`}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${colors[tag] ?? "bg-[#e8e4de] text-[#6b6b6b]"}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* Code area — light theme */}
      <div className="flex-1 overflow-auto bg-white">
        <pre className="text-[13px] leading-7 py-2">
          {fileView.lines.map((line) => (
            <div
              key={line.num}
              className={`flex ${line.highlighted
                  ? "bg-[#fde8e8] border-l-2 border-[#e85c5c]"
                  : "border-l-2 border-transparent hover:bg-[#f7f3ee]"
                }`}
            >
              <span className="inline-block w-12 flex-shrink-0 select-none pr-4 text-right text-[12px] text-[#b8b3ac]">
                {line.num}
              </span>
              <code>
                {tokenizeLine(line.text).map((span, si) => (
                  <span key={si} className={span.className}>{span.text}</span>
                ))}
              </code>
            </div>
          ))}
        </pre>
      </div>

      {/* Findings — warm panel */}
      <div className="border-t border-[#e0dbd4] bg-[#faf8f5] px-5 py-4 overflow-y-auto max-h-56">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8a8580] mb-3">
          Findings
        </h3>
        <div className="space-y-2.5">
          {fileView.findings.map((f, i) => (
            <div key={i} className="flex gap-2.5 text-[13px] leading-6 text-[#3a3a3a]">
              <span className="mt-0.5 flex-shrink-0 text-[#8b6fad]">▸</span>
              <RichText text={f} className="text-[#3a3a3a]" />
            </div>
          ))}
        </div>
        {fileView.summary && (
          <div className="mt-4 border-t border-[#e0dbd4] pt-3">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8a8580] mb-2">
              Summary
            </h3>
            <RichText text={fileView.summary} className="text-[13px] text-[#4a4a4a]" />
          </div>
        )}
      </div>
    </div>
  );
}

function FilesPanel({
  files,
  onFileClick,
}: {
  files: FileEntry[];
  onFileClick: (path: string) => void;
}) {
  const fileCount = files.filter((f) => !f.isDir).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
          Files ({fileCount})
        </h2>
      </div>
      <div className="flex-1 space-y-0.5 px-4 pb-4 overflow-y-auto">
        {files.map((f, fi) => (
          <button
            key={`file-${fi}-${f.path}`}
            type="button"
            onClick={() => !f.isDir && onFileClick(f.path)}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[#e8e4de] ${f.isDir ? "cursor-default" : ""
              } ${f.isDir ? "pl-2" : "pl-5"}`}
          >
            <span className="text-[10px]">{f.isDir ? "📁" : "📄"}</span>
            {f.risk !== null && (
              <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${f.risk >= 7 ? "bg-[#e85c5c]" : f.risk >= 4 ? "bg-[#d4a03c]" : "bg-[#4a9a4a]"
                }`} />
            )}
            <span className="flex-1 text-[13px] font-mono text-[#1a1a1a] truncate">{f.name}</span>
            {f.isEntry && (
              <span className="rounded bg-[#e8e4de] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8a8580]">
                entry
              </span>
            )}
            {f.risk !== null && (
              <RiskBadge risk={f.risk} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Main page ---

export default function Check() {
  const router = useRouter();
  const { name, version, quoteId, paymentRoute, dcaiTxHash } = router.query;
  const pkgName = normalizePackageName(
    typeof name === "string" ? name : Array.isArray(name) ? (name[0] ?? "unknown-package") : "unknown-package"
  );
  const pkgVersion = normalizeVersion(
    typeof version === "string" ? version : Array.isArray(version) ? version[0] : "latest"
  );
  const resolvedQuoteId =
    typeof quoteId === "string" ? quoteId : Array.isArray(quoteId) ? (quoteId[0] ?? "") : "";
  const resolvedPaymentRoute = normalizePaymentRoute(
    typeof paymentRoute === "string" ? paymentRoute : Array.isArray(paymentRoute) ? (paymentRoute[0] ?? null) : null,
  );
  const resolvedDcaiTxHash =
    typeof dcaiTxHash === "string" ? dcaiTxHash : Array.isArray(dcaiTxHash) ? (dcaiTxHash[0] ?? "") : "";

  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [fileViews, setFileViews] = useState<FileView[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [finalVerdict, setFinalVerdict] = useState<{ verdict: string; overallSeverity: string; summary: string } | null>(null);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);

  // Accumulate chunk results to build file views
  const chunkResults = useRef<ChunkResult[]>([]);
  // Synchronous guard to prevent double audit fire (React StrictMode)
  const auditStarted = useRef(false);
  // Per-file findings map: path → [{ description, severity, lineNumbers }]
  const findingsMap = useRef<Record<string, { description: string; severity: string; lineNumbers: number[] }[]>>({});
  // Per-file summary map: path → summary string (from chunk_result events)
  const fileSummaryMap = useRef<Record<string, string>>({});
  // Track how many total files exist in the package (from unpkg metadata)
  const [totalPackageFiles, setTotalPackageFiles] = useState(0);
  // Track actual audit progress phases for the progress bar
  const [auditPhase, setAuditPhase] = useState(0); // 0-8 representing each audit pipeline stage
  const totalAuditPhases = 8; // resolve, fetch, skill, analyze, triage1, verify, triage2, done

  // Fetch actual source code from unpkg
  async function fetchFileSource(filePath: string): Promise<CodeLine[]> {
    try {
      const res = await fetch(`https://unpkg.com/${pkgName}@${pkgVersion}${filePath}`);
      if (!res.ok) return [];
      const content = await res.text();
      return content.split("\n").slice(0, 500).map((text, i) => ({ num: i + 1, text }));
    } catch {
      return [];
    }
  }

  // Create or update a file view with actual source code
  async function ensureFileView(
    filePath: string,
    findings: string[] = [],
    tags: string[] = ["SAFE"],
    summary: string = "No security findings for this file.",
    highlightLines: number[] = []
  ): Promise<number> {
    // Check if already loaded with real content
    const existingIdx = fileViews.findIndex((fv) => fv.path === filePath);
    if (existingIdx !== -1 && fileViews[existingIdx].lines.length > 3) {
      // Already has real content — update findings and highlights if new
      if (findings.length > 0 || highlightLines.length > 0) {
        const hlSet = new Set(highlightLines);
        setFileViews((prev) => {
          const updated = [...prev];
          const existing = updated[existingIdx];
          const newFindings = findings.filter((f) => !existing.findings.includes(f));
          const updatedLines = hlSet.size > 0
            ? existing.lines.map((l) => hlSet.has(l.num) ? { ...l, highlighted: true } : l)
            : existing.lines;
          updated[existingIdx] = {
            ...existing,
            lines: updatedLines,
            findings: [...existing.findings, ...newFindings],
            tags: findings.length > 0 ? tags : existing.tags,
            summary: newFindings.length > 0 ? newFindings.join("; ") : existing.summary,
          };
          return updated;
        });
      }
      return existingIdx;
    }

    // Fetch actual source code
    const lines = await fetchFileSource(filePath);
    const fileName = filePath.split("/").pop() ?? filePath;

    if (lines.length === 0) {
      lines.push({ num: 1, text: `// File: ${filePath}` });
      lines.push({ num: 2, text: `// Source could not be loaded` });
    }

    // Apply line highlights
    const hlSet = new Set(highlightLines);
    if (hlSet.size > 0) {
      for (const line of lines) {
        if (hlSet.has(line.num)) line.highlighted = true;
      }
    }

    const newView: FileView = {
      name: fileName,
      path: filePath,
      tags,
      lines,
      findings,
      summary,
    };

    let newIndex = 0;
    setFileViews((prev) => {
      const idx = prev.findIndex((v) => v.path === filePath);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = {
          ...newView,
          findings: [...prev[idx].findings, ...findings.filter((f) => !prev[idx].findings.includes(f))],
        };
        newIndex = idx;
        return updated;
      }
      newIndex = prev.length;
      return [...prev, newView];
    });
    return newIndex;
  }

  function addStep(step: ActivityStep) {
    setActivitySteps((prev) => [...prev, step]);
    setVisibleSteps((prev) => prev + 1);
  }

  // Build file view from finding — fetches real source from unpkg
  function loadFindingFileView(finding: { file: string; severity: string; description: string; lineNumbers?: number[] }) {
    const tags = [finding.severity === "high" ? "MALICIOUS" : finding.severity === "medium" ? "SUSPICIOUS" : "SAFE"];
    const lineNums = finding.lineNumbers ?? [];
    ensureFileView(finding.file, [finding.description], tags, finding.description, lineNums);
  }

  // Start the real audit
  useEffect(() => {
    if (!router.isReady) return;
    if (pkgName === "unknown-package") return;
    if (!resolvedQuoteId) {
      addStep({ type: "info", label: "❌ Missing quoteId. Start from the pricing step on the landing page." });
      return;
    }
    // Synchronous ref guard — prevents StrictMode double-fire
    if (auditStarted.current) return;
    auditStarted.current = true;

    setIsAuditing(true);
    setActivitySteps([]);
    setVisibleSteps(0);
    setFiles([]);
    setFileViews([]);
    chunkResults.current = [];
    findingsMap.current = {};
    fileSummaryMap.current = {};
    setTotalPackageFiles(0);
    setAuditPhase(0);

    const controller = new AbortController();

    async function runAudit() {
      try {
        const response = await fetch("/api/audit/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pkgName,
            version: pkgVersion,
            quoteId: resolvedQuoteId,
            paymentRoute: resolvedPaymentRoute,
            dcaiTxHash: resolvedPaymentRoute === "dcai" ? resolvedDcaiTxHash : undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          addStep({ type: "info", label: `Error: Failed to start audit (${response.status})` });
          setIsAuditing(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case "phase": {
                  addStep({ type: "phase", label: event.label });
                  // Track audit phases for progress bar
                  const lbl = event.label;
                  if (lbl.includes("Resolving")) setAuditPhase(1);
                  else if (lbl.includes("Scanning") || lbl.includes("Extracting")) setAuditPhase(2);
                  else if (lbl.includes("Skill Router")) setAuditPhase(3);
                  else if (lbl.includes("Analyzing")) setAuditPhase(4);
                  else if (lbl.includes("Verifier")) setAuditPhase(6);
                  else if (lbl.includes("tie-breaker")) setAuditPhase(7);
                  break;
                }

                case "info":
                  addStep({ type: "info", label: event.label });
                  // Extract total file count from the "Found X files, fetched Y" info message
                  {
                    const fetchedMatch = event.label.match(/fetched\s+(\d+)\s+code files/);
                    if (fetchedMatch) {
                      setTotalPackageFiles(parseInt(fetchedMatch[1], 10));
                    } else {
                      const totalMatch = event.label.match(/Found\s+(\d+)\s+files/);
                      if (totalMatch) setTotalPackageFiles(parseInt(totalMatch[1], 10));
                    }
                  }
                  break;

                case "filelist":
                  addStep({ type: "filelist", label: event.label, files: event.files });
                  setFiles(
                    (event.files ?? []).map((f: string) => ({
                      name: f.split("/").pop() ?? f,
                      path: f,
                      risk: null,
                      isEntry: f === "/index.js" || f === "/package.json",
                    }))
                  );
                  break;

                case "flag":
                  addStep({ type: "flag", label: event.label ?? "flagged", flag: event.flag });
                  // Store finding in per-file map for later lookup
                  {
                    const filePath = event.flag.file.startsWith("/") ? event.flag.file : "/" + event.flag.file;
                    if (!findingsMap.current[filePath]) findingsMap.current[filePath] = [];
                    findingsMap.current[filePath].push({
                      description: event.flag.description,
                      severity: event.flag.severity ?? "low",
                      lineNumbers: event.flag.lineNumbers ?? [],
                    });
                  }
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.path === event.flag.file || f.path === `/${event.flag.file}`
                        ? { ...f, risk: event.flag.risk ?? event.flag.severity ?? 0 }
                        : f
                    )
                  );
                  break;

                case "chunk_result": {
                  const result = event as ChunkResult;
                  chunkResults.current.push(result);

                  // Get the list of files in this chunk
                  const chunkFiles: string[] = (event.chunkFiles ?? []) as string[];

                  // Store the chunk summary for ALL files in this chunk
                  if (result.summary && chunkFiles.length > 0) {
                    for (const fp of chunkFiles) {
                      fileSummaryMap.current[fp] = result.summary;
                    }
                  }

                  // Mark ALL files in this chunk as scanned (risk=0 if not flagged)
                  // This makes the file count update in real-time
                  if (chunkFiles.length > 0) {
                    const flaggedInChunk = new Set(
                      (result.findings ?? []).map((f: { file?: string }) =>
                        (typeof f.file === "string" && f.file.startsWith("/")) ? f.file : "/" + (f.file ?? "")
                      )
                    );
                    setFiles((prev) =>
                      prev.map((f) => {
                        // Only update files that are in this chunk and haven't been flagged yet
                        if (chunkFiles.includes(f.path) && f.risk === null && !flaggedInChunk.has(f.path)) {
                          return { ...f, risk: 0 };
                        }
                        return f;
                      })
                    );
                  }

                  // Fetch actual source for each finding
                  if (result.findings && result.findings.length > 0) {
                    for (const f of result.findings) {
                      loadFindingFileView(f);
                    }
                  }

                  addStep({
                    type: "info",
                    label: `Chunk ${result.chunkIndex + 1}/${result.totalChunks}: ${result.verdict} (${result.riskScore})`,
                  });
                  break;
                }

                case "triage":
                  addStep({ type: "triage", label: event.label });
                  if (event.label.includes("Agent 1")) setAuditPhase(5);
                  else if (event.label.includes("Verifier")) setAuditPhase(7);
                  break;

                case "agent1_verdict":
                  addStep({
                    type: "agent_verdict",
                    label: `Agent 1 (${event.agent})`,
                    agent: event.agent,
                    verdict: event.verdict,
                    riskScore: event.overallSeverity ?? event.riskScore ?? "none",
                    summary: event.summary,
                  });
                  break;

                case "agent2_verdict":
                  addStep({
                    type: "agent_verdict",
                    label: `Agent 2 (${event.agent})`,
                    agent: event.agent,
                    verdict: event.verdict,
                    riskScore: event.overallSeverity ?? event.riskScore ?? "none",
                    summary: event.summary,
                    agreesWithAgent1: event.agreesWithAgent1,
                    confidence: event.confidence,
                  });
                  break;

                case "verification":
                  addStep({
                    type: "verification",
                    label: event.label,
                    detail: event.detail,
                  });
                  break;

                case "verifier_chunk":
                  addStep({
                    type: "info",
                    label: `Verifier chunk ${event.chunkIndex + 1}/${event.totalChunks}: ${event.independentVerdict} ${event.agreesWithAgent1 ? "✓ agrees" : "✗ disagrees"}`,
                  });
                  break;

                case "final_verdict":
                  setFinalVerdict({
                    verdict: event.verdict,
                    overallSeverity: event.overallSeverity ?? "none",
                    summary: event.summary,
                  });
                  addStep({
                    type: "verdict",
                    label: event.consensus ? "✅ Consensus Verdict" : "⚖️ Resolved Verdict",
                    verdict: event.verdict,
                    riskScore: event.overallSeverity ?? "none",
                    summary: event.summary,
                  });
                  break;

                case "skill_selection":
                  addStep({
                    type: "skill_selection",
                    label: "Skill selection",
                    selected: event.selected,
                    usedFallback: event.usedFallback,
                    reason: event.reason,
                  });
                  break;

                case "done":
                  addStep({ type: "done", label: event.label });
                  setAuditPhase(8);
                  setBillingSummary({
                    scanId: event.scanId,
                    paymentRoute: event.paymentRoute ?? resolvedPaymentRoute,
                    finalAmountCredits: event.finalAmountCredits,
                    finalAmountTDash: event.finalAmountTDash,
                    finalAmountTDcai: event.finalAmountTDcai,
                    estimateAmountTDash: event.estimateAmountTDash,
                    estimateAmountTDcai: event.estimateAmountTDcai,
                    paymentStatus: event.paymentStatus,
                    reportLocked: Boolean(event.reportLocked),
                    nextAction: event.nextAction ?? "go_to_dash_payment",
                    publicationStatus: event.publicationStatus,
                    billableLines: event.billableLines ?? 0,
                    actualMinutes: event.actualMinutes ?? 0,
                  });
                  // Mark all unflagged files as safe (risk=0)
                  setFiles((prev) =>
                    prev.map((f) => (f.risk === null ? { ...f, risk: 0 } : f))
                  );
                  break;

                case "error":
                  addStep({ type: "info", label: `❌ ${event.message}` });
                  break;
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch (err: unknown) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          addStep({ type: "info", label: `❌ Audit error: ${err instanceof Error ? err.message : "Unknown error"}` });
        }
      } finally {
        setIsAuditing(false);
      }
    }

    runAudit();

    return () => {
      controller.abort();
      auditStarted.current = false; // Allow restart on StrictMode remount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, pkgName, pkgVersion, resolvedQuoteId, resolvedPaymentRoute, resolvedDcaiTxHash]);

  // Files scanned = files in the right panel that have been processed by agents
  const filesScannedCount = files.filter((f) => f.risk !== null).length;
  const scanProgress = totalPackageFiles > 0 ? (filesScannedCount / totalPackageFiles) * 100 : 0;

  useEffect(() => {
    if (!billingSummary || billingSummary.paymentRoute !== "dcai" || billingSummary.reportLocked) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void router.push(`/report/${encodeURIComponent(billingSummary.scanId)}`);
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [billingSummary, router]);

  let calculatedProgress = 0;
  if (finalVerdict) {
    calculatedProgress = 100;
  } else if (isAuditing) {
    if (auditPhase <= 3) {
      // Phases 1, 2, 3 -> 10% to 30%
      calculatedProgress = (auditPhase / 3) * 30;
    } else if (auditPhase === 4 || auditPhase === 5) {
      // Analyzing phase -> 30% base + up to 50% from file scanning
      calculatedProgress = 30 + (scanProgress * 0.5);
    } else {
      // Verifier, tie-breaker -> 80% to 95%
      const remainingPhases = Math.max(1, auditPhase - 5);
      calculatedProgress = 80 + (remainingPhases / 3) * 15;
    }
  }
  const progress = finalVerdict ? 100 : Math.min(98, Math.round(calculatedProgress));

  async function handleFileClick(filePath: string) {
    // If file already loaded, just switch to it
    const idx = fileViews.findIndex((fv) => fv.path === filePath);
    if (idx !== -1) {
      setActiveFileIndex(idx);
      return;
    }

    // Look up real data from findingsMap and files state
    const fileFindings = findingsMap.current[filePath] ?? [];
    const fileEntry = files.find((f) => f.path === filePath);
    const risk = fileEntry?.risk ?? 0;

    // Determine real tag from severity
    let tags: string[];
    if (fileFindings.length > 0) {
      const severityOrder = ["high", "medium", "low", "none"];
      const highestSev = fileFindings.reduce((best, f) => {
        const idx = severityOrder.indexOf(f.severity);
        const bestIdx = severityOrder.indexOf(best);
        return idx >= 0 && idx < bestIdx ? f.severity : best;
      }, "none");
      tags = [highestSev === "high" ? "MALICIOUS" : highestSev === "medium" ? "SUSPICIOUS" : highestSev === "low" ? "LOW" : "SAFE"];
    } else if (risk === 0) {
      tags = ["SAFE"];
    } else {
      tags = ["SAFE"];
    }

    const descriptions = fileFindings.map((f) => f.description);
    const allLineNumbers = fileFindings.flatMap((f) => f.lineNumbers);

    // Build a real summary: use per-file summary from chunk results, fall back to findings, then to safe message
    const chunkSummary = fileSummaryMap.current[filePath] ?? "";
    let summary: string;
    if (descriptions.length > 0) {
      summary = descriptions.join("\n\n");
      if (chunkSummary) summary = chunkSummary + "\n\n" + summary;
    } else if (chunkSummary) {
      summary = chunkSummary;
    } else {
      // Try to find the chunk summary that covers this file
      const matchingChunk = chunkResults.current.find((cr) => cr.summary);
      summary = matchingChunk?.summary ?? "No security findings for this file.";
    }

    // Fetch source from unpkg and create a new file view with real data
    setIsLoadingFile(true);
    try {
      const newIdx = await ensureFileView(filePath, descriptions, tags, summary, allLineNumbers);
      setActiveFileIndex(newIdx);
    } finally {
      setIsLoadingFile(false);
    }
  }

  return (
    <>
      <Head>
        <title>Validus — Package Security Audit</title>
      </Head>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>

      <div className="flex h-screen flex-col bg-[#f0ebe4] text-[#1a1a1a]">
        <Header
          packageName={`${pkgName}@${pkgVersion}`}
          filesScanned={filesScannedCount}
          filesTotal={totalPackageFiles || files.length}
          progress={progress}
          auditPhase={auditPhase}
          activeRoute={resolvedPaymentRoute}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Left — Activity */}
          <aside className="w-80 flex-shrink-0 overflow-hidden border-r border-[#e0dbd4] bg-[#f7f3ee]">
            <ActivityPanel
              steps={activitySteps}
              visibleCount={visibleSteps}
            />
          </aside>

          {/* Center — Code viewer */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {billingSummary && (
              <div className="border-b border-[#e0dbd4] bg-white px-6 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">
                      {billingSummary.paymentRoute === "dash" ? "Report Locked Pending Payment" : "DCAI Payment Captured"}
                    </p>
                    {billingSummary.paymentRoute === "dash" ? (
                      <p className="mt-1 text-sm text-[#4a4a4a]">
                        Final amount: <span className="font-semibold text-[#1a1a1a]">{billingSummary.finalAmountTDash} tDASH</span>
                        {" "}within approved ceiling of {billingSummary.estimateAmountTDash} tDASH.
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-[#4a4a4a]">
                        Payment captured via <span className="font-semibold text-[#1a1a1a]">{billingSummary.finalAmountTDcai ?? billingSummary.estimateAmountTDcai} tDCAI</span>.
                        {" "}Dash Drive publication is running from the backend wallet.
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[#8a8580]">
                      {billingSummary.billableLines} billable lines • {billingSummary.actualMinutes} billed minute{billingSummary.actualMinutes === 1 ? "" : "s"}
                    </p>
                    {billingSummary.paymentRoute === "dcai" && billingSummary.publicationStatus && (
                      <p className="mt-1 text-xs text-[#8a8580]">
                        Publication status: {billingSummary.publicationStatus}
                      </p>
                    )}
                  </div>
                  {billingSummary.paymentRoute === "dash" ? (
                    <button
                      type="button"
                      onClick={() => void router.push(`/pay/${encodeURIComponent(billingSummary.scanId)}`)}
                      className="rounded-xl bg-[#1a1a1a] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
                    >
                      Pay &amp; Unlock Report
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void router.push(`/report/${encodeURIComponent(billingSummary.scanId)}`)}
                      className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-600"
                    >
                      Open Report
                    </button>
                  )}
                </div>
              </div>
            )}
            <CodeViewer
              fileView={fileViews[activeFileIndex] ?? null}
              isLoading={isLoadingFile}
            />
          </main>

          {/* Right — Files */}
          <aside className="w-56 flex-shrink-0 overflow-hidden border-l border-[#e0dbd4] bg-[#f7f3ee]">
            <FilesPanel files={files} onFileClick={handleFileClick} />
          </aside>
        </div>
      </div>
    </>
  );
}
