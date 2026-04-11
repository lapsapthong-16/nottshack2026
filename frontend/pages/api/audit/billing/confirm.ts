import type { NextApiRequest, NextApiResponse } from "next";
import { publishPaidAudit } from "../../../../lib/server/auditPublication";
import { readBillingRecord, writeBillingRecord } from "../../../../lib/server/auditPricingStore";
import { creditsToTDashString } from "../../../../lib/server/pricing";

const DCAI_ESTIMATE_TDCAI = "0.004870";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { scanId, payerIdentityId, amountCredits, transitionId, dcaiTxHash } = req.body ?? {};
  if (!scanId || !amountCredits) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const billing = readBillingRecord(String(scanId));
  if (!billing) {
    return res.status(404).json({ error: `Billing for scan "${scanId}" not found` });
  }

  if (billing.payment_status === "paid") {
    return res.status(200).json({
      ok: true,
      scanId: billing.scan_id,
      paymentRoute: billing.payment_route,
      paymentStatus: billing.payment_status,
      publicationStatus: billing.publication_status,
      finalAmountTDash: billing.payment_route === "dash" ? creditsToTDashString(BigInt(billing.final_amount_credits)) : undefined,
      finalAmountTDcai: billing.payment_route === "dcai" ? DCAI_ESTIMATE_TDCAI : undefined,
    });
  }

  if (String(amountCredits) !== billing.final_amount_credits) {
    return res.status(400).json({ error: "Amount does not match final billing amount" });
  }

  if (billing.payment_route === "dash") {
    if (!payerIdentityId) {
      return res.status(400).json({ error: "Missing payerIdentityId for DASH payment" });
    }

    writeBillingRecord({
      ...billing,
      payment_status: "paid",
      payer_identity_id: String(payerIdentityId),
      transition_id: transitionId ? String(transitionId) : null,
      dcai_tx_hash: null,
      paid_at: new Date().toISOString(),
      publication_status: "pending",
      publication_trigger: "dash_payment_confirm",
    });
  } else {
    if (!dcaiTxHash) {
      return res.status(400).json({ error: "Missing dcaiTxHash for DCAI payment" });
    }

    writeBillingRecord({
      ...billing,
      payment_status: "paid",
      payer_identity_id: null,
      transition_id: null,
      dcai_tx_hash: String(dcaiTxHash),
      paid_at: new Date().toISOString(),
      publication_status: "pending",
      publication_trigger: "dcai_credit_burn",
    });
  }

  const publication = await publishPaidAudit(String(scanId));

  return res.status(200).json({
    ok: true,
    scanId: publication.billing.scan_id,
    paymentRoute: publication.billing.payment_route,
    paymentStatus: publication.billing.payment_status,
    publicationStatus: publication.publicationStatus,
    finalAmountTDash:
      publication.billing.payment_route === "dash"
        ? creditsToTDashString(BigInt(publication.billing.final_amount_credits))
        : undefined,
    finalAmountTDcai:
      publication.billing.payment_route === "dcai"
        ? DCAI_ESTIMATE_TDCAI
        : undefined,
  });
}
