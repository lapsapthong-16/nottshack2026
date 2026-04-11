import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";

type ScanListItem = {
  scanId: string;
  name: string;
  version: string;
  risk: string;
  files: number;
  flags: number;
  date: string;
};

function riskColor(risk: string): string {
  switch (risk) {
    case "high":   return "bg-[#e85c5c] text-white";
    case "medium": return "bg-[#e8a85c] text-white";
    case "low":    return "bg-[#e8d85c] text-[#1a1a1a]";
    default:       return "bg-[#4ade80] text-[#1a1a1a]";
  }
}

function riskLabel(risk: string): string {
  switch (risk) {
    case "high":   return "High";
    case "medium": return "Medium";
    case "low":    return "Low";
    default:       return "None";
  }
}

export default function Report() {
  const [scans, setScans] = useState<ScanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit/scan")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load scans (${r.status})`);
        return r.json();
      })
      .then((data: ScanListItem[]) => {
        setScans(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const totalScanned = scans.length;
  const totalFlagged = scans.filter((p) => p.flags > 0).length;
  const totalSafe = totalScanned - totalFlagged;

  return (
    <>
      <Head>
        <title>Validus — Public Audit Reports</title>
      </Head>

      <div className="min-h-screen bg-[#f0ebe4] text-[#1a1a1a]">
        <Header />

        <main className="mx-auto max-w-5xl px-6 py-10">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a]">
            Public Audit Reports
          </h1>
          <p className="mt-2 text-sm text-[#6b6b6b]">
            Packages scanned by the community. Results published on-chain.
          </p>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                Total scanned
              </p>
              <p className="mt-2 text-3xl font-bold text-[#1a1a1a]">
                {loading ? "—" : totalScanned}
              </p>
            </div>
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                Flagged
              </p>
              <p className="mt-2 text-3xl font-bold text-[#e85c5c]">
                {loading ? "—" : totalFlagged}
              </p>
            </div>
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                Safe
              </p>
              <p className="mt-2 text-3xl font-bold text-[#2d7a2d]">
                {loading ? "—" : totalSafe}
              </p>
            </div>
            <div className="rounded-xl border border-[#e0dbd4] bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8a8580]">
                Total flags
              </p>
              <p className="mt-2 text-3xl font-bold text-[#1a1a1a]">
                {loading ? "—" : scans.reduce((sum, p) => sum + p.flags, 0)}
              </p>
            </div>
          </div>

          {/* Loading / Error */}
          {loading && (
            <div className="mt-12 text-center text-sm text-[#8a8580]">
              Loading audit data…
            </div>
          )}
          {error && (
            <div className="mt-12 rounded-xl border border-[#e85c5c33] bg-[#e85c5c11] p-4 text-sm text-[#e85c5c]">
              {error}
            </div>
          )}
          {!loading && !error && scans.length === 0 && (
            <div className="mt-12 text-center">
              <p className="text-sm text-[#8a8580]">No audits yet.</p>
              <Link
                href="/"
                className="mt-3 inline-block text-sm font-medium text-[#b8a9c8] hover:text-[#8a7a9a]"
              >
                Run your first audit →
              </Link>
            </div>
          )}

          {/* Package table */}
          {!loading && scans.length > 0 && (
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
                      Date
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {scans.map((pkg) => (
                    <tr
                      key={pkg.scanId}
                      className="border-b border-[#f0ebe4] transition hover:bg-[#faf8f5]"
                    >
                      <td className="px-5 py-3.5 font-medium text-[#1a1a1a]">
                        {pkg.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-[#6b6b6b]">
                        {pkg.version}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${riskColor(pkg.risk)}`}
                        >
                          {riskLabel(pkg.risk)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#6b6b6b]">
                        {pkg.files}
                      </td>
                      <td className="px-5 py-3.5">
                        {pkg.flags > 0 ? (
                          <span className="font-medium text-[#e85c5c]">
                            {pkg.flags}
                          </span>
                        ) : (
                          <span className="text-[#a8a09a]">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#a8a09a]">
                        {pkg.date}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/report/${pkg.scanId}`}
                          className="text-xs font-medium text-[#b8a9c8] transition hover:text-[#8a7a9a]"
                        >
                          View audit →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
