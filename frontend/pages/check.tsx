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
  type: "phase" | "info" | "filelist" | "flag" | "triage" | "done";
  label: string;
  files?: string[];
  flag?: Flag;
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

// --- Simulated audit data ---

function buildSimulatedAudit(pkgName: string) {
  const files: FileEntry[] = [
    { name: "lib/", path: "lib/", risk: null, isDir: true },
    { name: "drainer.js", path: "lib/drainer.js", risk: 10 },
    { name: "modal.html", path: "modal.html", risk: null },
    { name: "index.js", path: "index.js", risk: 10, isEntry: true },
    { name: "package.json", path: "package.json", risk: null },
  ];

  const fileViews: FileView[] = [
    {
      name: "lib/drainer.js",
      path: "lib/drainer.js",
      tags: ["DOM_MANIPULATION", "NETWORK", "CRYPTO"],
      lines: [
        { num: 1, text: 'const SAFE_TEST_MODE = true;' },
        { num: 2, text: '' },
        { num: 3, text: 'const ERC20_APPROVE_SELECTOR = "0x095ea7b3";' },
        { num: 4, text: 'const MAX_UINT256 =' },
        { num: 5, text: '  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";' },
        { num: 6, text: '' },
        { num: 7, text: 'const DRAINER_ADDRESS = "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF";', highlighted: true },
        { num: 8, text: '' },
        { num: 9, text: 'class Drainer {' },
        { num: 10, text: '  constructor(options = {}) {' },
        { num: 11, text: '    this.targetAddress =' },
        { num: 12, text: '      options.targetAddress || DRAINER_ADDRESS;' },
        { num: 13, text: '    this.chainId = options.chainId || 1;' },
        { num: 14, text: '    this.originalProvider = null;' },
        { num: 15, text: '    this.proxy = null;' },
        { num: 16, text: '    this.interceptedTxs = [];' },
        { num: 17, text: '  }' },
        { num: 18, text: '' },
        { num: 19, text: '  hookProvider(provider) {' },
        { num: 20, text: '    this.originalProvider = provider;' },
        { num: 21, text: '' },
        { num: 22, text: '    this.proxy = new Proxy(provider, {' },
        { num: 23, text: '      get: (target, prop) => {' },
        { num: 24, text: '        if (prop === "request") {' },
        { num: 25, text: '          return (args) => this._interceptRequest(target, args);' },
        { num: 26, text: '        }' },
        { num: 27, text: '        if (prop === "send") {' },
        { num: 28, text: '          return (method, params) =>' },
        { num: 29, text: '            this._interceptSend(target, method, params);' },
        { num: 30, text: '        }' },
      ],
      findings: [
        "Hardcoded attacker address `DRAINER_ADDRESS` (0xDEADBEEF...) used as the spender in all ERC20 approve calls",
        "Proxy wraps the real Ethereum provider and replaces `window.ethereum` with the malicious proxy (L40), intercepting all wallet interactions",
        "`_interceptRequest` intercepts `eth_sendTransaction`, `eth_sign`, `personal_sign`, `eth_accounts`, and `eth_requestAccounts` — silently triggering drain on account discovery (L66)",
      ],
      summary:
        "This file implements a crypto wallet drainer that hijacks the browser's `window.ethereum` provider via a Proxy to intercept all wallet transactions and silently inject ERC20 `approve()` calls granting unlimited token spending allowance to a hardcoded attacker-controlled address, while also displaying a fake \"Connect Your Wallet\" modal to deceive users.",
    },
    {
      name: "index.js",
      path: "index.js",
      tags: ["DOM_MANIPULATION", "NETWORK"],
      lines: [
        { num: 1, text: 'const Drainer = require("./lib/drainer");' },
        { num: 2, text: '' },
        { num: 3, text: 'const drainer = new Drainer();' },
        { num: 4, text: '' },
        { num: 5, text: 'module.exports = {' },
        { num: 6, text: '  connect: () => {', highlighted: true },
        { num: 7, text: '    if (typeof window !== "undefined" && window.ethereum) {' },
        { num: 8, text: '      drainer.hookProvider(window.ethereum);' },
        { num: 9, text: '      drainer.showModal();' },
        { num: 10, text: '    }' },
        { num: 11, text: '  },' },
        { num: 12, text: '  disconnect: () => {' },
        { num: 13, text: '    drainer.cleanup();' },
        { num: 14, text: '  }' },
        { num: 15, text: '};' },
      ],
      findings: [
        "Exposes a `connect`/`disconnect` API that instantiates a Drainer object targeting a hardcoded Ethereum address",
        "Hooks into the browser's Web3 provider (`window.ethereum`) and displays a popup",
        "Behavior consistent with a cryptocurrency wallet drainer that intercepts and redirects blockchain transactions",
      ],
      summary:
        'This file exposes a `connect`/`disconnect` API that instantiates a "Drainer" object targeting a hardcoded Ethereum address, hooks into the browser\'s Web3 provider (`window.ethereum`), and displays a popup — behavior consistent with a cryptocurrency wallet drainer that intercepts and redirects blockchain transactions.',
    },
  ];

  const activitySteps: ActivityStep[] = [
    { type: "phase", label: "Resolving package" },
    { type: "phase", label: "Scanning package structure" },
    {
      type: "info",
      label: `Found ${files.length} files across 1 directories`,
    },
    {
      type: "phase",
      label: "Analyzing source files",
    },
    {
      type: "filelist",
      label: "Source files",
      files: ["index.js", "lib/drainer.js"],
    },
    {
      type: "flag",
      label: "flagged",
      flag: {
        file: "index.js",
        risk: 10,
        description: fileViews[1].summary,
      },
    },
    {
      type: "flag",
      label: "flagged",
      flag: {
        file: "lib/drainer.js",
        risk: 10,
        description: fileViews[0].summary,
      },
    },
    { type: "triage", label: "Analyzing source files..." },
    { type: "done", label: "Audit complete" },
  ];

  return { files, fileViews, activitySteps, packageName: pkgName };
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
              <div className="space-y-1">
                {step.files.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1a1a1a]" />
                    <span className="text-sm text-[#1a1a1a]">{f}</span>
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
  fileView: FileView;
  allFileViews: FileView[];
  activeIndex: number;
  onTabClick: (i: number) => void;
}) {
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
          <button
            type="button"
            className="ml-2 cursor-pointer rounded border border-[#d6d0c8] bg-white px-2.5 py-1 text-[11px] font-medium text-[#6b6b6b] hover:bg-[#f7f3ee]"
          >
            files
          </button>
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
      <div className="flex-1 space-y-0.5 px-4 pb-4">
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
              <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-[#e85c5c]" />
            )}
            <span className="flex-1 text-sm text-[#1a1a1a]">{f.name}</span>
            {f.isEntry && (
              <span className="rounded bg-[#e8e4de] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#8a8580]">
                entry
              </span>
            )}
            {f.risk !== null && (
              <span className="text-xs font-bold text-[#e85c5c]">
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
  const { name } = router.query;
  const pkgName = typeof name === "string" ? name : "unknown-package";

  const audit = buildSimulatedAudit(pkgName);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [started, setStarted] = useState(false);

  // Simulate AI activity feed
  useEffect(() => {
    if (!router.isReady) return;
    setStarted(true);
    setVisibleSteps(0);

    let step = 0;
    const total = audit.activitySteps.length;
    const delays = [600, 900, 500, 800, 400, 1200, 1200, 700, 500];

    function tick() {
      step++;
      setVisibleSteps(step);
      if (step < total) {
        setTimeout(tick, delays[step] ?? 600);
      }
    }

    const t = setTimeout(tick, delays[0] ?? 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, pkgName]);

  const progress = started
    ? Math.min(100, Math.round((visibleSteps / audit.activitySteps.length) * 100))
    : 0;

  const filesScanned = Math.min(
    audit.fileViews.length,
    Math.floor((visibleSteps / audit.activitySteps.length) * audit.fileViews.length + 0.5)
  );

  function handleFileClick(path: string) {
    const idx = audit.fileViews.findIndex((fv) => fv.path === path);
    if (idx !== -1) setActiveFileIndex(idx);
  }

  return (
    <>
      <Head>
        <title>NpmGuard — Package Security Audit</title>
      </Head>

      <div className="flex h-screen flex-col bg-[#f0ebe4] text-[#1a1a1a]">
        <Header
          packageName={pkgName}
          filesScanned={filesScanned}
          filesTotal={audit.fileViews.length}
          progress={progress}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Left — Activity */}
          <aside className="w-80 flex-shrink-0 overflow-hidden border-r border-[#e0dbd4] bg-[#f7f3ee]">
            <ActivityPanel
              steps={audit.activitySteps}
              visibleCount={visibleSteps}
            />
          </aside>

          {/* Center — Code viewer */}
          <main className="flex flex-1 flex-col overflow-hidden">
            <CodeViewer
              fileView={audit.fileViews[activeFileIndex]}
              allFileViews={audit.fileViews}
              activeIndex={activeFileIndex}
              onTabClick={setActiveFileIndex}
            />
          </main>

          {/* Right — Files */}
          <aside className="w-56 flex-shrink-0 overflow-hidden border-l border-[#e0dbd4] bg-[#f7f3ee]">
            <FilesPanel files={audit.files} onFileClick={handleFileClick} />
          </aside>
        </div>
      </div>
    </>
  );
}
