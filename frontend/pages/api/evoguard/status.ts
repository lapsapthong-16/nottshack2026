import type { NextApiRequest, NextApiResponse } from "next";
import { getContractStatus } from "../../../lib/server/contractService";
import { getDpnsStatus } from "../../../lib/server/dpnsService";
import { getIdentityCapabilityStatus } from "../../../lib/server/identityCredentialService";

type SuccessResponse = {
  ok: true;
  status: {
    network: string;
    identity: Awaited<ReturnType<typeof getIdentityCapabilityStatus>>["identity"];
    dpns: Awaited<ReturnType<typeof getDpnsStatus>>;
    contract: {
      configuredId: string | null;
      exists: boolean;
      fetchedId: string | null;
      documentTypes: string[];
      deploymentAllowed: boolean;
      error: string | null;
    };
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
    const [identityStatus, dpnsStatus, contractStatus] = await Promise.all([
      getIdentityCapabilityStatus(),
      getDpnsStatus(),
      getContractStatus(),
    ]);

    return res.status(200).json({
      ok: true,
      status: {
        network: identityStatus.network,
        identity: identityStatus.identity,
        dpns: dpnsStatus,
        contract: {
          configuredId: contractStatus.configuredId,
          exists: contractStatus.exists,
          fetchedId: contractStatus.fetchedId,
          documentTypes: contractStatus.documentTypes,
          deploymentAllowed: identityStatus.identity.key.canDeployContracts,
          error: contractStatus.error,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to load EvoGuard status",
    });
  }
}
