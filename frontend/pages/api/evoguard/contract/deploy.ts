import type { NextApiRequest, NextApiResponse } from "next";
import { deployEvoguardContract } from "../../../../lib/server/contractService";

type SuccessResponse = {
  ok: true;
  contract: {
    id: string;
    documentTypes: string[];
    verificationFetched: boolean;
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

  try {
    const isForce = req.body?.force === true || req.query?.force === "true";
    const contract = await deployEvoguardContract(isForce);


    return res.status(200).json({ ok: true, contract });
  } catch (error: any) {
    // WasmSdkError has .message as a WASM getter (not enumerable)
    const message =
      error?.message
      || (typeof error === "string" ? error : null)
      || JSON.stringify(error);
    console.error("Deploy contract error:", message, error);
    return res.status(400).json({
      ok: false,
      error: message || "Failed to deploy contract",
    });
  }
}
