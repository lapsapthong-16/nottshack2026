import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import React from 'react';

type DashDocument = {
  id: string;
  pkgName: string;
  version: string;
  riskScore: number;
  malwareDetected: boolean;
  summary: string;
  files?: number;
  flags?: number;
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
  const [documents, setDocuments] = useState<DashDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/evoguard/document/query")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setDocuments(data.documents);
        } else {
          setError(data.error || "Failed to fetch documents");
        }
      })
      .catch((err) => {
        setError(err.message || "An error occurred while fetching documents");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const totalScanned = documents.length;
  const totalFlagged = documents.filter((p) => p.malwareDetected).length;
  const totalSafe = totalScanned - totalFlagged;
  const avgRisk =
    totalScanned > 0
      ? documents.reduce((sum, p) => sum + (p.riskScore || 0), 0) / totalScanned
      : 0;

  return (
    <>
      <Head>
        <title>Validus — Public Audit Reports (On-chain)</title>
      </Head>

      <div className="min-h-screen bg-[#f0ebe4] text-[#1a1a1a]">
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
            <div className="flex items-center gap-2 rounded-full bg-[#e8f5e8] px-3 py-1 text-xs font-semibold text-[#2d7a2d] border border-[#d0e8d0]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2d7a2d] animate-pulse" />
              Live On-chain
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
                    {(avgRisk/10).toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Document table */}
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
                          className="border-b border-[#f0ebe4] transition hover:bg-[#faf8f5] cursor-pointer"
                          onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
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
                              <span className="text-[10px] font-medium opacity-80">
                                {riskLabel(doc.riskScore)}
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-[#6b6b6b]">
                            {doc.files !== undefined ? doc.files : "-"}
                          </td>
                          <td className="px-5 py-3.5">
                            {doc.malwareDetected || (doc.flags && doc.flags > 0) ? (
                              <span className="font-medium text-[#e85c5c]">
                                {doc.flags || (doc.malwareDetected ? "1+" : "-")}
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
                            <td colSpan={7} className="px-8 py-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8a8580] mb-2">Summary</h4>
                                  <p className="text-sm leading-relaxed text-[#4a4a4a]">
                                    {doc.summary || "No summary provided."}
                                  </p>
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#8a8580] mb-2">Raw Dash Node Data</h4>
                                  <pre className="text-[10px] bg-white border border-[#e0dbd4] p-3 rounded-lg overflow-auto max-h-[300px] font-mono text-[#6b6b6b]">
                                    {JSON.stringify(doc, null, 2)}
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
