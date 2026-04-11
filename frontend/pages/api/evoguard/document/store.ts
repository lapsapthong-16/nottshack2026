import type { NextApiRequest, NextApiResponse } from "next";
import { Document, WasmDppError, WasmSdkError } from "@dashevo/evo-sdk";
import { createClient } from "../../../../setupDashClient.mjs";
import { getEvoguardConfig } from "../../../../lib/server/evoguardConfig";
import { resolveWritableIdentityContext } from "../../../../lib/server/identityCredentialService";

function getErrorMessage(error: unknown): string {
  if (error instanceof WasmSdkError) {
    return `WasmSdkError(${error.kind}): ${error.message}`;
  }

  if (error instanceof WasmDppError) {
    return `WasmDppError(${error.kind}): ${error.message}`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Failed to store document";
  }
}

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

    const documentProperties = {
      pkgName,
      version,
      riskScore: Number(riskScore),
      summary,
      malwareDetected: Boolean(malwareDetected),
      auditorSignature,
    };

    const document = new Document({
      properties: documentProperties,
      documentTypeName: "auditReport",
      dataContractId: config.contractId,
      ownerId: context.identityId,
    });

    await sdk.documents.create({
      document,
      identityKey: context.identityKey,
      signer: context.signer,
    });

    return res.status(200).json({
      ok: true,
      message: "Audit report stored on Dash Drive",
      documentId: document.id.toString(),
      type: "auditReport",
    });
  } catch (error) {
    console.error("Document store error:", error);
    return res.status(500).json({
      ok: false,
      error: getErrorMessage(error),
    });
  }
}
