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

  try {
    const config = getEvoguardConfig();
    if (!config.contractId) {
      return res.status(400).json({ ok: false, error: "EVOGUARD_CONTRACT_ID not configured." });
    }

    const sdk = await createClient(config.network);
    const maliciousOnly = req.query.malicious === "true";

    const queryOpts: Record<string, unknown> = {
      dataContractId: config.contractId,
      documentTypeName: "auditReport",
      limit: 50,
    };

    if (maliciousOnly) {
      queryOpts.where = [["malwareDetected", "==", true]];
    }

    const results = await sdk.documents.query(queryOpts as any);
    const docs: Record<string, unknown>[] = [];

    for (const [id, doc] of results) {
      if (doc) {
        docs.push({ id: id.toString(), ...doc.toJSON() });
      }
    }

    return res.status(200).json({ ok: true, count: docs.length, documents: docs });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to query documents",
    });
  }
}
