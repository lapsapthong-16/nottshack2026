import Head from "next/head";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { useEffect, useState } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

type WalletResponse = {
  ok: true;
  wallet: {
    network: string;
    address: string;
    derivationPath: string;
    balance: string | number;
    nonce: string | number;
    fundingUrl: string;
    identityId: string | null;
  };
};

export default function Home() {
  const [wallet, setWallet] = useState<WalletResponse["wallet"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadWallet() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wallet/info");
      const data = (await response.json()) as
        | WalletResponse
        | { ok: false; error: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? "Request failed" : data.error);
      }

      setWallet(data.wallet);
    } catch (requestError) {
      setWallet(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load wallet dashboard",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadWallet();
  }, []);

  return (
    <>
      <Head>
        <title>Dash Credit Wallet Dashboard</title>
      </Head>
      <div
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[radial-gradient(circle_at_top_left,_#d4f7e8_0%,_#f5fbf8_35%,_#eef4ff_100%)] text-slate-950`}
      >
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:py-14">
          <header className="flex flex-col gap-6 rounded-[2rem] border border-emerald-100 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-emerald-700">
                Credit Wallet Dashboard
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Monitor your Dash Platform address, credits, and funding path.
              </h1>
              <p className="mt-4 text-base leading-8 text-slate-600">
                This page derives the primary platform address from your configured
                mnemonic, checks its latest balance and nonce, and gives you a direct
                route into the testnet funding bridge.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadWallet()}
                disabled={isLoading}
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isLoading ? "Refreshing..." : "Refresh Wallet"}
              </button>
              <Link
                href="/testing"
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Open Testing Page
              </Link>
            </div>
          </header>

          {error ? (
            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <article className="rounded-[2rem] border border-white/60 bg-slate-950 p-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-emerald-300">
                    Primary Address
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Derived from `PLATFORM_MNEMONIC`
                  </p>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-emerald-200">
                  {wallet?.network ?? "loading"}
                </span>
              </div>
              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">
                  Bech32m Address
                </p>
                <p className="mt-3 break-all font-mono text-sm leading-7 text-white">
                  {wallet?.address ?? "Loading address..."}
                </p>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">
                    Balance
                  </p>
                  <p className="mt-3 text-3xl font-semibold">
                    {wallet ? String(wallet.balance) : "--"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">
                    Nonce
                  </p>
                  <p className="mt-3 text-3xl font-semibold">
                    {wallet ? String(wallet.nonce) : "--"}
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white/85 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-700">
                Wallet Details
              </p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Derivation Path</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">
                    {wallet?.derivationPath ?? "Loading derivation path..."}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Identity</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">
                    {wallet?.identityId ?? "No registered identity detected"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Funding Bridge</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">
                    {wallet?.fundingUrl ?? "Loading funding URL..."}
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={wallet?.fundingUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition ${
                    wallet?.fundingUrl
                      ? "bg-emerald-600 text-white hover:bg-emerald-500"
                      : "cursor-not-allowed bg-slate-200 text-slate-500"
                  }`}
                >
                  Open Funding Page
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (wallet?.address) {
                      void navigator.clipboard.writeText(wallet.address);
                    }
                  }}
                  disabled={!wallet?.address}
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  Copy Address
                </button>
              </div>
            </article>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            <article className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-500">
                Route Used
              </p>
              <p className="mt-3 font-mono text-sm text-slate-900">GET /api/wallet/info</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Pulls the primary derived platform address plus current address info
                from Dash Platform.
              </p>
            </article>
            <article className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-500">
                Data Source
              </p>
              <p className="mt-3 font-mono text-sm text-slate-900">frontend/.env</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                The dashboard derives this wallet from `PLATFORM_MNEMONIC` and the
                configured `NETWORK`.
              </p>
            </article>
            <article className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-500">
                Next Step
              </p>
              <p className="mt-3 font-mono text-sm text-slate-900">Create Identity</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Once credits are available, the next useful dashboard action is
                identity creation and status inspection.
              </p>
            </article>
          </section>
        </main>
      </div>
    </>
  );
}
