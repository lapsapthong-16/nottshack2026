import type { NextApiRequest, NextApiResponse } from "next";
import { registerDpnsName } from "../../../../lib/server/dpnsService";

type SuccessResponse = {
  ok: true;
  registration: {
    label: string;
    fqdn: string;
    identityId: string;
    state: "registered" | "already-owned";
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
    const label =
      typeof req.body?.label === "string" ? req.body.label.trim() : undefined;
    const registration = await registerDpnsName(label);

    return res.status(200).json({
      ok: true,
      registration,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to register DPNS alias",
    });
  }
}
