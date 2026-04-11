import type { NextApiRequest, NextApiResponse } from "next";
import { readBillingRecord } from "../../../lib/server/auditPricingStore";
import { creditsToTDashString } from "../../../lib/server/pricing";

const DCAI_ESTIMATE_TDCAI = "0.004870";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const scanId = req.query.scanId as string | undefined;
  if (!scanId) {
    return res.status(400).json({ error: "Missing scanId" });
  }

  const billing = readBillingRecord(scanId);
  if (!billing) {
    return res.status(404).json({ error: `Billing for scan "${scanId}" not found` });
  }

  return res.status(200).json({
    billing,
    paymentRoute: billing.payment_route,
    finalAmountTDash: billing.payment_route === "dash" ? creditsToTDashString(BigInt(billing.final_amount_credits)) : undefined,
    finalAmountTDcai: billing.payment_route === "dcai" ? DCAI_ESTIMATE_TDCAI : undefined,
    ceilingAmountTDash: billing.payment_route === "dash" ? creditsToTDashString(BigInt(billing.ceiling_amount_credits)) : undefined,
    ceilingAmountTDcai: billing.payment_route === "dcai" ? DCAI_ESTIMATE_TDCAI : undefined,
  });
}
