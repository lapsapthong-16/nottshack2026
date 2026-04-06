import type { NextApiRequest, NextApiResponse } from "next";
import { EvoSDK } from "@dashevo/evo-sdk";

type SuccessResponse = {
  ok: true;
  status: unknown;
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
    const sdk = EvoSDK.testnetTrusted();
    await sdk.connect();
    const status = await sdk.system.status();

    return res.status(200).json({
      ok: true,
      status: status.toJSON(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown connection error";

    return res.status(500).json({ ok: false, error: message });
  }
}
