import type { NextApiRequest, NextApiResponse } from "next";
import { getContractStatus } from "../../../../lib/server/contractService";

type SuccessResponse = {
  ok: true;
  contract: Awaited<ReturnType<typeof getContractStatus>>;
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
    const contract = await getContractStatus();

    return res.status(200).json({ ok: true, contract });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to fetch contract status",
    });
  }
}
