import type { NextApiRequest, NextApiResponse } from "next";
import { Document } from "@dashevo/evo-sdk";
import { createClient } from "@/setupDashClient.mjs";
import { getEvoguardConfig } from "../../../../lib/server/evoguardConfig";
import { resolveWritableIdentityContext } from "../../../../lib/server/identityCredentialService";
import sampleReports from "../../../../data/sample-reports.json";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const config = getEvoguardConfig();
    if (!config.contractId) {
      return res.status(400).json({ ok: false, error: "EVOGUARD_CONTRACT_ID not configured. Deploy contract first." });
    }

    const context = await resolveWritableIdentityContext();
    const sdk = await createClient(config.network);
    const stored: string[] = [];
    const errors: string[] = [];

    for (const report of sampleReports) {
      try {
        const document = new Document({
          properties: {
            pkgName: report.pkgName,
            version: report.version,
            riskScore: report.riskScore,
            summary: report.summary,
            malwareDetected: report.malwareDetected,
            auditorSignature: report.auditorSignature,
          },
          documentTypeName: "auditReport",
          dataContractId: config.contractId,
          ownerId: context.identityId,
        });

        await sdk.documents.create({
          document,
          identityKey: context.identityKey,
          signer: context.signer,
        });

        stored.push(report.pkgName);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${report.pkgName}: ${msg}`);
      }
    }

    return res.status(200).json({
      ok: true,
      stored,
      storedCount: stored.length,
      errors,
      totalReports: sampleReports.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    console.error("Seed reports error:", error);
    return res.status(500).json({ ok: false, error: message || "Failed to seed reports" });
  }
}
