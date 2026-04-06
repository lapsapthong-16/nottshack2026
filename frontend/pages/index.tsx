import Head from "next/head";
import { Geist, Geist_Mono } from "next/font/google";
import { useState } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  const [statusLoading, setStatusLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [fundLoading, setFundLoading] = useState(false);

  const [statusResponse, setStatusResponse] = useState<unknown | null>(null);
  const [walletResponse, setWalletResponse] = useState<unknown | null>(null);
  const [fundResponse, setFundResponse] = useState<unknown | null>(null);

  const [statusError, setStatusError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);

  const [fundAddress, setFundAddress] = useState("");

  async function handleStatusTest() {
    setStatusLoading(true);
    setStatusError(null);

    try {
      const response = await fetch("/api/dash-status");
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      setStatusResponse(data);
    } catch (error) {
      setStatusResponse(null);
      setStatusError(
        error instanceof Error ? error.message : "Failed to fetch status",
      );
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleCreateWallet() {
    setWalletLoading(true);
    setWalletError(null);

    try {
      const response = await fetch("/api/wallet/create", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      setWalletResponse(data);

      const address =
        typeof data.wallet?.platformAddress === "string"
          ? data.wallet.platformAddress
          : "";

      if (address) {
        setFundAddress(address);
      }
    } catch (error) {
      setWalletResponse(null);
      setWalletError(
        error instanceof Error ? error.message : "Failed to create wallet",
      );
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleFundWallet() {
    setFundLoading(true);
    setFundError(null);

    try {
      const response = await fetch("/api/wallet/fund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: fundAddress }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      setFundResponse(data);
    } catch (error) {
      setFundResponse(null);
      setFundError(
        error instanceof Error ? error.message : "Failed to prepare funding",
      );
    } finally {
      setFundLoading(false);
    }
  }

  const fundingUrl =
    fundResponse &&
    typeof fundResponse === "object" &&
    "funding" in fundResponse &&
    fundResponse.funding &&
    typeof fundResponse.funding === "object" &&
    "fundingUrl" in fundResponse.funding &&
    typeof fundResponse.funding.fundingUrl === "string"
      ? fundResponse.funding.fundingUrl
      : null;

  const endpoints = [
    {
      method: "GET",
      route: "/api/dash-status",
      title: "Platform Status",
      description: "Checks the Evo SDK connection and returns Dash testnet status.",
      actionLabel: statusLoading ? "Sending..." : "Send Request",
      onAction: handleStatusTest,
      loading: statusLoading,
      error: statusError,
      requestBody: null,
      responseBody: statusResponse,
    },
    {
      method: "POST",
      route: "/api/wallet/create",
      title: "Create Wallet",
      description:
        "Generates a new testnet mnemonic, derives the first BIP44 key, and returns a platform address.",
      actionLabel: walletLoading ? "Creating..." : "Send Request",
      onAction: handleCreateWallet,
      loading: walletLoading,
      error: walletError,
      requestBody: {},
      responseBody: walletResponse,
    },
    {
      method: "POST",
      route: "/api/wallet/fund",
      title: "Fund Wallet",
      description:
        "Validates a platform address and returns the bridge URL used to request test funds.",
      actionLabel: fundLoading ? "Preparing..." : "Send Request",
      onAction: handleFundWallet,
      loading: fundLoading,
      error: fundError,
      requestBody: {
        address: fundAddress || "tb1...",
      },
      responseBody: fundResponse,
    },
  ];

  return (
    <>
      <Head>
        <title>Dash API Route Tester</title>
      </Head>
      <div
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[linear-gradient(135deg,_#07111f_0%,_#10233d_48%,_#f3efe5_48%,_#f7f3ec_100%)] text-slate-950`}
      >
        <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-6 py-10 sm:px-10 lg:py-14">
          <section className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/75 p-8 text-white shadow-[0_24px_80px_rgba(2,8,23,0.45)] backdrop-blur">
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan-300">
                API Route Lab
              </p>
              <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Test Dash Platform routes without leaving the frontend.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                This page behaves like a focused API client for your local Next.js
                server. It can check platform connectivity, create a new wallet,
                and prepare the testnet funding request for the generated platform
                address.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
                    Route 01
                  </p>
                  <p className="mt-3 text-lg font-semibold">Platform status</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Confirms the Evo SDK can talk to Dash testnet.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
                    Route 02
                  </p>
                  <p className="mt-3 text-lg font-semibold">Create wallet</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Generates mnemonic, derivation path, and platform address.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
                    Route 03
                  </p>
                  <p className="mt-3 text-lg font-semibold">Fund wallet</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Returns the funding bridge URL for the selected address.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/10 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-700">
                    Funding Input
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    Wallet address under test
                  </h2>
                </div>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-4 py-2 font-mono text-xs uppercase tracking-[0.25em] text-amber-700">
                  Testnet Only
                </span>
              </div>
              <label
                htmlFor="fund-address"
                className="mt-6 block text-sm font-medium text-slate-700"
              >
                Platform address
              </label>
              <textarea
                id="fund-address"
                value={fundAddress}
                onChange={(event) => setFundAddress(event.target.value)}
                placeholder="tb1..."
                className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white"
              />
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Creating a wallet auto-fills this field. You can also paste any
                testnet platform address here and send it to the funding route.
              </p>
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-400">
                  Request Body Preview
                </p>
                <pre className="mt-3 overflow-x-auto font-mono text-sm leading-7 text-slate-100">
                  {JSON.stringify({ address: fundAddress || "tb1..." }, null, 2)}
                </pre>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            {endpoints.map((endpoint) => (
              <article
                key={endpoint.route}
                className="overflow-hidden rounded-[1.75rem] border border-black/10 bg-white/88 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur"
              >
                <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-300">
                        {endpoint.title}
                      </p>
                      <p className="mt-2 text-sm text-slate-300">
                        {endpoint.description}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 font-mono text-xs font-semibold text-cyan-200">
                      {endpoint.method}
                    </span>
                  </div>
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-slate-200">
                    {endpoint.route}
                  </div>
                </div>

                <div className="space-y-5 p-6">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-500">
                      Request
                    </p>
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-100 p-4 font-mono text-sm leading-7 text-slate-800">
                      {endpoint.requestBody === null
                        ? "// No request body"
                        : JSON.stringify(endpoint.requestBody, null, 2)}
                    </pre>
                  </div>

                  <button
                    type="button"
                    onClick={endpoint.onAction}
                    disabled={endpoint.loading}
                    className="w-full rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {endpoint.actionLabel}
                  </button>

                  {endpoint.error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {endpoint.error}
                    </div>
                  ) : null}

                  {endpoint.route === "/api/wallet/fund" && fundingUrl ? (
                    <a
                      href={fundingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                    >
                      Open Funding Page
                    </a>
                  ) : null}

                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.24em] text-slate-500">
                      Response
                    </p>
                    <pre className="mt-3 min-h-72 overflow-x-auto rounded-2xl bg-slate-950 p-4 font-mono text-sm leading-7 text-slate-100">
                      {endpoint.responseBody
                        ? JSON.stringify(endpoint.responseBody, null, 2)
                        : '{\n  "message": "No response yet."\n}'}
                    </pre>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </main>
      </div>
    </>
  );
}
