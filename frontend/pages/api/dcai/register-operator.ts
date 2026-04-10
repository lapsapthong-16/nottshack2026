import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";

const DCAI_RPC = "http://139.180.188.61:8545";
const OPERATOR_REGISTRY = "0xb37c81eBC4b1B4bdD5476fe182D6C72133F41db9";
const EXPLORER = "http://139.180.140.143";

const ABI = [
  "function registerOperator(address operator) external",
  "function isOperator(address operator) external view returns (bool)",
  "function owner() external view returns (address)",
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const pk = process.env.DCAI_PRIVATE_KEY;
  if (!pk) {
    return res.status(400).json({ ok: false, error: "DCAI_PRIVATE_KEY not set in .env" });
  }

  try {
    const provider = new ethers.JsonRpcProvider(DCAI_RPC);
    const wallet = new ethers.Wallet(pk, provider);
    const registry = new ethers.Contract(OPERATOR_REGISTRY, ABI, wallet);

    // Check if already registered
    let alreadyRegistered = false;
    try {
      alreadyRegistered = await registry.isOperator(wallet.address);
    } catch {
      // function may not exist with this signature
    }

    if (alreadyRegistered) {
      return res.status(200).json({
        ok: true,
        address: wallet.address,
        alreadyRegistered: true,
        contract: OPERATOR_REGISTRY,
        explorer: `${EXPLORER}/address/${OPERATOR_REGISTRY}`,
      });
    }

    const tx = await registry.registerOperator(wallet.address);
    const receipt = await tx.wait();

    return res.status(200).json({
      ok: true,
      address: wallet.address,
      txHash: tx.hash,
      block: receipt?.blockNumber,
      contract: OPERATOR_REGISTRY,
      explorer: `${EXPLORER}/tx/${tx.hash}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Register operator error:", error);
    return res.status(500).json({ ok: false, error: message });
  }
}
