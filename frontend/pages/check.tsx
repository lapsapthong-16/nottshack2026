import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
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
  type: "phase" | "info" | "filelist" | "flag" | "triage" | "done" | "verdict";
  label: string;
  files?: string[];
  flag?: Flag;
  verdict?: string;
  riskScore?: number;
  summary?: string;
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
          <div key={i}>
            {step.type === "phase" && (
              <div>
                <span className="text-[11px] font-medium text-[#a8a09a]">
                  phase
                </span>
                <p className="mt-0.5 text-sm text-[#1a1a1a]">{step.label}</p>
              </div>
            )}
            {step.type === "info" && (
              <p className="text-sm text-[#6b6b6b]">{step.label}</p>
            )}
            {step.type === "filelist" && step.files && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {step.files.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1a1a1a]" />
                    <span className="text-sm text-[#1a1a1a] truncate">{f}</span>
                  </div>
                ))}
              </div>
            )}
            {step.type === "flag" && step.flag && (
              <div className="rounded-lg border border-[#e8d5d5] bg-[#fdf5f5] p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#e85c5c] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    flagged
                  </span>
                  <span className="rounded bg-[#e85c5c] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    risk {step.flag.risk}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#5a4a4a]">
                  {step.flag.file} — {step.flag.description}
                </p>
              </div>
            )}
            {step.type === "triage" && (
              <div>
                <span className="text-[11px] font-medium text-[#a8a09a]">
                  triage
                </span>
                <p className="mt-0.5 text-sm text-[#6b6b6b]">{step.label}</p>
              </div>
            )}
            {step.type === "verdict" && (
              <div className={`rounded-lg border p-3 ${
                step.verdict === "SAFE"
                  ? "border-[#d0e8d0] bg-[#f0faf0]"
                  : step.verdict === "MALICIOUS"
                    ? "border-[#e8d0d0] bg-[#faf0f0]"
                    : "border-[#e8e0d0] bg-[#faf8f0]"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
                    step.verdict === "SAFE"
                      ? "bg-[#2d7a2d]"
                      : step.verdict === "MALICIOUS"
                        ? "bg-[#e85c5c]"
                        : "bg-[#c89b3c]"
                  }`}>
                    {step.verdict}
                  </span>
                  {step.riskScore !== undefined && (
                    <span className="text-xs font-bold text-[#6b6b6b]">
                      Risk: {step.riskScore}/10
                    </span>
                  )}
                </div>
                <p className="text-xs leading-5 text-[#4a4a4a]">
                  {step.summary}
                </p>
              </div>
            )}
            {step.type === "done" && (
              <div className="rounded-lg border border-[#d0e8d0] bg-[#f0faf0] p-3">
                <p className="text-sm font-medium text-[#2d7a2d]">
                  {step.label}
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
      <div className="flex h-full items-center justify-center text-[#a8a8a8]">
        <p>Waiting for analysis results...</p>
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
              key={fv.path}
              type="button"
              onClick={() => onTabClick(i)}
              className={`cursor-pointer border-r border-[#e0dbd4] px-4 py-2.5 text-sm transition ${
                i === activeIndex
                  ? "bg-white font-medium text-[#1a1a1a]"
                  : "text-[#8a8580] hover:bg-[#ede8e1]"
              }`}
            >
              {fv.name}
            </button>
          ))}
        </div>
        {/* Tags */}
        <div className="flex items-center gap-1.5 px-3">
          {fileView.tags.map((tag) => {
            const colors: Record<string, string> = {
              DOM_MANIPULATION: "bg-[#f0dde0] text-[#943d4a]",
              NETWORK: "bg-[#dde8f0] text-[#3d5e94]",
              CRYPTO: "bg-[#e8e0f0] text-[#6b3d94]",
              SAFE: "bg-[#d0e8d0] text-[#2d7a2d]",
              SUSPICIOUS: "bg-[#e8e0d0] text-[#94763d]",
              MALICIOUS: "bg-[#f0dde0] text-[#943d4a]",
            };
            return (
              <span
                key={tag}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${colors[tag] ?? "bg-[#e8e4de] text-[#6b6b6b]"}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto bg-white">
        <pre className="text-[13px] leading-6">
          {fileView.lines.map((line) => (
            <div
              key={line.num}
              className={`flex ${
                line.highlighted
                  ? "bg-[#fde8e8] border-l-2 border-[#e85c5c]"
                  : "border-l-2 border-transparent"
              }`}
            >
              <span className="inline-block w-10 flex-shrink-0 select-none pr-3 text-right text-[#b8b3ac]">
                {line.num}
              </span>
              <code className="text-[#1a1a1a]">{line.text}</code>
            </div>
          ))}
        </pre>
      </div>

      {/* Findings */}
      <div className="border-t border-[#e0dbd4] bg-[#faf8f5] px-5 py-4 overflow-y-auto max-h-56">
        <div className="space-y-2">
          {fileView.findings.map((f, i) => (
            <div key={i} className="flex gap-2 text-sm leading-6 text-[#3a3a3a]">
              <span className="mt-0.5 flex-shrink-0 text-[#b8a9c8]">&gt;</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-[#4a4a4a]">
          {fileView.summary}
        </p>
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
        {files.map((f) => (
          <button
            key={f.path}
            type="button"
            onClick={() => !f.isDir && onFileClick(f.path)}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-[#e8e4de] ${
              f.isDir ? "cursor-default" : ""
            } ${f.isDir ? "pl-2" : "pl-5"}`}
          >
            {f.risk !== null && (
              <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                f.risk >= 7 ? "bg-[#e85c5c]" : f.risk >= 4 ? "bg-[#c89b3c]" : "bg-[#2d7a2d]"
              }`} />
            )}
            <span className="flex-1 text-sm text-[#1a1a1a] truncate">{f.name}</span>
            {f.isEntry && (
              <span className="rounded bg-[#e8e4de] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8a8580]">
                entry
              </span>
            )}
            {f.risk !== null && (
              <span className={`text-xs font-bold ${
                f.risk >= 7 ? "text-[#e85c5c]" : f.risk >= 4 ? "text-[#c89b3c]" : "text-[#2d7a2d]"
              }`}>
                {f.risk}
              </span>
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
    // Try to extract relevant code lines from the chunk
    const lines: CodeLine[] = [];
    if (sourceChunk) {
      const fileMarker = `--- FILE: ${finding.file} ---`;
      const startIdx = sourceChunk.indexOf(fileMarker);
      if (startIdx !== -1) {
        const afterMarker = sourceChunk.slice(startIdx + fileMarker.length);
        const endIdx = afterMarker.indexOf("\n--- FILE:");
        const fileContent = endIdx !== -1 ? afterMarker.slice(0, endIdx) : afterMarker;
        const codeLines = fileContent.split("\n").slice(0, 30); // Show first 30 lines
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

          // Parse SSE events
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
                  // Build file entries from the file list
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
                  addStep({ type: "flag", label: "flagged", flag: event.flag });
                  // Update file risk
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

                  // Build file views from findings
                  if (result.findings && result.findings.length > 0) {
                    const newViews = result.findings.map((f: any) => buildFileViewFromFinding(f));
                    setFileViews((prev) => {
                      // Deduplicate by path
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

                case "final_verdict":
                  setFinalVerdict({
                    verdict: event.verdict,
                    riskScore: event.riskScore,
                    summary: event.summary,
                  });
                  addStep({
                    type: "verdict",
                    label: "Final Verdict",
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
