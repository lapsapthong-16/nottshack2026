import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/wallet/identity-nonce?identityId=xxx
 * 
 * Returns the current on-chain identity nonce using the official EvoSDK.
 * The pshenmic SDK's getIdentityNonce returns stale/wrong values,
 * so the frontend uses this endpoint to get the correct nonce.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const identityId = req.query.identityId as string;
  if (!identityId) {
    return res.status(400).json({ ok: false, error: "Missing identityId query param" });
  }

  try {
    const { EvoSDK } = await import("@dashevo/evo-sdk");
    const sdk = EvoSDK.testnetTrusted();
    await sdk.connect();

    try {
      // Use the CORRECT method: sdk.identities.nonce() calls DAPI's getIdentityNonce
      // NOT identity.nonce from fetch() which is a different (wrong) field
      const identityNonce = await sdk.identities.nonce(identityId);
      const balance = await sdk.identities.balance(identityId);

      console.log(`[identity-nonce] Identity ${identityId}: nonce=${identityNonce}, balance=${balance}`);

      return res.status(200).json({
        ok: true,
        identityId,
        nonce: Number(identityNonce),
        balance: balance.toString(),
      });
    } finally {
      if (typeof sdk.disconnect === "function") {
        await sdk.disconnect();
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch identity nonce";
    console.error("identity-nonce error:", error);
    return res.status(500).json({ ok: false, error: message });
  }
}
