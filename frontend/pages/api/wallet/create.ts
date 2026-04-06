import type { NextApiRequest, NextApiResponse } from "next";
import {
  PlatformAddressSigner,
  PrivateKey,
  wallet,
} from "@dashevo/evo-sdk";

type SuccessResponse = {
  ok: true;
  wallet: {
    network: "testnet";
    mnemonic: string;
    derivationPath: string;
    platformAddress: string;
    fundingUrl: string;
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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const network = "testnet" as const;

  try {
    const mnemonic = await wallet.generateMnemonic();
    const pathInfo = await wallet.derivationPathBip44Testnet(0, 0, 0);

    const keyInfo = await wallet.deriveKeyFromSeedWithPath({
      mnemonic,
      path: pathInfo.path,
      network,
    });

    const privateKey = PrivateKey.fromWIF(keyInfo.toObject().privateKeyWif);
    const signer = new PlatformAddressSigner();
    const platformAddress = signer.addKey(privateKey).toBech32m(network);

    return res.status(200).json({
      ok: true,
      wallet: {
        network,
        mnemonic,
        derivationPath: pathInfo.path,
        platformAddress,
        fundingUrl: `https://bridge.thepasta.org/?address=${platformAddress}`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create wallet";

    return res.status(500).json({ ok: false, error: message });
  }
}
