import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";

type ScannedPackage = {
  name: string;
  version: string;
  risk: number;
  files: number;
  flags: number;
  date: string;
};

const scannedPackages: ScannedPackage[] = [
  {
    name: "event-stream",
    version: "3.3.6",
    risk: 10,
    files: 8,
    flags: 3,
    date: "2026-04-10",
  },
  {
    name: "ua-parser-js",
    version: "0.7.29",
    risk: 8,
    files: 5,
    flags: 2,
    date: "2026-04-09",
  },
  {
    name: "colors",
    version: "1.4.1",
    risk: 9,
    files: 6,
    flags: 2,
    date: "2026-04-09",
  },
  {
    name: "node-ipc",
    version: "10.1.0",
    risk: 10,
    files: 12,
    flags: 4,
    date: "2026-04-08",
  },
  {
    name: "lodash",
    version: "4.17.21",
    risk: 0,
    files: 42,
    flags: 0,
    date: "2026-04-08",
  },
  {
    name: "express",
    version: "4.18.2",
    risk: 1,
    files: 35,
    flags: 0,
    date: "2026-04-07",
  },
  {
    name: "chalk",
    version: "5.3.0",
    risk: 0,
    files: 4,
    flags: 0,
    date: "2026-04-07",
  },
  {
    name: "flatmap-stream",
    version: "0.1.1",
    risk: 10,
    files: 3,
    flags: 3,
    date: "2026-04-06",
  },
];

function riskColor(risk: number): string {
  if (risk >= 8) return "bg-[#e85c5c] text-white";
  if (risk >= 5) return "bg-[#e8a85c] text-white";
  if (risk >= 2) return "bg-[#e8d85c] text-[#1a1a1a]";
  return "bg-[#4ade80] text-[#1a1a1a]";
}

function riskLabel(risk: number): string {
  if (risk >= 8) return "Critical";
  if (risk >= 5) return "Warning";
  if (risk >= 2) return "Low";
  return "Safe";
}

export default function Report() {
  const totalScanned = scannedPackages.length;
  const totalFlagged = scannedPackages.filter((p) => p.flags > 0).length;
  const totalSafe = totalScanned - totalFlagged;
  const avgRisk =
    scannedPackages.reduce((sum, p) => sum + p.risk, 0) / totalScanned;

  return (
    <>
      <Head>
        <title>NpmGuard — Public Audit Reports</title>
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
                {avgRisk.toFixed(1)}
              </p>
            </div>
          </div>

          {/* Package table */}
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
                {scannedPackages.map((pkg) => (
                  <tr
                    key={`${pkg.name}@${pkg.version}`}
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
                        {pkg.risk}
                        <span className="text-[10px] font-medium opacity-80">
                          {riskLabel(pkg.risk)}
                        </span>
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
                        href={{
                          pathname: "/check",
                          query: { name: pkg.name },
                        }}
                        className="text-xs font-medium text-[#b8a9c8] transition hover:text-[#8a7a9a]"
                      >
                        View audit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </>
  );
}
