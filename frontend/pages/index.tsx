import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Header from "@/components/Header";

export default function Landing() {
  const router = useRouter();
  const [packageName, setPackageName] = useState("");
  const [version, setVersion] = useState("latest");

  const examples = ["event-stream", "ua-parser-js", "colors"];

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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
      
      await win.dashPlatformExtension.signer.signAndBroadcast(stateTransition);

      // ── Step 6: SUCCESS — payment confirmed ──
      console.log("═══════════════════════════════════════════════════");
      console.log("  ✅ PAYMENT SUCCESSFUL!");
      console.log("  Sender:    ", identityId);
      console.log("  Recipient: ", recipientId);
      console.log("  Amount:     0.01 DASH (1,000,000,000 credits)");
      console.log("═══════════════════════════════════════════════════");

      // Proceed to audit
      void router.push({ pathname: "/check", query });

    } catch (e: any) {
      console.error("❌ Payment Error:", e);
      alert("Payment failed or was cancelled: " + (e.message || "Unknown error") + "\n\nThe audit cannot proceed without payment.");
    } finally {
      setIsProcessingPayment(false);
    }
  }

  function handleExampleClick(name: string) {
    setPackageName(name);
    setVersion("latest");
    void router.push({ pathname: "/check", query: { name } });
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
            className="mt-10 flex items-center gap-0 overflow-hidden rounded-xl border border-[#d6d0c8] bg-white shadow-sm"
          >
            <input
              type="text"
              placeholder="package name"
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              className="w-44 border-none bg-transparent px-5 py-3.5 text-sm text-[#1a1a1a] placeholder-[#a8a8a8] outline-none sm:w-56"
            />
            <div className="h-6 w-px bg-[#d6d0c8]" />
            <input
              type="text"
              placeholder="latest"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-20 border-none bg-transparent px-4 py-3.5 text-sm text-[#1a1a1a] placeholder-[#a8a8a8] outline-none sm:w-24"
            />
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
