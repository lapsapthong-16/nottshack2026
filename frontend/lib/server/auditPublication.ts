import { storeAuditReport } from "../../pages/api/evoguard/document/store";
import {
  publishPackagePointer,
  readBillingRecord,
  readPublicPackage,
  updateScanRun,
  writeBillingRecord,
} from "./auditPricingStore";
import { buildPackageVersionKey, type ScanBillingRecord } from "../shared/auditSchemas";

function getPublicationRiskScore(publicData: NonNullable<ReturnType<typeof readPublicPackage>>) {
  const severitySummary = publicData.scan_run.severity_summary;
  const finalSeverity = severitySummary.high > 0
    ? "high"
    : severitySummary.medium > 0
      ? "medium"
      : severitySummary.low > 0
        ? "low"
        : "none";
  const riskScoreMap: Record<string, number> = { high: 90, medium: 50, low: 20, none: 0 };
  return riskScoreMap[finalSeverity] ?? 10;
}

export async function publishPaidAudit(scanId: string): Promise<{
  billing: ScanBillingRecord;
  publicationStatus: ScanBillingRecord["publication_status"];
}> {
  const billing = readBillingRecord(scanId);
  if (!billing) {
    throw new Error(`Billing for scan "${scanId}" not found`);
  }

  const publicData = readPublicPackage(scanId);
  if (!publicData) {
    throw new Error(`Scan "${scanId}" data not found`);
  }

  const updatedBilling: ScanBillingRecord = {
    ...billing,
    publication_status: "pending",
  };

  try {
    await storeAuditReport({
      pkgName: publicData.scan_run.package,
      version: publicData.scan_run.version,
      riskScore: getPublicationRiskScore(publicData),
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
    console.error("publishPaidAudit error:", error);
  }

  writeBillingRecord(updatedBilling);
  updateScanRun({
    ...publicData.scan_run,
  });

  publishPackagePointer(
    buildPackageVersionKey(publicData.scan_run.package, publicData.scan_run.version),
    publicData.scan_run.scan_id,
  );

  return {
    billing: updatedBilling,
    publicationStatus: updatedBilling.publication_status,
  };
}
