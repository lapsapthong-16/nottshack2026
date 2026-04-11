import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";
import { ethers } from "ethers";

const DCAI_CHAIN_ID = "0x4809";
const DCAI_RPC_PROXY = "http://localhost:3000/api/dcai/rpc";
const STAKING_CONTRACT = "0x2Fbc8aD3137991e77BC45f40c3B80e2c31B88842";
const STAKING_ABI = [
  "function burn(uint256) external",
  "function topUp() payable",
  "function getCredits(address) view returns (uint256)",
  "function getStake(address) view returns (uint256)",
];

type PaymentRoute = "dash" | "dcai";

type NpmResult = {
  name: string;
  version: string;
  description: string;
  publisher: string;
};

type QuoteResponse = {
  quoteId: string;
  package: string;
  version: string;
  paymentRoute: PaymentRoute;
  billableLines: number;
  estimatedMinutes: number;
  estimateTDash?: string;
  estimateTDcai?: string;
  estimateCredits: string;
  breakdown: {
    lineChargeCredits: string;
    timeChargeCredits: string;
  };
  expiresAt: string;
};

function getInjectedWallet() {
  if (typeof window === "undefined") return null;
  const win = window as Window & { ethereum?: any; okxwallet?: any };
  return win.okxwallet || win.ethereum || null;
}

export default function Landing() {
  const router = useRouter();
  const [packageName, setPackageName] = useState("");
  const [version, setVersion] = useState("latest");
  const [paymentRoute, setPaymentRoute] = useState<PaymentRoute | null>(null);
  const [searchResults, setSearchResults] = useState<NpmResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [versions, setVersions] = useState<string[]>(["latest"]);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isStartingDash, setIsStartingDash] = useState(false);
  const [isStartingDcai, setIsStartingDcai] = useState(false);
  const [dcaiWallet, setDcaiWallet] = useState<string | null>(null);
  const [dcaiCredits, setDcaiCredits] = useState<string | null>(null);
  const [dcaiStake, setDcaiStake] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("0.010");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [isRouteSelectorOpen, setIsRouteSelectorOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const versionRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "2") void router.push("/report2");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  useEffect(() => {
    if (!router.isReady) return;
    const routeFromQuery = typeof router.query.paymentRoute === "string" ? router.query.paymentRoute : null;
    if (routeFromQuery === "dash" || routeFromQuery === "dcai") {
      setPaymentRoute(routeFromQuery);
    }
  }, [router.isReady, router.query.paymentRoute]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (versionRef.current && !versionRef.current.contains(e.target as Node)) {
        setShowVersionDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const refreshDcaiBalances = useCallback(async (walletAddress: string) => {
    const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
    const contract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);
    const [credits, stake] = await Promise.all([
      contract.getCredits(walletAddress),
      contract.getStake(walletAddress),
    ]);
    setDcaiCredits(ethers.formatEther(credits));
    setDcaiStake(ethers.formatEther(stake));
  }, []);

  const ensureDcaiWalletConnected = useCallback(async () => {
    const injected = getInjectedWallet();
    if (!injected) throw new Error("Install OKX Wallet or MetaMask to use the DCAI route.");

    const accounts: string[] = await injected.request({ method: "eth_requestAccounts" });
    const walletAddress = accounts[0];

    try {
      await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: DCAI_CHAIN_ID }] });
    } catch (err: any) {
      if (err.code === 4902) {
        await injected.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: DCAI_CHAIN_ID,
            chainName: "DCAI L3 Testnet",
            nativeCurrency: { name: "tDCAI", symbol: "tDCAI", decimals: 18 },
            rpcUrls: ["http://139.180.188.61:8545"],
            blockExplorerUrls: ["http://139.180.140.143"],
          }],
        });
      } else {
        throw err;
      }
    }

    setDcaiWallet(walletAddress);
    await refreshDcaiBalances(walletAddress);
    return { injected, walletAddress };
  }, [refreshDcaiBalances]);

  const searchNpm = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/npm/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
      setShowDropdown((data.results ?? []).length > 0);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handlePackageInput(value: string) {
    setPackageName(value);
    setQuote(null);
    setQuoteError(null);
    setVersions(["latest"]);
    setVersion("latest");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void searchNpm(value);
    }, 300);
  }

  async function fetchVersions(name: string) {
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`/api/npm/versions?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.versions && data.versions.length > 0) {
        const versionList = data.versions.includes(data.latest)
          ? [`latest (${data.latest})`, ...data.versions.filter((v: string) => v !== data.latest)]
          : ["latest", ...data.versions];
        setVersions(versionList);
        setVersion("latest");
      }
    } catch {
      setVersions(["latest"]);
    } finally {
      setIsLoadingVersions(false);
    }
  }

  function selectPackage(pkg: NpmResult) {
    setPackageName(pkg.name);
    setShowDropdown(false);
    setSearchResults([]);
    void fetchVersions(pkg.name);
  }

  function selectVersion(v: string) {
    setVersion(v.startsWith("latest") ? "latest" : v);
    setShowVersionDropdown(false);
  }

  async function handleAudit(overrideRoute?: PaymentRoute) {
    if (!packageName.trim() || isCalculatingQuote) return;

    const route = overrideRoute || paymentRoute;

    if (!route) {
      setIsRouteSelectorOpen(true);
      return;
    }

    try {
      setIsCalculatingQuote(true);
      setQuoteError(null);
      setQuote(null);

      const response = await fetch("/api/audit/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: packageName.trim(),
          version: version.trim() || "latest",
          paymentRoute: route,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to calculate quote");
      }

      setQuote(data);
    } catch (e: unknown) {
      setQuoteError(e instanceof Error ? e.message : "Failed to calculate quote");
    } finally {
      setIsCalculatingQuote(false);
    }
  }

  async function handleDcaiTopUp() {
    try {
      setTopUpLoading(true);
      const { injected, walletAddress } = await ensureDcaiWalletConnected();
      const iface = new ethers.Interface(STAKING_ABI);
      await injected.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress,
          to: STAKING_CONTRACT,
          data: iface.encodeFunctionData("topUp"),
          value: `0x${ethers.parseEther(topUpAmount).toString(16)}`,
          gas: "0x40000",
        }],
      });
      await refreshDcaiBalances(walletAddress);
    } finally {
      setTopUpLoading(false);
    }
  }

  async function handleAcceptDashQuote() {
    if (!quote) return;
    setIsStartingDash(true);
    try {
      await router.push({
        pathname: "/check",
        query: {
          name: quote.package,
          version: quote.version,
          quoteId: quote.quoteId,
          paymentRoute: "dash",
        },
      });
    } finally {
      setIsStartingDash(false);
    }
  }

  async function handleAcceptDcaiQuote() {
    if (!quote) return;
    setIsStartingDcai(true);
    setQuoteError(null);

    try {
      const { injected, walletAddress } = await ensureDcaiWalletConnected();
      const burnAmount = quote.estimateTDcai ?? "0.004870";
      const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
      const contract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);
      const credits = await contract.getCredits(walletAddress);
      const burnWei = ethers.parseEther(burnAmount);

      if (credits < burnWei) {
        throw new Error(`Not enough DCAI credits. Top up at least ${burnAmount} tDCAI before starting the scan.`);
      }

      const iface = new ethers.Interface(STAKING_ABI);
      const txHash: string = await injected.request({
        method: "eth_sendTransaction",
        params: [{
          from: walletAddress,
          to: STAKING_CONTRACT,
          data: iface.encodeFunctionData("burn", [burnWei]),
          gas: "0x20000",
        }],
      });

      await refreshDcaiBalances(walletAddress);

      await router.push({
        pathname: "/check",
        query: {
          name: quote.package,
          version: quote.version,
          quoteId: quote.quoteId,
          paymentRoute: "dcai",
          dcaiTxHash: txHash,
        },
      });
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : "Failed to start DCAI scan");
    } finally {
      setIsStartingDcai(false);
    }
  }

  const dcaiConnected = Boolean(dcaiWallet);

  return (
    <>
      <Head>
        <title>Validus – Know what you install</title>
      </Head>

      <div className="min-h-screen bg-[#f0ebe4] text-[#1a1a1a]">
        <Header activeRoute={paymentRoute} />

        <main className="flex flex-col items-center px-6 pt-28 pb-20">
          <h1 className="text-center text-5xl font-bold leading-[1.15] tracking-tight text-[#1a1a1a] sm:text-6xl md:text-7xl">
            Know what
            <br />
            you install.
          </h1>

          <p className="mt-6 text-center text-sm leading-6 text-[#6b6b6b]">
            AI-powered security audit for npm packages.
            <br />
            Route the payment through DASH or DCAI before you estimate.
          </p>


          {paymentRoute === "dcai" && (
            <div className="mt-4 w-full max-w-2xl rounded-2xl border border-amber-300/50 bg-[#fffbf5] p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">DCAI Wallet</p>
                  <h2 className="mt-2 text-xl font-semibold text-[#1a1a1a]">Credits and staking</h2>
                  <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">
                    Connect a DCAI wallet, top up credits, and optionally review staking before you start the scan.
                  </p>
                  {dcaiConnected && (
                    <p className="mt-3 text-xs font-mono text-[#8a8580]">
                      {dcaiWallet?.slice(0, 6)}...{dcaiWallet?.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={() => void ensureDcaiWalletConnected()}
                    className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600"
                  >
                    {dcaiConnected ? "Refresh DCAI Wallet" : "Connect DCAI Wallet"}
                  </button>
                  <Link href="/dcai/stack" className="text-sm text-amber-700 hover:text-amber-800">
                    Open staking dashboard
                  </Link>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Credits</p>
                  <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">
                    {dcaiCredits ? `${parseFloat(dcaiCredits).toFixed(4)} tDCAI` : "Not connected"}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Stake</p>
                  <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">
                    {dcaiStake ? `${parseFloat(dcaiStake).toFixed(4)} tDCAI` : "Not connected"}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Quick Top Up</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => void handleDcaiTopUp()}
                      disabled={topUpLoading}
                      className="rounded-lg bg-[#1a1a1a] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {topUpLoading ? "..." : "Top Up"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!mounted ? (
            <div className="mt-10 h-[52px]" />
          ) : (
            <div className="mt-10 flex w-full max-w-2xl flex-col items-center gap-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleAudit();
                }}
                className="group relative flex w-full items-center rounded-xl border border-[#d6d0c8] bg-white shadow-sm transition-all focus-within:border-[#8b6fad]/50 focus-within:shadow-md"
              >
                <div className={`flex items-center rounded-l-xl border-r border-[#d6d0c8] px-4 py-3.5 font-mono text-sm transition-colors duration-300 ${packageName ? "bg-[#8b6fad]/10 text-[#8b6fad]" : "bg-[#f5f0ea] text-[#a8a8a8]"}`}>
                  npm install
                </div>

                <div ref={searchRef} className="relative flex-1">
                  <input
                    id="package-search"
                    type="text"
                    placeholder="package name"
                    autoComplete="off"
                    value={packageName}
                    onChange={(e) => handlePackageInput(e.target.value)}
                    onFocus={() => {
                      if (searchResults.length > 0) setShowDropdown(true);
                    }}
                    className="w-full border-none bg-transparent px-5 py-3.5 font-mono text-sm text-[#1a1a1a] placeholder-[#a8a8a8] outline-none"
                  />

                  {showDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-[#d6d0c8] bg-white shadow-lg">
                      {isSearching ? (
                        <div className="px-4 py-3 text-xs text-[#a8a8a8]">Searching npm...</div>
                      ) : (
                        searchResults.map((pkg, i) => (
                          <button
                            key={pkg.name}
                            type="button"
                            onClick={() => selectPackage(pkg)}
                            className="flex w-full cursor-pointer flex-col gap-0.5 border-none bg-transparent px-4 py-2.5 text-left transition hover:bg-[#f5f0ea]"
                            style={i < searchResults.length - 1 ? { borderBottom: "1px solid #eee" } : {}}
                          >
                            <span className="text-sm font-medium text-[#1a1a1a]">
                              {pkg.name}
                              <span className="ml-2 text-xs font-normal text-[#a8a8a8]">v{pkg.version}</span>
                            </span>
                            <span className="truncate text-xs text-[#888]">{pkg.description || "(no description)"}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="h-6 w-px bg-[#d6d0c8]" />

                <div ref={versionRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowVersionDropdown((v) => !v)}
                    disabled={isLoadingVersions}
                    className="flex w-24 cursor-pointer items-center justify-between border-none bg-transparent px-4 py-3.5 text-sm text-[#1a1a1a] outline-none sm:w-28"
                  >
                    <span className={version === "latest" ? "text-[#a8a8a8]" : ""}>{isLoadingVersions ? "..." : version}</span>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-1 flex-shrink-0">
                      <path d="M1 1L5 5L9 1" stroke="#a8a8a8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {showVersionDropdown && versions.length > 0 && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border border-[#d6d0c8] bg-white shadow-lg">
                      {versions.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => selectVersion(v)}
                          className={`flex w-full cursor-pointer items-center border-none bg-transparent px-4 py-2.5 text-left text-sm transition hover:bg-[#f5f0ea] ${
                            v === version || (v.startsWith("latest") && version === "latest") ? "font-medium text-[#8b6fad]" : "text-[#1a1a1a]"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isCalculatingQuote}
                  className="ml-1 mr-1.5 cursor-pointer rounded-lg bg-[#b8a9c8] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#a494b4] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCalculatingQuote ? "Calculating..." : "Audit"}
                </button>
              </form>


              {quoteError && (
                <div className="w-full rounded-xl border border-[#e85c5c33] bg-[#e85c5c11] px-4 py-3 text-sm text-[#b14a4a]">
                  {quoteError}
                </div>
              )}

              {quote && paymentRoute === "dash" && (
                <div className="w-full rounded-2xl border border-[#d6d0c8] bg-white p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">DASH Estimate</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#1a1a1a]">
                    {quote.package}<span className="ml-2 font-mono text-sm text-[#8a8580]">@{quote.version}</span>
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Ceiling</p>
                      <p className="mt-1 text-lg font-semibold">{quote.estimateTDash} tDASH</p>
                    </div>
                    <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Billable Lines</p>
                      <p className="mt-1 text-lg font-semibold">{quote.billableLines}</p>
                    </div>
                    <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Estimated Minutes</p>
                      <p className="mt-1 text-lg font-semibold">{quote.estimatedMinutes}</p>
                    </div>
                    <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Approved Credits</p>
                      <p className="mt-1 text-lg font-semibold">{quote.estimateCredits}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#6b6b6b]">
                    Run the AI scan first, then approve the final tDASH amount in the Dash wallet extension.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[#8a8580]">Quote expires at {new Date(quote.expiresAt).toLocaleTimeString()}.</p>
                    <button
                      type="button"
                      onClick={() => void handleAcceptDashQuote()}
                      disabled={isStartingDash}
                      className="rounded-xl bg-[#1a1a1a] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {isStartingDash ? "Starting Scan..." : "Start Scan with DASH"}
                    </button>
                  </div>
                </div>
              )}

              {quote && paymentRoute === "dcai" && (
                <div className="w-full rounded-2xl border border-amber-300/50 bg-[#fffbf5] p-5 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">DCAI Estimate</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#1a1a1a]">
                    {quote.package}<span className="ml-2 font-mono text-sm text-[#8a8580]">@{quote.version}</span>
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Charge</p>
                      <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">{quote.estimateTDcai} tDCAI</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Billable Lines</p>
                      <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">{quote.billableLines}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Estimated Minutes</p>
                      <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">{quote.estimatedMinutes}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Backed By</p>
                      <p className="mt-1 text-sm font-semibold text-[#1a1a1a]">Dash Drive publish from backend identity</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#6b6b6b]">
                    Your DCAI wallet will burn credits now. After the scan, Validus publishes the report to Dash Drive from the configured server identity.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[#8a8580]">Quote expires at {new Date(quote.expiresAt).toLocaleTimeString()}.</p>
                    <button
                      type="button"
                      onClick={() => void handleAcceptDcaiQuote()}
                      disabled={isStartingDcai}
                      className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
                    >
                      {isStartingDcai ? "Burning & Starting..." : "Pay with tDCAI & Start Scan"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {isRouteSelectorOpen && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300"
            onClick={() => setIsRouteSelectorOpen(false)}
          >
            <div 
              className="w-full max-w-2xl rounded-3xl border border-[#d6d0c8] bg-white p-8 shadow-2xl animate-in zoom-in-95 duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#1a1a1a]">Choose Payment Route</h2>
                  <p className="mt-1 text-sm text-[#6b6b6b]">Select how you would like to pay for this security audit.</p>
                </div>
                <button 
                  onClick={() => setIsRouteSelectorOpen(false)}
                  className="rounded-full p-2 text-[#8a8580] transition hover:bg-[#f5f0ea] hover:text-[#1a1a1a]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentRoute("dash");
                    setQuote(null);
                    setQuoteError(null);
                    setIsRouteSelectorOpen(false);
                    void handleAudit("dash");
                  }}
                  className={`group rounded-2xl border p-5 text-left transition ${paymentRoute === "dash" ? "border-[#1a1a1a] bg-[#faf8f5]" : "border-[#e6dfd7] bg-white hover:border-[#b7aea5]"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">DASH Route</p>
                    {paymentRoute === "dash" && <div className="h-2 w-2 rounded-full bg-[#1a1a1a]" />}
                  </div>
                  <h3 className="mt-3 text-xl font-bold">Dash wallet extension</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b]">
                    Estimate in tDASH, run the AI scan, then approve the exact final amount in the Dash extension.
                  </p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-[#1a1a1a] opacity-0 transition group-hover:opacity-100">
                    Select DASH &rarr;
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentRoute("dcai");
                    setQuote(null);
                    setQuoteError(null);
                    setIsRouteSelectorOpen(false);
                    void handleAudit("dcai");
                  }}
                  className={`group rounded-2xl border p-5 text-left transition ${paymentRoute === "dcai" ? "border-amber-400 bg-[#fffbf5]" : "border-[#e6dfd7] bg-white hover:border-amber-300"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">DCAI Route</p>
                    {paymentRoute === "dcai" && <div className="h-2 w-2 rounded-full bg-amber-500" />}
                  </div>
                  <h3 className="mt-3 text-xl font-bold">Top up and pay with tDCAI</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#6b6b6b]">
                    Fund credits, burn tDCAI to start the scan, then let the backend publish the result to Dash Drive.
                  </p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-amber-600 opacity-0 transition group-hover:opacity-100">
                    Select DCAI &rarr;
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
