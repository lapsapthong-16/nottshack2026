import { useRouter } from "next/router";
import { useEffect, useState, useRef, useMemo } from "react";
import Head from "next/head";
import Header from "@/components/Header";

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
};

type ActivityStep = {
  type: "phase" | "info" | "filelist" | "flag" | "triage" | "done" | "verdict" | "verification" | "agent_verdict";
  label: string;
  files?: string[];
  flag?: Flag;
  verdict?: string;
  riskScore?: number;
  summary?: string;
  agent?: string;
  agreesWithAgent1?: boolean;
  confidence?: number;
  detail?: string;
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
  verdict: string;
  riskScore: number;
  summary: string;
  findings: { file: string; risk: number; description: string }[];
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

function RiskBadge({ risk }: { risk: number }) {
  const color = risk >= 7 ? "bg-[#e85c5c]" : risk >= 4 ? "bg-[#d4a03c]" : "bg-[#4a9a4a]";
  const label = risk >= 7 ? "HIGH" : risk >= 4 ? "MED" : "LOW";
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ${color}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/40" />
      {label} {risk}
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
              <div className={`ml-3.5 rounded-lg border-l-[3px] p-3 ${
                step.label === "verifier_flagged"
                  ? "border-l-[#6b5c94] bg-[#f5f3fa]"
                  : "border-l-[#e85c5c] bg-[#fdf6f6]"
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                    step.label === "verifier_flagged" ? "bg-[#6b5c94]" : "bg-[#e85c5c]"
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
              <div className={`ml-3.5 rounded-lg border-l-[3px] p-3 ${
                step.label === "false_positive"
                  ? "border-l-[#4a9a4a] bg-[#f5faf8]"
                  : "border-l-[#d47a3c] bg-[#fdf9f5]"
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                    step.label === "false_positive" ? "bg-[#4a9a4a]" : "bg-[#d47a3c]"
                  }`}>
                    {step.label === "false_positive" ? "✓ false positive" : "⚠ missed threat"}
                  </span>
                </div>
                <RichText text={step.detail ?? ""} className="text-[12px] text-[#4a4a4a]" />
              </div>
            )}

            {step.type === "agent_verdict" && (
              <div className={`ml-3.5 rounded-lg border p-3 ${
                step.verdict === "SAFE"
                  ? "border-[#c0dcc0] bg-[#f5faf5]"
                  : step.verdict === "MALICIOUS"
                    ? "border-[#dcc0c0] bg-[#faf5f5]"
                    : "border-[#dcd8c0] bg-[#fafaf5]"
              }`}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="rounded bg-[#6b5c94] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {step.agent}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                    step.verdict === "SAFE" ? "bg-[#4a9a4a]"
                      : step.verdict === "MALICIOUS" ? "bg-[#e85c5c]"
                        : "bg-[#d4a03c]"
                  }`}>
                    {step.verdict}
                  </span>
                  {step.riskScore !== undefined && (
                    <RiskBadge risk={step.riskScore} />
                  )}
                  {step.agreesWithAgent1 !== undefined && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      step.agreesWithAgent1
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
              <div className={`rounded-xl border-2 p-4 shadow-sm ${
                step.verdict === "SAFE"
                  ? "border-[#4a9a4a]/30 bg-gradient-to-br from-[#f0faf0] to-[#e8f5e8]"
                  : step.verdict === "MALICIOUS"
                    ? "border-[#e85c5c]/30 bg-gradient-to-br from-[#faf0f0] to-[#f5e8e8]"
                    : "border-[#d4a03c]/30 bg-gradient-to-br from-[#fafaf0] to-[#f5f0e8]"
              }`}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a8580]">
                    {step.label}
                  </span>
                  <span className={`rounded-md px-3 py-1 text-[11px] font-bold uppercase text-white shadow-sm ${
                    step.verdict === "SAFE" ? "bg-[#4a9a4a]"
                      : step.verdict === "MALICIOUS" ? "bg-[#e85c5c]"
                        : "bg-[#d4a03c]"
                  }`}>
                    {step.verdict}
                  </span>
                  {step.riskScore !== undefined && (
                    <span className="text-sm font-bold text-[#4a4a4a]">
                      Risk Score: {step.riskScore}/10
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
  allFileViews,
  activeIndex,
  onTabClick,
}: {
  fileView: FileView | null;
  allFileViews: FileView[];
  activeIndex: number;
  onTabClick: (i: number) => void;
}) {
  if (!fileView) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-white text-[#a8a8a8]">
        <div className="animate-pulse text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm text-[#8a8580]">Waiting for analysis results...</p>
          <p className="text-xs mt-1 text-[#a8a09a]">Code will appear here once files are scanned</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* File tabs */}
      <div className="flex items-center gap-0 border-b border-[#e0dbd4] bg-[#f7f3ee]">
        <div className="flex flex-1 items-center overflow-x-auto">
          {allFileViews.map((fv, i) => (
            <button
              key={`tab-${i}-${fv.path}`}
              type="button"
              onClick={() => onTabClick(i)}
              className={`cursor-pointer border-r border-[#e0dbd4] px-4 py-2.5 text-[13px] font-mono transition ${
                i === activeIndex
                  ? "bg-white font-medium text-[#1a1a1a] border-b-2 border-b-[#8b6fad]"
                  : "text-[#8a8580] hover:bg-[#ede8e1] border-b-2 border-b-transparent"
              }`}
            >
              {fv.name}
            </button>
          ))}
        </div>
        {/* Tags */}
        <div className="flex items-center gap-1.5 px-3">
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
              className={`flex ${
                line.highlighted
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
            className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[#e8e4de] ${
              f.isDir ? "cursor-default" : ""
            } ${f.isDir ? "pl-2" : "pl-5"}`}
          >
            <span className="text-[10px]">{f.isDir ? "📁" : "📄"}</span>
            {f.risk !== null && (
              <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                f.risk >= 7 ? "bg-[#e85c5c]" : f.risk >= 4 ? "bg-[#d4a03c]" : "bg-[#4a9a4a]"
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
  const { name, version } = router.query;
  const pkgName = typeof name === "string" ? name : "unknown-package";
  const pkgVersion = typeof version === "string" ? version : "latest";

  const [activitySteps, setActivitySteps] = useState<ActivityStep[]>([]);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [fileViews, setFileViews] = useState<FileView[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isAuditing, setIsAuditing] = useState(false);
  const [finalVerdict, setFinalVerdict] = useState<{ verdict: string; riskScore: number; summary: string } | null>(null);

  // Accumulate chunk results to build file views
  const chunkResults = useRef<ChunkResult[]>([]);

  function addStep(step: ActivityStep) {
    setActivitySteps((prev) => [...prev, step]);
    setVisibleSteps((prev) => prev + 1);
  }

  // Build file views from chunk analysis findings
  function buildFileViewFromFinding(finding: { file: string; risk: number; description: string }, sourceChunk?: string) {
    const lines: CodeLine[] = [];
    if (sourceChunk) {
      const fileMarker = `--- FILE: ${finding.file} ---`;
      const startIdx = sourceChunk.indexOf(fileMarker);
      if (startIdx !== -1) {
        const afterMarker = sourceChunk.slice(startIdx + fileMarker.length);
        const endIdx = afterMarker.indexOf("\n--- FILE:");
        const fileContent = endIdx !== -1 ? afterMarker.slice(0, endIdx) : afterMarker;
        const codeLines = fileContent.split("\n").slice(0, 30);
        codeLines.forEach((text, i) => {
          lines.push({ num: i + 1, text });
        });
      }
    }

    if (lines.length === 0) {
      lines.push({ num: 1, text: `// File: ${finding.file}` });
      lines.push({ num: 2, text: `// Risk: ${finding.risk}/10` });
      lines.push({ num: 3, text: `// Finding: ${finding.description}` });
    }

    const tags = [finding.risk >= 7 ? "MALICIOUS" : finding.risk >= 4 ? "SUSPICIOUS" : "SAFE"];

    return {
      name: finding.file.split("/").pop() ?? finding.file,
      path: finding.file,
      tags,
      lines,
      findings: [finding.description],
      summary: finding.description,
    };
  }

  // Start the real audit
  useEffect(() => {
    if (!router.isReady || isAuditing) return;
    if (pkgName === "unknown-package") return;

    setIsAuditing(true);
    setActivitySteps([]);
    setVisibleSteps(0);
    setFiles([]);
    setFileViews([]);
    chunkResults.current = [];

    const controller = new AbortController();

    async function runAudit() {
      try {
        const response = await fetch("/api/audit/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: pkgName, version: pkgVersion }),
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
                case "phase":
                  addStep({ type: "phase", label: event.label });
                  break;

                case "info":
                  addStep({ type: "info", label: event.label });
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
                  setFiles((prev) =>
                    prev.map((f) =>
                      f.path === event.flag.file || f.path === `/${event.flag.file}`
                        ? { ...f, risk: event.flag.risk }
                        : f
                    )
                  );
                  break;

                case "chunk_result": {
                  const result = event as ChunkResult;
                  chunkResults.current.push(result);

                  if (result.findings && result.findings.length > 0) {
                    const newViews = result.findings.map((f: any) => buildFileViewFromFinding(f));
                    setFileViews((prev) => {
                      const existing = new Set(prev.map((v) => v.path));
                      const unique = newViews.filter((v: FileView) => !existing.has(v.path));
                      return [...prev, ...unique];
                    });
                  }

                  addStep({
                    type: "info",
                    label: `Chunk ${result.chunkIndex + 1}/${result.totalChunks}: ${result.verdict} (risk ${result.riskScore}/10)`,
                  });
                  break;
                }

                case "triage":
                  addStep({ type: "triage", label: event.label });
                  break;

                case "agent1_verdict":
                  addStep({
                    type: "agent_verdict",
                    label: `Agent 1 (${event.agent})`,
                    agent: event.agent,
                    verdict: event.verdict,
                    riskScore: event.riskScore,
                    summary: event.summary,
                  });
                  break;

                case "agent2_verdict":
                  addStep({
                    type: "agent_verdict",
                    label: `Agent 2 (${event.agent})`,
                    agent: event.agent,
                    verdict: event.verdict,
                    riskScore: event.riskScore,
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
                    riskScore: event.riskScore,
                    summary: event.summary,
                  });
                  addStep({
                    type: "verdict",
                    label: event.consensus ? "✅ Consensus Verdict" : "⚖️ Resolved Verdict",
                    verdict: event.verdict,
                    riskScore: event.riskScore,
                    summary: event.summary,
                  });
                  break;

                case "done":
                  addStep({ type: "done", label: event.label });
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
      } catch (err: any) {
        if (err.name !== "AbortError") {
          addStep({ type: "info", label: `❌ Audit error: ${err.message}` });
        }
      } finally {
        setIsAuditing(false);
      }
    }

    runAudit();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, pkgName]);

  const totalSteps = activitySteps.length || 1;
  const progress = isAuditing
    ? Math.min(90, Math.round((visibleSteps / Math.max(totalSteps, 8)) * 100))
    : finalVerdict
      ? 100
      : 0;

  function handleFileClick(path: string) {
    const idx = fileViews.findIndex((fv) => fv.path === path);
    if (idx !== -1) setActiveFileIndex(idx);
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
          filesScanned={fileViews.length}
          filesTotal={files.length}
          progress={progress}
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
            <CodeViewer
              fileView={fileViews[activeFileIndex] ?? null}
              allFileViews={fileViews}
              activeIndex={activeFileIndex}
              onTabClick={setActiveFileIndex}
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
