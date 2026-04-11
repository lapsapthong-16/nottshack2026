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

export default function Landing() {
  const router = useRouter();
  const [packageName, setPackageName] = useState("");
  const [version, setVersion] = useState("latest");

  // ── Package search autocomplete state ──
  const [searchResults, setSearchResults] = useState<NpmResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Version dropdown state ──
  const [versions, setVersions] = useState<string[]>(["latest"]);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const versionRef = useRef<HTMLDivElement>(null);

  const examples = ["event-stream", "ua-parser-js", "colors"];
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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
    if (!packageName.trim() || isProcessingPayment) return;
    
    const query: Record<string, string> = { name: packageName.trim() };
    if (version.trim() && version.trim() !== "latest") {
      query.version = version.trim();
    }

    try {
      setIsProcessingPayment(true);
      const win = window as any;
      
      // ── Step 1: Check extension is installed ──
      if (!win.dashPlatformExtension) {
        alert("Dash Platform Extension is not installed. Please install it to proceed with the audit payment.");
        setIsProcessingPayment(false);
        return;
      }
      console.log("[Payment] Step 1: Extension detected ✓");

      // ── Step 2: Connect to extension ──
      const { currentIdentity: identityId } = await win.dashPlatformExtension.signer.connect();
      if (!identityId) {
        alert("No identity selected in the Dash Platform Extension.");
        setIsProcessingPayment(false);
        return;
      }
      console.log("[Payment] Step 2: Connected — Identity:", identityId, "✓");

      // ── Step 3: Get recipient identity from backend ──
      const infoRes = await fetch("/api/wallet/info");
      const { wallet, ok, error } = await infoRes.json();
      if (!ok || !wallet.identityId) {
        alert("Failed to fetch payment details from server: " + (error || "No identity ID configured."));
        setIsProcessingPayment(false);
        return;
      }
      const recipientId = wallet.identityId;
      console.log("[Payment] Step 3: Recipient:", recipientId, "✓");

      // ── Step 4: Build & sign the credit transfer ──
      const sdk = win.dashPlatformSDK;
      if (!sdk) {
        alert("Dash Platform SDK was not injected by the extension. Please check extension status.");
        setIsProcessingPayment(false);
        return;
      }

      const amount = 1000000000n; // 0.01 DASH = 1,000,000,000 credits

      // Fetch the CORRECT on-chain nonce from our backend (EvoSDK)
      // because pshenmic's sdk.identities.getIdentityNonce returns stale/wrong values
      const nonceRes = await fetch(`/api/wallet/identity-nonce?identityId=${identityId}`);
      const nonceData = await nonceRes.json();
      if (!nonceData.ok) {
        alert("Failed to fetch identity nonce: " + nonceData.error);
        setIsProcessingPayment(false);
        return;
      }
      const currentNonce = BigInt(nonceData.nonce);
      const nextNonce = currentNonce + 1n;
      console.log("[Payment] Step 4: On-chain nonce:", currentNonce.toString(), "→ using next nonce:", nextNonce.toString());
      console.log("[Payment] Step 4: Identity balance:", nonceData.balance, "credits");

      // Create unsigned credit-transfer state transition with the CORRECT nonce
      const stateTransition = sdk.identities.createStateTransition('creditTransfer', {
        identityId,
        identityNonce: nextNonce,
        recipientId,
        amount,
      });
      console.log("[Payment] Step 4: State transition created ✓");

      // ── Step 5: Extension signs & broadcasts — MUST succeed ──
      console.log("[Payment] Step 5: Requesting extension to sign & broadcast...");
      console.log("[Payment]   (The extension popup should appear now — please approve the transaction)");
      
      let paymentSuccess = false;
      let paymentError = "";
      try {
        await win.dashPlatformExtension.signer.signAndBroadcast(stateTransition);
        paymentSuccess = true;
      } catch (signErr: any) {
        paymentError = signErr?.message || "Unknown signing error";
        console.error("❌ Payment signing failed:", paymentError);
      }

      if (paymentSuccess) {
        // ── Step 6: SUCCESS — payment confirmed ──
        console.log("═══════════════════════════════════════════════════");
        console.log("  ✅ PAYMENT SUCCESSFUL!");
        console.log("  Sender:    ", identityId);
        console.log("  Recipient: ", recipientId);
        console.log("  Amount:     0.01 DASH (1,000,000,000 credits)");
        console.log("═══════════════════════════════════════════════════");
        void router.push({ pathname: "/check", query });
      } else {
        // Payment failed — in dev mode, offer skip option
        if (process.env.NODE_ENV === "development") {
          const skip = window.confirm(
            `Payment failed: ${paymentError}\n\n[DEV MODE] Skip payment and proceed to audit anyway?`
          );
          if (skip) {
            void router.push({ pathname: "/check", query });
            return;
          }
        }
        alert("Payment failed or was cancelled: " + paymentError + "\n\nThe audit cannot proceed without payment.");
      }

    } catch (e: any) {
      console.error("❌ Payment Error:", e);
      if (process.env.NODE_ENV === "development") {
        const skip = window.confirm(
          `Payment error: ${e.message || "Unknown error"}\n\n[DEV MODE] Skip payment and proceed to audit anyway?`
        );
        if (skip) {
          void router.push({ pathname: "/check", query });
          return;
        }
      }
      alert("Payment failed: " + (e.message || "Unknown error"));
    } finally {
      setIsProcessingPayment(false);
    }
  }

  function handleExampleClick(name: string) {
    setPackageName(name);
    setVersion("latest");
    fetchVersions(name);
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

          {/* Search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAudit();
            }}
            className="relative mt-10 flex items-center gap-0 rounded-xl border border-[#d6d0c8] bg-white shadow-sm"
          >
            {/* Package name input with autocomplete */}
            <div ref={searchRef} className="relative">
              <input
                id="package-search"
                type="text"
                placeholder="package name"
                autoComplete="off"
                value={packageName}
                onChange={(e) => handlePackageInput(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                className="w-44 rounded-l-xl border-none bg-transparent px-5 py-3.5 text-sm text-[#1a1a1a] placeholder-[#a8a8a8] outline-none sm:w-56"
              />

              {/* Package search dropdown */}
              {showDropdown && (
                <div className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border border-[#d6d0c8] bg-white shadow-lg">
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
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-1 flex-shrink-0">
                  <path d="M1 1L5 5L9 1" stroke="#a8a8a8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                        (v === version || (v.startsWith("latest") && version === "latest"))
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
              disabled={isProcessingPayment}
              className="ml-1 mr-1.5 cursor-pointer rounded-lg bg-[#b8a9c8] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#a494b4] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessingPayment ? "Awaiting Payment..." : "Audit"}
            </button>
          </form>

          {/* Example packages */}
          <div className="mt-6 flex items-center gap-4">
            {examples.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => handleExampleClick(name)}
                className="cursor-pointer border-none bg-transparent font-mono text-xs tracking-wide text-[#a8a09a] transition hover:text-[#6b6b6b]"
              >
                {name}
              </button>
            ))}
          </div>
        </main>
      </div>
    </>
  );
}
