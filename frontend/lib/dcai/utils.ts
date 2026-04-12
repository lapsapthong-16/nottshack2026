import { ethers } from "ethers";

const DCAI_RPC = "http://139.180.188.61:8545";

export async function flushStuckTransactions(wallet: ethers.Wallet) {
  const provider = wallet.provider;
  if (!provider) return;

  const address = await wallet.getAddress();
  const [pendingNonce, latestNonce] = await Promise.all([
    provider.getTransactionCount(address, "pending"),
    provider.getTransactionCount(address, "latest"),
  ]);

  if (pendingNonce > latestNonce) {
    console.log(`[Flush] Stuck txs detected for ${address}. Pending: ${pendingNonce}, Latest: ${latestNonce}`);
    const feeData = await provider.getFeeData();
    const gasPrice = (feeData.gasPrice || 1000000000n) * 2n;

    for (let i = latestNonce; i < pendingNonce; i++) {
      try {
        const tx = await wallet.sendTransaction({
          to: address,
          value: 0,
          nonce: i,
          gasPrice,
        });
        console.log(`[Flush] Successfully broadcasted flush for nonce ${i} with hash ${tx.hash}`);
      } catch (e: any) {
        console.error(`[Flush] Failed to flush nonce ${i}:`, e.message);
      }
    }
    return true;
  }
  return false;
}
