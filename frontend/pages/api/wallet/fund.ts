import type { NextApiRequest, NextApiResponse } from "next";

type SuccessResponse = {
  ok: true;
  funding: {
    address: string;
    fundingUrl: string;
    network: "testnet";
    note: string;
  };
};

type ErrorResponse = {
  ok: false;
  error: string;
};

function isLikelyDashPlatformAddress(address: string) {
  return /^tb1[0-9a-z]{20,}$/i.test(address);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const address =
    typeof req.body?.address === "string" ? req.body.address.trim() : "";

  if (!address) {
    return res.status(400).json({
      ok: false,
      error: "Address is required",
    });
  }

  if (!isLikelyDashPlatformAddress(address)) {
    return res.status(400).json({
      ok: false,
      error: "Address does not look like a Dash testnet platform address",
    });
  }

  return res.status(200).json({
    ok: true,
    funding: {
      address,
      fundingUrl: `https://bridge.thepasta.org/?address=${address}`,
      network: "testnet",
      note: "Open the funding URL in a browser to request test funds.",
    },
  });
}
