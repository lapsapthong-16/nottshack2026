import type { NextApiRequest, NextApiResponse } from "next";
import { Document } from "@dashevo/evo-sdk";
import { createClient } from "../../../../setupDashClient.mjs";
import { getEvoguardConfig } from "../../../../lib/server/evoguardConfig";
import { resolveWritableIdentityContext } from "../../../../lib/server/identityCredentialService";

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

    const { pkgName, version, riskScore, summary, malwareDetected, auditorSignature } = req.body;
    if (!pkgName || !version || riskScore === undefined || !summary || !auditorSignature) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const context = await resolveWritableIdentityContext();
    const sdk = await createClient(config.network);

    const document = new Document({
      properties: {
        pkgName,
        version,
        riskScore: Number(riskScore),
        summary,
        malwareDetected: Boolean(malwareDetected),
        auditorSignature,
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

    return res.status(200).json({ ok: true, message: "Audit report stored on Dash Drive" });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to store document",
    });
  }
}
