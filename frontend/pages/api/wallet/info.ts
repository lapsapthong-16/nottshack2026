import type { NextApiRequest, NextApiResponse } from "next";
import { setupDashClient } from "../../../setupDashClient.mjs";

type SuccessResponse = {
  ok: true;
  wallet: {
    network: string;
    address: string;
    derivationPath: string;
    balance: unknown;
    nonce: unknown;
    fundingUrl: string;
    identityId: string | null;
  };
};

type ErrorResponse = {
  ok: false;
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { keyManager, addressKeyManager } = await setupDashClient({
      requireIdentity: false,
    });

    if (!addressKeyManager) {
      throw new Error(
        "No wallet mnemonic configured. Set PLATFORM_MNEMONIC in frontend/.env.",
      );
    }

    const address = addressKeyManager.primaryAddress;
    const info = await addressKeyManager.getInfo();

    return res.status(200).json({
      ok: true,
      wallet: {
        network: addressKeyManager.network,
        address: address.bech32m,
        derivationPath: address.path,
        balance: info?.balance ?? 0,
        nonce: info?.nonce ?? 0,
        fundingUrl: `https://bridge.thepasta.org/?address=${address.bech32m}`,
        identityId: keyManager?.identityId ?? null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load wallet info";

    return res.status(500).json({ ok: false, error: message });
  }
}
