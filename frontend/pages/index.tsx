import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Header from "@/components/Header";

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
  billableLines: number;
  estimatedMinutes: number;
  estimateTDash: string;
  estimateCredits: string;
  breakdown: {
    lineChargeCredits: string;
    timeChargeCredits: string;
  };
  expiresAt: string;
};

export default function Landing() {
  const router = useRouter();
  const [packageName, setPackageName] = useState("");
  const [version, setVersion] = useState("latest");

  // ── Package search autocomplete state ──
  const [searchResults, setSearchResults] = useState<NpmResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Version dropdown state ──
  const [versions, setVersions] = useState<string[]>(["latest"]);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const versionRef = useRef<HTMLDivElement>(null);

  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [expandDash, setExpandDash] = useState(false);
  const [expandDcai, setExpandDcai] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Press "2" to go to /report2
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "2") router.push("/report2");
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // ── Debounced npm search ──
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
    // Reset versions when package name changes
    setVersions(["latest"]);
    setVersion("latest");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchNpm(value), 300);
  }

  // ── Fetch versions for a selected package ──
  async function fetchVersions(name: string) {
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`/api/npm/versions?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (data.versions && data.versions.length > 0) {
        // Prepend "latest" label if not already there
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
    fetchVersions(pkg.name);
  }

  function selectVersion(v: string) {
    // If it's the "latest (x.y.z)" label, extract version or keep "latest"
    if (v.startsWith("latest")) {
      setVersion("latest");
    } else {
      setVersion(v);
    }
    setShowVersionDropdown(false);
  }

  // ── Close dropdowns on outside click ──
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

  async function handleAudit() {
    if (!packageName.trim() || isCalculatingQuote) return;
    
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

  function handleAcceptQuote() {
    if (!quote) return;
    const query: Record<string, string> = { name: quote.package, version: quote.version, quoteId: quote.quoteId };
    void router.push({ pathname: "/check", query });
  }

  return (
    <>
      <Head>
        <title>Validus – Know what you install</title>
      </Head>

      <div className="min-h-screen bg-[#f0ebe4] text-[#1a1a1a]">
        <Header />

        {/* Hero */}
        <main className="flex flex-col items-center px-6 pt-28 pb-20">
          <h1 className="text-center text-5xl font-bold leading-[1.15] tracking-tight text-[#1a1a1a] sm:text-6xl md:text-7xl">
            Know what
            <br />
            you install.
          </h1>

          <p className="mt-6 text-center text-sm leading-6 text-[#6b6b6b]">
            AI-powered security audit for npm packages.
            <br />
            Results published on-chain.
          </p>

          {/* Search bar container */}
          {!mounted ? (
            <div className="mt-10 h-[52px]" />
          ) : (
            <div className="mt-10 flex w-full max-w-2xl flex-col items-center gap-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAudit();
                }}
                className="group relative flex w-full items-center rounded-xl border border-[#d6d0c8] bg-white shadow-sm transition-all focus-within:border-[#8b6fad]/50 focus-within:shadow-md"
              >
                {/* Fixed prefix with dynamic highlight */}
                <div className={`flex items-center rounded-l-xl border-r border-[#d6d0c8] px-4 py-3.5 font-mono text-sm transition-colors duration-300 ${packageName ? 'bg-[#8b6fad]/10 text-[#8b6fad]' : 'bg-[#f5f0ea] text-[#a8a8a8]'}`}>
                  npm install
                </div>

                {/* Package name input with autocomplete */}
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

                  {/* Package search dropdown */}
                  {showDropdown && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-[#d6d0c8] bg-white shadow-lg">
                      {isSearching ? (
                        <div className="px-4 py-3 text-xs text-[#a8a8a8]">
                          Searching npm...
                        </div>
                      ) : (
                        searchResults.map((pkg, i) => (
                          <button
                            key={pkg.name}
                            type="button"
                            onClick={() => selectPackage(pkg)}
                            className="flex w-full cursor-pointer flex-col gap-0.5 border-none bg-transparent px-4 py-2.5 text-left transition hover:bg-[#f5f0ea]"
                            style={
                              i < searchResults.length - 1
                                ? { borderBottom: "1px solid #eee" }
                                : {}
                            }
                          >
                            <span className="text-sm font-medium text-[#1a1a1a]">
                              {pkg.name}
                              <span className="ml-2 text-xs font-normal text-[#a8a8a8]">
                                v{pkg.version}
                              </span>
                            </span>
                            <span className="truncate text-xs text-[#888]">
                              {pkg.description || "(no description)"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="h-6 w-px bg-[#d6d0c8]" />

                {/* Version selector dropdown */}
                <div ref={versionRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowVersionDropdown((v) => !v)}
                    disabled={isLoadingVersions}
                    className="flex w-24 cursor-pointer items-center justify-between border-none bg-transparent px-4 py-3.5 text-sm text-[#1a1a1a] outline-none sm:w-28"
                  >
                    <span className={version === "latest" ? "text-[#a8a8a8]" : ""}>
                      {isLoadingVersions ? "..." : version}
                    </span>
                    <svg
                      width="10"
                      height="6"
                      viewBox="0 0 10 6"
                      fill="none"
                      className="ml-1 flex-shrink-0"
                    >
                      <path
                        d="M1 1L5 5L9 1"
                        stroke="#a8a8a8"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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
                            v === version || (v.startsWith("latest") && version === "latest")
                              ? "font-medium text-[#8b6fad]"
                              : "text-[#1a1a1a]"
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
                  className="ml-1 mr-1.5 cursor-pointer rounded-lg bg-[#b8a9c8] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#a494b4] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCalculatingQuote ? "Calculating Estimate..." : "Estimate Price"}
                </button>
              </form>

              {quoteError && (
                <div className="w-full rounded-xl border border-[#e85c5c33] bg-[#e85c5c11] px-4 py-3 text-sm text-[#b14a4a]">
                  {quoteError}
                </div>
              )}

              {quote && (
                <div className="w-full space-y-4">
                  {/* Dash Estimate */}
                  <div className="rounded-2xl border border-[#d6d0c8] bg-white shadow-sm overflow-hidden">
                    <button type="button" onClick={() => setExpandDash(!expandDash)}
                      className="flex w-full items-center justify-between p-5 text-left cursor-pointer bg-transparent border-none">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">Ceiling Estimate</p>
                        <h2 className="mt-1 text-xl font-semibold text-[#1a1a1a]">
                          {quote.package}<span className="ml-2 font-mono text-sm text-[#8a8580]">@{quote.version}</span>
                        </h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-[#f5f0ea] px-4 py-3 text-right">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-[#8a8580]">Ceiling</p>
                          <p className="text-2xl font-bold text-[#1a1a1a]">{quote.estimateTDash} tDASH</p>
                        </div>
                        <svg width="12" height="8" viewBox="0 0 12 8" className={`transition-transform ${expandDash ? "rotate-180" : ""}`}>
                          <path d="M1 1L6 6L11 1" stroke="#8a8580" strokeWidth="2" strokeLinecap="round" fill="none"/>
                        </svg>
                      </div>
                    </button>

                    {expandDash && (
                      <div className="px-5 pb-5">
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Billable Lines</p>
                            <p className="mt-1 text-lg font-semibold">{quote.billableLines}</p>
                          </div>
                          <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Estimated Minutes</p>
                            <p className="mt-1 text-lg font-semibold">{quote.estimatedMinutes}</p>
                          </div>
                          <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Line Charge</p>
                            <p className="mt-1 text-lg font-semibold">{quote.breakdown.lineChargeCredits}</p>
                          </div>
                          <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Time Charge</p>
                            <p className="mt-1 text-lg font-semibold">{quote.breakdown.timeChargeCredits}</p>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-[#6b6b6b]">You will only be charged the final scan amount, capped at this ceiling.</p>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-[#8a8580]">Quote expires at {new Date(quote.expiresAt).toLocaleTimeString()}.</p>
                          <button type="button" onClick={handleAcceptQuote} className="rounded-xl bg-[#1a1a1a] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90">
                            Accept &amp; Start Scan (tDASH)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* DCAI Estimate */}
                  <div className="rounded-2xl border border-amber-300/50 bg-[#fffbf5] shadow-sm overflow-hidden">
                    <button type="button" onClick={() => setExpandDcai(!expandDcai)}
                      className="flex w-full items-center justify-between p-5 text-left cursor-pointer bg-transparent border-none">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">DCAI L3 Estimate</p>
                        <h2 className="mt-1 text-xl font-semibold text-[#1a1a1a]">
                          {quote.package}<span className="ml-2 font-mono text-sm text-[#8a8580]">@{quote.version}</span>
                        </h2>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-right">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-amber-600">Ceiling</p>
                          <p className="text-2xl font-bold text-amber-700">{(quote.billableLines * 0.000005 + quote.estimatedMinutes * 0.001).toFixed(6)} tDCAI</p>
                        </div>
                        <svg width="12" height="8" viewBox="0 0 12 8" className={`transition-transform ${expandDcai ? "rotate-180" : ""}`}>
                          <path d="M1 1L6 6L11 1" stroke="#d97706" strokeWidth="2" strokeLinecap="round" fill="none"/>
                        </svg>
                      </div>
                    </button>

                    {expandDcai && (
                      <div className="px-5 pb-5">
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Billable Lines</p>
                            <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">{quote.billableLines}</p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Estimated Minutes</p>
                            <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">{quote.estimatedMinutes}</p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Line Charge</p>
                            <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">{(quote.billableLines * 0.000005).toFixed(6)}</p>
                          </div>
                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-amber-600">Time Charge</p>
                            <p className="mt-1 text-lg font-semibold text-[#1a1a1a]">{(quote.estimatedMinutes * 0.001).toFixed(6)}</p>
                          </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-[#6b6b6b]">Pay with tDCAI on DCAI L3 (Chain 18441). Charged from your top-up credits.</p>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-[#8a8580]">Quote expires at {new Date(quote.expiresAt).toLocaleTimeString()}.</p>
                          <button type="button" onClick={handleAcceptQuote} className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-600">
                            Accept &amp; Start Scan (tDCAI)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
