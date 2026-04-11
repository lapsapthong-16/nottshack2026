import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";

const DCAI_RPC = "http://139.180.188.61:8545";
const MERKLE_REWARD = "0x728f2C63b9A0ff0918F5ffB3D4C2d004107476B7";
const EXPLORER = "http://139.180.140.143";

const ABI = [
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

  const recipientAddress = req.body?.address;

  try {
    const provider = new ethers.JsonRpcProvider(DCAI_RPC);
    const wallet = new ethers.Wallet(pk, provider);
    const balance = await provider.getBalance(wallet.address);
    const recipient = recipientAddress || wallet.address;

    // Read distributor owner
    let distributorOwner: string | null = null;
    try {
      const distributor = new ethers.Contract(MERKLE_REWARD, ABI, provider);
      distributorOwner = await distributor.owner();
    } catch {
      // may not match ABI
    }

    // Send 0.001 tDCAI as reward
    const amount = ethers.parseEther("0.001");
    if (balance < amount) {
      return res.status(400).json({
        ok: false,
        error: `Insufficient tDCAI balance: ${ethers.formatEther(balance)}. Fund wallet via faucet: POST http://139.180.140.143/faucet/request {"address":"${wallet.address}"}`,
      });
    }

    const tx = await wallet.sendTransaction({ to: recipient, value: amount });
    const receipt = await tx.wait();

    return res.status(200).json({
      ok: true,
      from: wallet.address,
      to: recipient,
      amount: "0.001 tDCAI",
      txHash: tx.hash,
      block: receipt?.blockNumber,
      distributorOwner,
      contract: MERKLE_REWARD,
      explorer: `${EXPLORER}/tx/${tx.hash}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Reward reporter error:", error);
    return res.status(500).json({ ok: false, error: message });
  }
}
