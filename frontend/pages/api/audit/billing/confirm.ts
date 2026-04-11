import type { NextApiRequest, NextApiResponse } from "next";
import { storeAuditReport } from "../../evoguard/document/store";
import {
  publishPackagePointer,
  readBillingRecord,
  readPublicPackage,
  updateScanRun,
  writeBillingRecord,
} from "../../../../lib/server/auditPricingStore";
import { creditsToTDashString } from "../../../../lib/server/pricing";
import type { ScanBillingRecord } from "../../../../lib/shared/auditSchemas";
import { buildPackageVersionKey } from "../../../../lib/shared/auditSchemas";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { scanId, payerIdentityId, amountCredits, transitionId } = req.body ?? {};
  if (!scanId || !payerIdentityId || !amountCredits) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const billing = readBillingRecord(String(scanId));
  if (!billing) {
    return res.status(404).json({ error: `Billing for scan "${scanId}" not found` });
  }
  if (billing.payment_status === "paid") {
    return res.status(409).json({ error: "Billing already paid" });
  }
  if (String(amountCredits) !== billing.final_amount_credits) {
    return res.status(400).json({ error: "Amount does not match final billing amount" });
  }

  const publicData = readPublicPackage(String(scanId));
  if (!publicData) {
    return res.status(404).json({ error: `Scan "${scanId}" data not found` });
  }

  const updatedBilling: ScanBillingRecord = {
    ...billing,
    payment_status: "paid" as const,
    payer_identity_id: String(payerIdentityId),
    transition_id: transitionId ? String(transitionId) : null,
    paid_at: new Date().toISOString(),
    publication_status: "pending" as const,
  };

  try {
    const severitySummary = publicData.scan_run.severity_summary;
    const finalSeverity = severitySummary.high > 0
      ? "high"
      : severitySummary.medium > 0
        ? "medium"
        : severitySummary.low > 0
          ? "low"
          : "none";
    const riskScoreMap: Record<string, number> = { high: 90, medium: 50, low: 20, none: 0 };

    await storeAuditReport({
      pkgName: publicData.scan_run.package,
      version: publicData.scan_run.version,
      riskScore: riskScoreMap[finalSeverity] ?? 10,
      summary: publicData.findings[0]?.reasoning || "Audit complete.",
      malwareDetected: publicData.scan_run.verdict === "flagged",
      auditorSignature: `validus-ai-${scanId}`,
      findings: publicData.findings,
      snippets: publicData.snippets ?? [],
      filesCount: publicData.scan_run.files_scanned,
    });

    updatedBilling.publication_status = "published";
  } catch (error) {
    updatedBilling.publication_status = "failed";
    console.error("billing confirm publication error:", error);
  }

  writeBillingRecord(updatedBilling);

  updateScanRun({
    ...publicData.scan_run,
  });

  publishPackagePointer(
    buildPackageVersionKey(publicData.scan_run.package, publicData.scan_run.version),
    publicData.scan_run.scan_id,
  );

  return res.status(200).json({
    ok: true,
    scanId: publicData.scan_run.scan_id,
    paymentStatus: updatedBilling.payment_status,
    publicationStatus: updatedBilling.publication_status,
    finalAmountTDash: creditsToTDashString(BigInt(updatedBilling.final_amount_credits)),
  });
}
