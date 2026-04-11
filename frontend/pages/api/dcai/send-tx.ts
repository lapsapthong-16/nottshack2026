import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";

const DCAI_RPC = "http://139.180.188.61:8545";
const PRIVATE_KEY = "0x62127cbc71ce6a05a68f500285e27e5078f04d78f6e0076756ec9635064af4fa";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { to, data, value } = req.body;
  if (!to) return res.status(400).json({ error: "Missing 'to'" });

  try {
    const provider = new ethers.JsonRpcProvider(DCAI_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const tx = await wallet.sendTransaction({
      to,
      data: data || "0x",
      value: value || "0",
      gasLimit: 200000,
    });

    const receipt = await tx.wait();
    res.status(200).json({
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber,
      status: receipt?.status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
