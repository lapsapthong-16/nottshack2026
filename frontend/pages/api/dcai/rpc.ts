import type { NextApiRequest, NextApiResponse } from "next";

const DCAI_RPC_DIRECT = "http://139.180.188.61:8545";
const DCAI_RPC_API = "http://139.180.140.143/rpc/basic/51c164ea2954246fdc2da538954385c8/";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  // Use API-key RPC for read calls, direct RPC for write calls
  const method = req.body?.method || "";
  const readMethods = ["eth_call", "eth_blockNumber", "eth_chainId", "eth_getBalance", "eth_getTransactionCount", "eth_estimateGas", "eth_gasPrice", "eth_getTransactionReceipt", "eth_getBlockByNumber", "net_version"];
  const rpcUrl = readMethods.includes(method) ? DCAI_RPC_API : DCAI_RPC_DIRECT;

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (err: any) {
    // Fallback to direct RPC if API-key RPC fails
    try {
      const response = await fetch(DCAI_RPC_DIRECT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(200).json(data);
    } catch {
      res.status(500).json({ error: err.message });
    }
  }
}
