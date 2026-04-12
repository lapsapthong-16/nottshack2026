import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";

const DCAI_RPC = "http://139.180.188.61:8545";
const PRIVATE_KEY = "0x62127cbc71ce6a05a68f500285e27e5078f04d78f6e0076756ec9635064af4fa";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "Missing address" });

  try {
    const provider = new ethers.JsonRpcProvider(DCAI_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const confirmed = await provider.getTransactionCount(address, "latest");
    const pending = await provider.getTransactionCount(address, "pending");

    if (pending <= confirmed) {
      return res.status(200).json({ flushed: 0, confirmed, pending });
    }

    const stuck = pending - confirmed;
    let flushed = 0;

    for (let n = confirmed; n < pending; n++) {
      try {
        const tx = await wallet.sendTransaction({
          to: wallet.address,
          value: 0,
          nonce: n,
          gasLimit: 21000,
          gasPrice: ethers.parseUnits("2", "gwei"),
        });
        await tx.wait();
        flushed++;
      } catch {
        // skip if nonce already used
      }
    }

    const newConfirmed = await provider.getTransactionCount(address, "latest");
    res.status(200).json({ flushed, confirmed: newConfirmed, previousPending: pending });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
