import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";

type BillingResponse = {
  billing: {
    scan_id: string;
    package: string;
    version: string;
    final_amount_credits: string;
    ceiling_amount_credits: string;
    payment_status: "pending" | "paid";
    publication_status: "pending" | "published" | "failed";
  };
  finalAmountTDash: string;
  ceilingAmountTDash: string;
};

type ExtensionWindow = Window & {
  dashPlatformExtension?: {
    signer: {
      connect: () => Promise<{ currentIdentity?: string | null }>;
      signAndBroadcast: (transition: unknown) => Promise<{
        id?: { toString(): string };
        stateTransitionId?: { toString(): string };
      } | null>;
    };
  };
  dashPlatformSDK?: {
    identities: {
      createStateTransition: (
        kind: string,
        payload: {
          identityId: string;
          identityNonce: bigint;
          recipientId: string;
          amount: bigint;
        },
      ) => unknown;
    };
  };
};

export default function PayScan() {
  const router = useRouter();
  const { scanId } = router.query;
  const resolvedScanId = typeof scanId === "string" ? scanId : Array.isArray(scanId) ? scanId[0] : "";

  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (!resolvedScanId) return;

    fetch(`/api/audit/billing?scanId=${encodeURIComponent(resolvedScanId)}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load billing");
        }
        setData(payload);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [resolvedScanId]);

  async function handlePayment() {
    if (!data || isPaying) return;

    try {
      setIsPaying(true);
      setError(null);
      const win = window as ExtensionWindow;

      if (!win.dashPlatformExtension) {
        throw new Error("Dash Platform Extension is not installed.");
      }

      const { currentIdentity: identityId } = await win.dashPlatformExtension.signer.connect();
      if (!identityId) {
        throw new Error("No identity selected in the Dash Platform Extension.");
      }

      const infoRes = await fetch("/api/wallet/info");
      const infoData = await infoRes.json();
      if (!infoRes.ok || !infoData.ok || !infoData.wallet?.identityId) {
        throw new Error(infoData.error || "Failed to fetch recipient identity.");
      }

      const sdk = win.dashPlatformSDK;
      if (!sdk) {
        throw new Error("Dash Platform SDK was not injected by the extension.");
      }

      const nonceRes = await fetch(`/api/wallet/identity-nonce?identityId=${identityId}`);
      const nonceData = await nonceRes.json();
      if (!nonceRes.ok || !nonceData.ok) {
        throw new Error(nonceData.error || "Failed to fetch identity nonce.");
      }

      const nextNonce = BigInt(nonceData.nonce) + 1n;
      const amount = BigInt(data.billing.final_amount_credits);
      const stateTransition = sdk.identities.createStateTransition("creditTransfer", {
        identityId,
        identityNonce: nextNonce,
        recipientId: infoData.wallet.identityId,
        amount,
      });

      const transitionResult = await win.dashPlatformExtension.signer.signAndBroadcast(stateTransition);

      const confirmRes = await fetch("/api/audit/billing/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId: data.billing.scan_id,
          payerIdentityId: identityId,
          amountCredits: data.billing.final_amount_credits,
          transitionId:
            transitionResult?.id?.toString?.() ??
            transitionResult?.stateTransitionId?.toString?.() ??
            null,
        }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(confirmData.error || "Failed to confirm payment.");
      }

      void router.push(`/report/${encodeURIComponent(data.billing.scan_id)}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <>
      <Head>
        <title>Validus — Unlock Report</title>
      </Head>

      <div className="min-h-screen bg-[#f0ebe4] text-[#1a1a1a]">
        <Header />
        <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-16">
          <Link href="/" className="text-sm text-[#8a7a9a] hover:text-[#5f516c]">
            ← Back home
          </Link>

          <div className="rounded-2xl border border-[#d6d0c8] bg-white p-8 shadow-sm">
            {loading && <p className="text-sm text-[#8a8580]">Loading billing details…</p>}

            {!loading && error && (
              <div className="rounded-xl border border-[#e85c5c33] bg-[#e85c5c11] px-4 py-3 text-sm text-[#b14a4a]">
                {error}
              </div>
            )}

            {!loading && data && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8580]">Unlock Scan Report</p>
                <h1 className="mt-2 text-3xl font-bold">
                  {data.billing.package}
                  <span className="ml-2 font-mono text-base font-medium text-[#8a8580]">@{data.billing.version}</span>
                </h1>
                <p className="mt-3 text-sm leading-6 text-[#6b6b6b]">
                  This scan is complete. The exact dynamic charge has been calculated and is ready for approval in the extension.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-4">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Final Amount</p>
                    <p className="mt-1 text-2xl font-bold">{data.finalAmountTDash} tDASH</p>
                    <p className="mt-1 text-xs text-[#8a8580]">{data.billing.final_amount_credits} credits</p>
                  </div>
                  <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-4">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#8a8580]">Approved Ceiling</p>
                    <p className="mt-1 text-2xl font-bold">{data.ceilingAmountTDash} tDASH</p>
                    <p className="mt-1 text-xs text-[#8a8580]">Payment status: {data.billing.payment_status}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[#8a8580]">
                    The extension will prompt only for the dynamic final amount.
                  </p>
                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={isPaying || data.billing.payment_status === "paid"}
                    className="rounded-xl bg-[#1a1a1a] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {data.billing.payment_status === "paid" ? "Already Paid" : isPaying ? "Awaiting Extension..." : "Pay & Unlock"}
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
