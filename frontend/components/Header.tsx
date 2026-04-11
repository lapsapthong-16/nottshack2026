import Link from "next/link";
import { useState, useCallback } from "react";
import { ethers } from "ethers";

const DCAI_CHAIN_ID = "0x4809";
const DCAI_RPC_PROXY = "http://localhost:3000/api/dcai/rpc";
const STAKING_CONTRACT = "0x2Fbc8aD3137991e77BC45f40c3B80e2c31B88842";
const STAKING_ABI = [
  "function topUp() payable",
  "function getCredits(address user) view returns (uint256)",
];

declare global {
  interface Window {
    ethereum?: any;
    okxwallet?: any;
  }
}

function getInjected(): any {
  return window.okxwallet || window.ethereum;
}

type HeaderProps = {
  packageName?: string;
  filesScanned?: number;
  filesTotal?: number;
  progress?: number;
};

export default function Header({
  packageName,
  filesScanned,
  filesTotal,
  progress,
}: HeaderProps) {
  const showProgress = packageName !== undefined;

  const [dcaiWallet, setDcaiWallet] = useState<string | null>(null);
  const [dcaiCredits, setDcaiCredits] = useState<string | null>(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("0.001");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpMsg, setTopUpMsg] = useState<string | null>(null);

  const refreshCredits = useCallback(async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
      const contract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);
      const credits = await contract.getCredits(addr);
      setDcaiCredits(ethers.formatEther(credits));
    } catch { /* silent */ }
  }, []);

  const connectDcai = async () => {
    try {
      const injected = getInjected();
      if (!injected) { alert("Install OKX Wallet"); return; }

      const accounts: string[] = await injected.request({ method: "eth_requestAccounts" });

      try {
        await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: DCAI_CHAIN_ID }] });
      } catch (err: any) {
        if (err.code === 4902) {
          await injected.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: DCAI_CHAIN_ID,
              chainName: "DCAI L3 Testnet",
              nativeCurrency: { name: "tDCAI", symbol: "tDCAI", decimals: 18 },
              rpcUrls: ["http://139.180.188.61:8545"],
              blockExplorerUrls: ["http://139.180.140.143"],
            }],
          });
        }
      }

      const addr = accounts[0];
      setDcaiWallet(addr);
      await refreshCredits(addr);
    } catch { /* silent */ }
  };

  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount);
    if (isNaN(amt) || amt <= 0 || !dcaiWallet) return;
    setTopUpLoading(true);
    setTopUpMsg(null);
    try {
      const injected = getInjected();
      if (!injected) throw new Error("No wallet");

      const iface = new ethers.Interface(STAKING_ABI);
      const txParams: Record<string, string> = {
        from: dcaiWallet,
        to: STAKING_CONTRACT,
        data: iface.encodeFunctionData("topUp"),
        value: "0x" + ethers.parseEther(topUpAmount).toString(16),
        gas: "0x40000",
      };

      const txHash: string = await injected.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      setTopUpMsg(`Done! Tx: ${txHash.slice(0, 14)}...`);
      // Refresh credits after chain confirmation
      setTimeout(() => { if (dcaiWallet) refreshCredits(dcaiWallet); }, 3000);
      setTimeout(() => { if (dcaiWallet) refreshCredits(dcaiWallet); }, 6000);
      setTimeout(() => { if (dcaiWallet) refreshCredits(dcaiWallet); }, 10000);
    } catch (err: any) {
      setTopUpMsg(err.message || "Failed");
    } finally {
      setTopUpLoading(false);
    }
  };

  return (
    <>
      <header className="flex items-center border-b border-[#e0dbd4] bg-[#f0ebe4] px-6 py-3">
        <Link
          href="/"
          className="font-display text-lg font-bold tracking-tight text-[#1a1a1a] no-underline transition-opacity hover:opacity-80"
        >
          Validus
        </Link>

        <nav className="ml-8 flex items-center gap-6">
          <Link href="/check" className="text-sm font-medium text-[#6b6b6b] no-underline transition-colors hover:text-[#1a1a1a]">
            Audit
          </Link>
          <Link href="/report" className="text-sm font-medium text-[#6b6b6b] no-underline transition-colors hover:text-[#1a1a1a]">
            Reports
          </Link>
          <Link href="/profile" className="text-sm font-medium text-[#6b6b6b] no-underline transition-colors hover:text-[#1a1a1a]">
            Profile
          </Link>
        </nav>

        {/* DCAI wallet section - right side */}
        <div className="ml-auto flex items-center gap-3">
          {dcaiWallet ? (
            <>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                {dcaiCredits ? `${parseFloat(dcaiCredits).toFixed(4)} tDCAI` : "..."}
              </span>
              <button
                onClick={() => setShowTopUp(true)}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
              >
                Top Up
              </button>
              <span className="text-xs font-mono text-[#6b6b6b]">
                {dcaiWallet.slice(0, 6)}...{dcaiWallet.slice(-4)}
              </span>
            </>
          ) : (
            <button
              onClick={connectDcai}
              className="rounded-lg bg-[#1a1a1a] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#333]"
            >
              DCAI
            </button>
          )}

          {showProgress && (
            <>
              <div className="h-4 w-px bg-black/10 mx-2" />
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
                <span className="text-sm font-semibold text-[#1a1a1a]">{packageName}</span>
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const segmentProgress = ((progress ?? 0) / 100) * 5;
                  const filled = i < segmentProgress;
                  return (
                    <div key={i} className="h-1 w-4 rounded-full transition-colors duration-500" style={{ backgroundColor: filled ? "#22c55e" : "rgba(0,0,0,0.1)" }} />
                  );
                })}
              </div>
              {filesTotal !== undefined && (
                <span className="font-mono text-[10px] font-medium tracking-tighter text-[#8a8580]">
                  {filesScanned ?? 0}/{filesTotal}
                </span>
              )}
            </>
          )}
        </div>
      </header>

      {/* Top Up Modal */}
      {showTopUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowTopUp(false)}>
          <div className="w-full max-w-sm rounded-xl bg-[#111] border border-gray-700 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Top Up Credits</h3>
              <button onClick={() => setShowTopUp(false)} className="text-gray-500 hover:text-white text-xl">&times;</button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Current balance: <span className="text-amber-400 font-semibold">{dcaiCredits ? `${parseFloat(dcaiCredits).toFixed(4)} tDCAI` : "0"}</span>
            </p>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-600 bg-[#0a0a0a] px-4 py-2.5 text-sm text-white outline-none focus:border-amber-500"
                placeholder="0.001"
              />
              <span className="text-sm text-gray-400 whitespace-nowrap">tDCAI</span>
            </div>

            <button
              onClick={handleTopUp}
              disabled={topUpLoading}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
            >
              {topUpLoading ? "Processing..." : `Top Up ${topUpAmount} tDCAI`}
            </button>

            {topUpMsg && (
              <p className={`mt-3 text-xs text-center ${topUpMsg.startsWith("Done") ? "text-emerald-400" : "text-red-400"}`}>
                {topUpMsg}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
