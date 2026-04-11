import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@/setupDashClient.mjs";
import { getEvoguardConfig } from "../../../../lib/server/evoguardConfig";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { reportId } = req.query;

  if (!reportId || typeof reportId !== "string") {
    return res.status(400).json({ ok: false, error: "Missing reportId parameter" });
  }

  try {
    const config = getEvoguardConfig();
    if (!config.contractId) {
      return res.status(400).json({ ok: false, error: "EVOGUARD_CONTRACT_ID not configured." });
    }

    const sdk = await createClient(config.network);

    // Query Findings
    const findingsResult = await sdk.documents.query({
      dataContractId: config.contractId,
      documentTypeName: "auditFinding",
      where: [["reportId", "==", reportId]],
      limit: 100,
    } as any);

    // Query Snippets
    const snippetsResult = await sdk.documents.query({
      dataContractId: config.contractId,
      documentTypeName: "auditSnippet",
      where: [["reportId", "==", reportId]],
      limit: 100,
    } as any);

    const findings: any[] = [];
    for (const [id, doc] of findingsResult) {
      if (doc) findings.push({ id: id.toString(), ...doc.toJSON() });
    }

    const snippetsMap: Record<string, any[]> = {};
    for (const [id, doc] of snippetsResult) {
      if (doc) {
        const data = doc.toJSON();
        const fileKey = `${data.file}:${data.lineStart}:${data.lineEnd}`;
        if (!snippetsMap[fileKey]) snippetsMap[fileKey] = [];
        snippetsMap[fileKey].push(data);
      }
    }

    const snippets: any[] = [];
    for (const fileKey in snippetsMap) {
      const parts = snippetsMap[fileKey].sort((a, b) => (a.part || 0) - (b.part || 0));
      const first = parts[0];
      
      // Helper to convert any byteArray representation (base64 or array of numbers) to Buffer
      const toBuffer = (content: any) => {
        if (typeof content === "string") return Buffer.from(content, "base64");
        if (Array.isArray(content)) return Buffer.from(content);
        return Buffer.alloc(0);
      };

      const combinedBuffer = Buffer.concat(parts.map(p => toBuffer(p.content)));
      const fullContentBase64 = combinedBuffer.toString("base64");

      snippets.push({
        ...first,
        content: fullContentBase64,
        isMultipart: parts.length > 1
      });
    }

    return res.status(200).json({
      ok: true,
      reportId,
      findings,
      snippets,
    });
  } catch (error) {
    console.error("Details query error:", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to query document details",
    });
  }
}
