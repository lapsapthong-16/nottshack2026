import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";
import React from 'react';

type AuditDocument = {
  id: string;
  pkgName: string;
  version: string;
  riskScore: number;
  malwareDetected: boolean;
  summary: string;
  findingsCount?: number;
  snippetsCount?: number;
  filesCount?: number;

  [key: string]: any;
};

function riskColor(risk: number): string {
  if (risk >= 80) return "bg-[#e85c5c] text-white";
  if (risk >= 50) return "bg-[#e8a85c] text-white";
  if (risk >= 20) return "bg-[#e8d85c] text-[#1a1a1a]";
  return "bg-[#4ade80] text-[#1a1a1a]";
}

function riskLabel(risk: number): string {
  if (risk >= 80) return "Critical";
  if (risk >= 50) return "Warning";
  if (risk >= 20) return "Low";
  return "Safe";
}

export default function Report() {
  const [documents, setDocuments] = useState<AuditDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, { findings: any[], snippets: any[] }>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/evoguard/document/query")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setDocuments(data.documents);
        } else {
          setError(data.error || "Failed to fetch reports");
        }
      })
      .catch((err) => {
        setError("Connection error");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(id);

    if (!details[id]) {
      setLoadingDetails(id);
      try {
        const res = await fetch(`/api/evoguard/document/details?reportId=${id}`);
        const data = await res.json();
        if (data.ok) {
          setDetails(prev => ({ ...prev, [id]: { findings: data.findings, snippets: data.snippets } }));
        }
      } catch (err) {
        console.error("Failed to fetch details:", err);
      } finally {
        setLoadingDetails(null);
      }
    }
  }

  const totalScanned = documents.length;
  const totalFlagged = documents.filter((p) => p.malwareDetected || (p.findingsCount && p.findingsCount > 0)).length;
  const totalSafe = totalScanned - totalFlagged;
  const avgRisk =
    totalScanned > 0
      ? documents.reduce((sum, p) => sum + (p.riskScore || 0), 0) / totalScanned
      : 0;

  return (
    <>
      <Head>
        <title>Public Audits | EvoGuard</title>
      </Head>
      <div className="min-h-screen bg-[#f7f3ee]">
        <Header />

        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">
                Public Audit Reports
              </h1>
              <p className="mt-2 text-sm text-[#6b6b6b]">
                Packages scanned by the community. Results published on the Dash Platform.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-20 flex flex-col items-center justify-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b8a9c8] border-t-transparent"></div>
              <p className="text-sm text-[#6b6b6b]">Querying Dash Platform...</p>
            </div>
          ) : error ? (
            <div className="mt-20 rounded-xl border border-red-200 bg-red-50 p-10 text-center">
              <p className="text-red-600 font-medium">Error: {error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 text-sm font-medium text-red-700 underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                    Total scanned
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#1a1a1a]">
                    {totalScanned}
                  </p>
                </div>
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                    Flagged
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#e85c5c]">
                    {totalFlagged}
                  </p>
                </div>
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                    Safe
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#2d7a2d]">
                    {totalSafe}
                  </p>
                </div>
                <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                    Avg risk
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[#1a1a1a]">
                    {(avgRisk / 10).toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Table */}
              <div className="mt-8 overflow-hidden rounded-xl border border-[#e0dbd4] bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#e0dbd4] bg-[#f7f3ee]">
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                        Package
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                        Version
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                        Risk
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                        Files
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                        Flags
                      </th>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                        ID
                      </th>

                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <React.Fragment key={doc.id}>
                        <tr
                          className={`border-b border-[#f0ebe4] transition hover:bg-[#faf8f5] cursor-pointer ${expandedId === doc.id ? 'bg-[#faf8f5]' : ''}`}
                          onClick={() => handleExpand(doc.id)}
                        >
                          <td className="px-5 py-3.5 font-medium text-[#1a1a1a]">
                            {doc.pkgName}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-[#6b6b6b]">
                            {doc.version}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${riskColor(doc.riskScore)}`}
                            >
                              {(doc.riskScore / 10).toFixed(1)}
                              <span className="text-[10px] font-medium opacity-80 uppercase">
                                {riskLabel(doc.riskScore)}
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs text-[#6b6b6b] bg-[#f0f0f0] px-1.5 py-0.5 rounded">
                              {doc.filesCount || 0}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {doc.findingsCount && doc.findingsCount > 0 ? (
                              <span className="font-bold text-[#e85c5c] flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-[#e85c5c]" />
                                {doc.findingsCount}
                              </span>
                            ) : (
                              <span className="text-[#a8a09a]">0</span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-xs font-mono text-[#a8a09a]">
                            {doc.id.substring(0, 8)}...
                          </td>
                          <td className="px-5 py-3.5 text-right flex items-center justify-end gap-3">
                            <a
                              href={`https://testnet.platform-explorer.com/document/${doc.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-[#f3f0ff] px-2 py-1 text-[10px] font-bold text-[#8b6fad] hover:bg-[#e9e2ff] transition"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Explorer
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                            <button className="text-xs font-medium text-[#b8a9c8] hover:text-[#8a7a9a]">
                              {expandedId === doc.id ? "Hide Details" : "View Details"}
                            </button>
                          </td>
                        </tr>
                        {expandedId === doc.id && (
                          <tr className="bg-[#fcfaf8] border-b border-[#f0ebe4]">
                            <td colSpan={6} className="px-8 py-6">
                              <div className="space-y-8 animate-fadeIn">
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8a8580] mb-3">Security Summary</h4>
                                  <div className="rounded-lg border border-[#e0dbd4] bg-white p-4 text-sm leading-relaxed text-[#4a4a4a] whitespace-pre-wrap shadow-sm">
                                    {doc.summary || "No summary provided."}
                                  </div>
                                </div>

                                {loadingDetails === doc.id ? (
                                  <div className="flex items-center gap-3 text-sm text-[#8a8580]">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#b8a9c8] border-t-transparent" />
                                    Querying Dash Platform fragments...
                                  </div>
                                ) : details[doc.id] ? (
                                  <>
                                    {details[doc.id].findings.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#8a8580] mb-3">
                                          Detailed Findings ({details[doc.id].findings.length})
                                        </h4>
                                        <div className="space-y-3">
                                          {details[doc.id].findings.map((finding, idx) => (
                                            <div key={idx} className="rounded-lg border border-[#e0dbd4] bg-white p-4 shadow-sm border-l-4 border-l-[#e85c5c]">
                                              <div className="flex items-center gap-3 mb-2">
                                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                                  finding.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                                  finding.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                                  'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                  {finding.severity}
                                                </span>
                                                <span className="font-mono text-xs font-medium text-[#1a1a1a]">{finding.file}</span>
                                              </div>
                                              <p className="text-sm text-[#4a4a4a] leading-relaxed">{finding.reasoning}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {details[doc.id].snippets.length > 0 && (
                                      <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#8a8580] mb-3">
                                          Forensic Evidence
                                        </h4>
                                        <div className="space-y-4">
                                          {details[doc.id].snippets.map((snippet, idx) => {
                                            const lineStartOffset = snippet.lineStart || 1;
                                            
                                            // Parse all flagged lines for this report
                                            const allFlaggedLines = details[doc.id].findings.reduce((acc: number[], f) => {
                                              if (f.file === snippet.file && f.lineNumbers) {
                                                const nums = f.lineNumbers.split(',').map((n: string) => parseInt(n)).filter((n: number) => !isNaN(n));
                                                return [...acc, ...nums];
                                              }
                                              return acc;
                                            }, []);

                                            const content = (() => {
                                              if (typeof window === 'undefined') return '';
                                              try {
                                                const c = snippet.content;
                                                if (Array.isArray(c)) return new TextDecoder().decode(new Uint8Array(c));
                                                if (typeof c === 'string') {
                                                  if (c.match(/^[A-Za-z0-9+/=]+$/)) return window.atob(c);
                                                  return c;
                                                }
                                                return "";
                                              } catch (e) { return "Decoding error."; }
                                            })();

                                            const lines = content.split('\n');

                                            return (
                                              <div key={idx} className="overflow-hidden rounded-lg border border-[#e0dbd4] bg-[#f7f3ee] shadow-sm">
                                                <div className="border-b border-[#e0dbd4] bg-[#ebe6e0] px-3 py-1.5 text-[10px] font-mono text-[#8a8580] flex justify-between">
                                                  <span>{snippet.file} : Lines {snippet.lineStart}-{snippet.lineEnd}</span>
                                                  {snippet.isMultipart && <span className="text-[#8b6fad] font-bold">RECONSTRUCTED</span>}
                                                </div>
                                                <div className="overflow-x-auto bg-[#1e1e1e] p-0">
                                                  <table className="w-full border-collapse font-mono text-[11px] leading-5">
                                                    <tbody>
                                                      {lines.map((line, lineIdx) => {
                                                        const currentLineNum = lineStartOffset + lineIdx;
                                                        const isFlagged = allFlaggedLines.includes(currentLineNum);
                                                        return (
                                                          <tr key={lineIdx} className={isFlagged ? "bg-[#4a1c1c] border-l-4 border-l-[#e85c5c]" : ""}>
                                                            <td className="w-10 select-none px-2 text-right text-[#5a5a5a] border-r border-[#333]">
                                                              {currentLineNum}
                                                            </td>
                                                            <td className={`px-4 whitespace-pre ${isFlagged ? "text-[#ffbaba]" : "text-[#d4d4d4]"}`}>
                                                              {line || " "}
                                                            </td>
                                                          </tr>
                                                        );
                                                      })}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                  </>
                                ) : (
                                  <div className="text-sm text-[#8a8580]">
                                    No forensic fragments discovered for this report.
                                  </div>
                                )}

                                <div className="pt-4 border-t border-[#f0ebe4]">
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#bbb6b0] mb-2">Metadata</h4>
                                  <pre className="text-[9px] text-[#bbb6b0] font-mono whitespace-pre-wrap bg-[#fcfaf8] p-2 rounded border border-[#f0ebe4]">
                                    Report Document ID: {doc.id}
                                    {doc.auditorSignature && `\nAuditor Signature: ${doc.auditorSignature}`}
                                    {`\nFragments: ${doc.findingsCount || 0} findings, ${doc.snippetsCount || 0} snippets`}
                                  </pre>
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
            </>
          )}
        </main>
      </div>
    </>
  );
}
