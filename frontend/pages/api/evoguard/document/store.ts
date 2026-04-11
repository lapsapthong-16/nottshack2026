import type { NextApiRequest, NextApiResponse } from "next";
import { Document, WasmDppError, WasmSdkError } from "@dashevo/evo-sdk";
import { createClient } from "@/setupDashClient.mjs";
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

export async function storeAuditReport(payload: {
  pkgName: string;
  version: string;
  riskScore: number;
  summary: string;
  malwareDetected: boolean;
  auditorSignature: string;
  findings?: any[];
  snippets?: any[];
  filesCount?: number;

}) {
  const config = getEvoguardConfig();
  if (!config.contractId) {
    throw new Error("EVOGUARD_CONTRACT_ID not configured.");
  }

  const {
    pkgName,
    version,
    riskScore,
    summary,
    malwareDetected,
    auditorSignature,
    findings = [],
    snippets = [],
    filesCount = 0,

  } = payload;

  const context = await resolveWritableIdentityContext();
  const sdk = await createClient(config.network);

  // 1. Store the main Audit Report
  const reportDoc = new Document({
    properties: {
      pkgName,
      version,
      riskScore: Number(riskScore),
      summary: summary || "Audit complete.",
      malwareDetected: Boolean(malwareDetected),
      auditorSignature,
      findingsCount: findings.length,
      snippetsCount: snippets.length,
      filesCount: Number(filesCount),
    },

    documentTypeName: "auditReport",
    dataContractId: config.contractId,
    ownerId: context.identityId,
  });

  console.log(`[Store] Creating auditReport: ${reportDoc.id.toString()}`);
  await sdk.documents.create({
    document: reportDoc,
    identityKey: context.identityKey,
    signer: context.signer,
  });

  const reportIdStr = reportDoc.id.toString();

  // 2. Store individual Findings
  for (const finding of findings) {
    const findingDoc = new Document({
      properties: {
        reportId: reportIdStr,
        file: finding.file,
        severity: finding.severity || "medium",
        risk: Number(finding.risk || 5),
        reasoning: finding.reasoning || finding.description || "No reasoning provided.",
        lineNumbers: (finding.line_numbers || finding.lineNumbers || []).join(","),


      },
      documentTypeName: "auditFinding",
      dataContractId: config.contractId,
      ownerId: context.identityId,
    });

    console.log(`[Store] Creating auditFinding for ${finding.file}: ${findingDoc.id.toString()}`);
    await sdk.documents.create({
      document: findingDoc,
      identityKey: context.identityKey,
      signer: context.signer,
    });
  }

  // 3. Store individual Snippets (split into 5000-byte chunks)
  for (const snippet of snippets) {
    // snippets.json structure has snippet_raw which is base64
    const contentBase64 = snippet.content || snippet.snippet_raw || "";
    const fullBuffer = Buffer.from(contentBase64, "base64");
    
    const chunkSize = 5000;
    const partsCount = Math.ceil(fullBuffer.length / chunkSize);

    for (let i = 0; i < partsCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fullBuffer.length);
      const chunk = fullBuffer.subarray(start, end);

      const snippetDoc = new Document({
        properties: {
          reportId: reportIdStr,
          file: snippet.file,
          lineStart: Number(snippet.line_start || snippet.lineStart || 1),
          lineEnd: Number(snippet.line_end || snippet.lineEnd || 1),
          part: i,
          content: chunk,
        },
        documentTypeName: "auditSnippet",
        dataContractId: config.contractId,
        ownerId: context.identityId,
      });

      console.log(`[Store] Creating auditSnippet ${snippet.file} part ${i}: ${snippetDoc.id.toString()}`);
      await sdk.documents.create({
        document: snippetDoc,
        identityKey: context.identityKey,
        signer: context.signer,
      });
    }
  }

  return {
    reportId: reportIdStr,
    findings: findings.length,
    snippets: snippets.length,
  };
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
    const result = await storeAuditReport(req.body);
    return res.status(200).json({
      ok: true,
      message: "High-fidelity audit report stored on Dash Drive",
      ...result,
    });
  } catch (error) {
    console.error("Document store error:", error);
    return res.status(500).json({
      ok: false,
      error: getErrorMessage(error),
    });
  }
}
