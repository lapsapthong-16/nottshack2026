import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import Head from "next/head";
import Header from "@/components/Header";
import React from "react";

const EXPLORER = "http://139.180.140.143";
const REPORT_CONTRACT = "0x7fD01C2d75E271e34eF7ABec9BB9Da2C4E78f8Da";
const STAKING_CONTRACT = "0x47423b0286099CFF00B6Bc2830674CED8caf2BFf";
const DCAI_RPC_PROXY = "http://localhost:3000/api/dcai/rpc";
const STAKING_ABI = [
  "function slashAll(address user)",
  "function getStake(address user) view returns (uint256)",
];

type Finding = {
  severity: string;
  title: string;
  file: string;
  line: number;
};

type ReportMeta = {
  pkgName: string;
  version: string;
  riskScore: number;
  riskLabel: string;
  filesCount: number;
  findingsCount: number;
  id: string;
  summary: string;
  findings: Finding[];
};

type OnChainReport = {
  reportId: number;
  auditor: string;
  dataHash: string;
  meta: ReportMeta;
  timestamp: number;
};

function riskColor(score: number): string {
  if (score >= 80) return "bg-[#e85c5c] text-white";
  if (score >= 50) return "bg-[#e8a85c] text-white";
  if (score >= 20) return "bg-[#e8d85c] text-[#1a1a1a]";
  return "bg-[#4ade80] text-[#1a1a1a]";
}

function riskLabel(score: number): string {
  if (score >= 80) return "Critical";
  if (score >= 50) return "Warning";
  if (score >= 20) return "Low";
  return "Safe";
}

type ResolutionStep = {
  label: string;
  sublabel?: string;
  done: boolean;
  active: boolean;
  icon: "check" | "dispute" | "vote" | "chat" | "final";
};

export default function Report2() {
  const [reports, setReports] = useState<OnChainReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Resolution state
  const [resolutionPhase, setResolutionPhase] = useState(0);
  const [disputeTimer, setDisputeTimer] = useState(107 * 60);
  const [slashed, setSlashed] = useState(false);
  const [stakeNum, setStakeNum] = useState(0);
  const [slashedAmount, setSlashedAmount] = useState("0.0010");

  // Auditor address (from first report)
  const getAuditor = () => reports.length > 0 ? reports[0].auditor : "";

  const refreshStake = useCallback(async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
      const contract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);
      const staked = await contract.getStake(addr);
      setStakeNum(parseFloat(ethers.formatEther(staked)));
    } catch { /* silent */ }
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m remaining`;
  };

  // Dispute timer countdown
  useEffect(() => {
    if (resolutionPhase !== 2) return;
    const id = setInterval(() => setDisputeTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [resolutionPhase]);

  // Fetch stake when reports load
  useEffect(() => {
    const auditor = getAuditor();
    if (auditor) refreshStake(auditor);
  }, [reports, refreshStake]);

  const startResolution = () => {
    const currentStake = stakeNum;
    setSlashedAmount(currentStake > 0 ? currentStake.toFixed(4) : "0.0010");
    setResolutionPhase(1);
    setSlashed(false);
    setTimeout(() => setResolutionPhase(2), 2000);
    setTimeout(() => setResolutionPhase(3), 4000);
    setTimeout(() => setResolutionPhase(4), 6000);
    setTimeout(() => setResolutionPhase(5), 8000);
    setTimeout(async () => {
      setResolutionPhase(6);
      setSlashed(true);
      const auditor = getAuditor();
      if (auditor) {
        try {
          const iface = new ethers.Interface(STAKING_ABI);
          const data = iface.encodeFunctionData("slashAll", [auditor]);
          await fetch("/api/dcai/send-tx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: STAKING_CONTRACT, data, value: "0" }),
          });
          await refreshStake(auditor);
        } catch { /* silent */ }
      }
    }, 10000);
  };

  const steps: ResolutionStep[] = [
    { label: "Outcome proposed: Yes", sublabel: "AI detected malicious pattern", done: resolutionPhase >= 1, active: resolutionPhase === 1, icon: "check" },
    { label: "Dispute window", sublabel: resolutionPhase >= 3 ? `Bond: ${slashedAmount} tDCAI` : formatTime(disputeTimer), done: resolutionPhase >= 3, active: resolutionPhase === 2, icon: "dispute" },
    { label: "First round voting", sublabel: resolutionPhase >= 3 ? "Result: Malicious" : undefined, done: resolutionPhase >= 3, active: resolutionPhase === 3, icon: "vote" },
    { label: "Discussion", sublabel: resolutionPhase >= 4 ? "3 AI agents debated" : undefined, done: resolutionPhase >= 5, active: resolutionPhase === 4, icon: "chat" },
    { label: "Second round voting", sublabel: resolutionPhase >= 5 ? "Result: Yes" : undefined, done: resolutionPhase >= 5, active: resolutionPhase === 5, icon: "vote" },
    { label: "Final outcome", done: resolutionPhase >= 6, active: resolutionPhase === 6, icon: "final" },
  ];

  useEffect(() => {
    fetch("/api/dcai/query-reports")
      .then((res) => res.json())
      .then((data) => {
        if (data.reports) {
          const parsed: OnChainReport[] = data.reports
            .map((r: any) => {
              try {
                const meta = JSON.parse(r.metadata);
                if (!meta.pkgName) return null;
                return {
                  reportId: r.id,
                  auditor: r.auditor,
                  dataHash: r.dataHash,
                  meta,
                  timestamp: r.timestamp,
                };
              } catch {
                return null;
              }
            })
            .filter(Boolean);
          setReports(parsed);
        } else {
          setError("Failed to fetch reports");
        }
      })
      .catch(() => setError("Connection error"))
      .finally(() => setLoading(false));
  }, []);

  const totalScanned = reports.length;
  const totalFlagged = reports.filter((r) => r.meta.findingsCount > 0).length;
  const totalSafe = totalScanned - totalFlagged;
  const avgRisk = totalScanned > 0 ? reports.reduce((sum, r) => sum + r.meta.riskScore, 0) / totalScanned : 0;

  return (
    <>
      <Head>
        <title>DCAI Audit Reports | Validus</title>
      </Head>
      <div className="min-h-screen bg-[#f7f3ee]">
        <Header />

        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">
                DCAI On-Chain Audit Reports
              </h1>
              <p className="mt-2 text-sm text-[#6b6b6b]">
                Packages scanned by the community. Results published on DCAI L3 (Chain 18441).
              </p>
            </div>
            <a
              href={`${EXPLORER}/address/${REPORT_CONTRACT}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition no-underline"
            >
              View Contract
            </a>
          </div>

          {loading ? (
            <div className="mt-20 flex flex-col items-center justify-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
              <p className="text-sm text-[#6b6b6b]">Querying DCAI L3 Chain...</p>
            </div>
          ) : error ? (
            <div className="mt-20 rounded-xl border border-red-200 bg-red-50 p-10 text-center">
              <p className="text-red-600 font-medium">Error: {error}</p>
              <button onClick={() => window.location.reload()} className="mt-4 text-sm font-medium text-red-700 underline">
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Total scanned</p>
                  <p className="mt-2 text-3xl font-bold text-[#1a1a1a]">{totalScanned}</p>
                </div>
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Flagged</p>
                  <p className="mt-2 text-3xl font-bold text-[#e85c5c]">{totalFlagged}</p>
                </div>
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Safe</p>
                  <p className="mt-2 text-3xl font-bold text-[#2d7a2d]">{totalSafe}</p>
                </div>
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Avg risk</p>
                  <p className="mt-2 text-3xl font-bold text-[#1a1a1a]">{(avgRisk / 10).toFixed(1)}</p>
                </div>
              </div>

              {/* Table */}
              <div className="mt-8 overflow-hidden rounded-xl border border-[#e0dbd4] bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e0dbd4] bg-[#f7f3ee]">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Package</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Version</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Risk</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Files</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">Flags</th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">ID</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <React.Fragment key={r.reportId}>
                        <tr
                          className={`border-b border-[#f0ebe4] transition hover:bg-[#faf8f5] cursor-pointer ${expandedId === r.reportId ? "bg-[#faf8f5]" : ""}`}
                          onClick={() => setExpandedId(expandedId === r.reportId ? null : r.reportId)}
                        >
                          <td className="px-5 py-3.5 font-medium text-[#1a1a1a]">{r.meta.pkgName}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-[#6b6b6b]">{r.meta.version}</td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${riskColor(r.meta.riskScore)}`}>
                              {(r.meta.riskScore / 10).toFixed(1)}
                              <span className="text-[10px] font-medium opacity-80 uppercase">{riskLabel(r.meta.riskScore)}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs text-[#6b6b6b] bg-[#f0f0f0] px-1.5 py-0.5 rounded">{r.meta.filesCount}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {r.meta.findingsCount > 0 ? (
                              <span className="font-bold text-[#e85c5c] flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-[#e85c5c]" />
                                {r.meta.findingsCount}
                              </span>
                            ) : (
                              <span className="text-[#a8a09a]">0</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs font-mono text-[#a8a09a]">{r.meta.id}...</td>
                          <td className="px-5 py-3.5 text-right flex items-center justify-end gap-3">
                            <a
                              href={`${EXPLORER}/address/${REPORT_CONTRACT}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-200 transition no-underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Explorer
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                            <button className="text-xs font-medium text-amber-600 hover:text-amber-800">
                              {expandedId === r.reportId ? "Hide Details" : "View Details"}
                            </button>
                          </td>
                        </tr>

                        {expandedId === r.reportId && (
                          <tr className="bg-[#fcfaf8] border-b border-[#f0ebe4]">
                            <td colSpan={7} className="px-8 py-6">
                              <div className="space-y-6">
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8a8580] mb-3">Security Summary</h4>
                                  <div className="rounded-lg border border-[#e0dbd4] bg-white p-4 text-sm leading-relaxed text-[#4a4a4a] shadow-sm">
                                    {r.meta.summary}
                                  </div>
                                </div>

                                {r.meta.findings && r.meta.findings.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#8a8580] mb-3">
                                      Detailed Findings ({r.meta.findings.length})
                                    </h4>
                                    <div className="space-y-3">
                                      {r.meta.findings.map((f, idx) => (
                                        <div key={idx} className={`rounded-lg border bg-white p-4 shadow-sm border-l-4 ${
                                          f.severity === "critical" ? "border-l-red-500" :
                                          f.severity === "high" ? "border-l-orange-500" :
                                          f.severity === "medium" ? "border-l-yellow-500" :
                                          f.severity === "low" ? "border-l-blue-400" :
                                          "border-l-gray-300"
                                        } border-[#e0dbd4]`}>
                                          <div className="flex items-center gap-3 mb-1">
                                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                              f.severity === "critical" ? "bg-red-100 text-red-700" :
                                              f.severity === "high" ? "bg-orange-100 text-orange-700" :
                                              f.severity === "medium" ? "bg-yellow-100 text-yellow-700" :
                                              f.severity === "low" ? "bg-blue-100 text-blue-700" :
                                              "bg-gray-100 text-gray-600"
                                            }`}>
                                              {f.severity}
                                            </span>
                                            <span className="font-mono text-xs font-medium text-[#1a1a1a]">{f.file}:{f.line}</span>
                                          </div>
                                          <p className="text-sm text-[#4a4a4a]">{f.title}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="pt-4 border-t border-[#f0ebe4]">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#bbb6b0] mb-2">On-Chain Metadata</h4>
                                  <div className="text-[10px] text-[#bbb6b0] font-mono bg-[#fcfaf8] p-3 rounded border border-[#f0ebe4] space-y-1">
                                    <p>Report ID: {r.reportId}</p>
                                    <p>Data Hash: {r.dataHash}</p>
                                    <p>Auditor: {r.auditor}</p>
                                    <p>Timestamp: {new Date(r.timestamp * 1000).toLocaleString()}</p>
                                    <p>Contract: {REPORT_CONTRACT}</p>
                                    <p>Chain: DCAI L3 (18441)</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resolution Section */}
              <div className="mt-8 rounded-2xl border border-[#e0dbd4] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-[#1a1a1a] mb-6">Resolution</h2>

                {/* Progress Steps */}
                <div className="relative flex items-center justify-between mb-8">
                  <div className="absolute top-5 left-5 right-5 h-0.5 bg-[#e0dbd4]" />
                  <div className="absolute top-5 left-5 h-0.5 bg-blue-500 transition-all duration-1000"
                    style={{ width: `${Math.max(0, (resolutionPhase - 1) / 5) * 100}%`, maxWidth: "calc(100% - 40px)" }} />

                  {steps.map((step, i) => (
                    <div key={i} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / 6}%` }}>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                        step.done ? "border-blue-500 bg-blue-500 text-white" :
                        step.active ? "border-blue-500 bg-white text-blue-500" :
                        "border-[#e0dbd4] bg-white text-[#ccc]"
                      }`}>
                        {step.done ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : step.icon === "dispute" ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/></svg>
                        ) : step.icon === "chat" ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-current" />
                        )}
                      </div>
                      <p className={`mt-2 text-center text-[10px] font-medium leading-tight ${step.active ? "text-blue-600" : step.done ? "text-[#1a1a1a]" : "text-[#bbb]"}`}>
                        {step.label}
                      </p>
                      {step.sublabel && (
                        <p className={`text-center text-[9px] ${step.active ? "text-blue-500" : "text-[#aaa]"}`}>{step.sublabel}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Status */}
                {resolutionPhase === 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-[#e0dbd4] bg-[#faf8f5] p-4 cursor-pointer hover:bg-[#f5f0ea] transition"
                    onClick={startResolution}>
                    <div>
                      <p className="text-sm text-[#6b6b6b]">Simulate: AI detects a node passed malicious code through audit</p>
                      <p className="text-xs text-[#aaa] mt-1">
                        {stakeNum > 0
                          ? <>Bond at risk: <strong className="text-[#1a1a1a]">{stakeNum.toFixed(4)} tDCAI</strong></>
                          : "Auditor stake will be slashed on-chain"}
                      </p>
                    </div>
                    <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 transition">
                      Dispute &amp; Submit Bond
                    </button>
                  </div>
                )}

                {resolutionPhase >= 1 && resolutionPhase < 6 && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm text-blue-700 font-medium">
                      {resolutionPhase === 1 && "AI flagged suspicious code pattern..."}
                      {resolutionPhase === 2 && "Dispute window open \u2014 waiting for challenges..."}
                      {resolutionPhase === 3 && "First round voting \u2014 AI agents casting votes..."}
                      {resolutionPhase === 4 && "Discussion \u2014 3 AI agents debating the evidence..."}
                      {resolutionPhase === 5 && "Second round voting \u2014 final consensus forming..."}
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all duration-1000"
                        style={{ width: `${(resolutionPhase / 6) * 100}%` }} />
                    </div>
                  </div>
                )}

                {slashed && (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <p className="text-sm font-medium text-[#1a1a1a]">Market resolved: <span className="text-emerald-600 font-bold">Yes</span></p>
                    </div>

                    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                      <p className="text-red-600 font-bold text-sm">Bond slashed</p>
                      <p className="mt-1 text-sm text-red-500">
                        The AI audit confirmed malicious code was passed through. The result didn&apos;t change from the original proposal. Your bond of <strong>{slashedAmount} tDCAI</strong> has been slashed.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
