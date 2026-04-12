import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import Header from "@/components/Header";

const DCAI_RPC_PROXY = typeof window !== "undefined" ? window.location.origin + "/api/dcai/rpc" : "http://localhost:3000/api/dcai/rpc";
const DCAI_CHAIN_ID = "0x4809";
const EXPLORER = "http://139.180.140.143";

const BUILDER_PASS = "0x08A8C0497f2756676dEeE5ba32935B2152adF968";
const STAKING_CONTRACT = "0x2Fbc8aD3137991e77BC45f40c3B80e2c31B88842";
const REPORT_CONTRACT = "0x7fD01C2d75E271e34eF7ABec9BB9Da2C4E78f8Da";

const PASS_ABI = [
  "function balanceOf(address) view returns (uint256)",
];

const STAKING_ABI = [
  "function topUp() payable",
  "function stake() payable",
  "function slash(address user, uint256 amount)",
  "function slashAll(address user)",
  "function getCredits(address user) view returns (uint256)",
  "function getStake(address user) view returns (uint256)",
];

const REPORT_ABI = [
  "function submitReport(string dataHash, string metadata) external",
  "function getReport(uint256 reportId) view returns (address auditor, string dataHash, string metadata, uint256 timestamp)",
  "function getReportCount() view returns (uint256)",
  "function getReportsByAuditor(address auditor) view returns (uint256[])",
  "event ReportSubmitted(uint256 indexed reportId, address indexed auditor, string dataHash, string metadata, uint256 timestamp)",
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

type ReportEntry = {
  id: number;
  auditor: string;
  dataHash: string;
  metadata: string;
  timestamp: number;
  txHash?: string;
};

export default function StackPage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [hasPass, setHasPass] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("0.001");
  const [stakeAmount, setStakeAmount] = useState("0.001");
  const [onChainCredits, setOnChainCredits] = useState("0");
  const [onChainStake, setOnChainStake] = useState("0");
  const [slashAddress, setSlashAddress] = useState("");
  const [slashAmount, setSlashAmount] = useState("0.001");
  // Report state
  const [reportHash, setReportHash] = useState("");
  const [reportMeta, setReportMeta] = useState("");
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const notify = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
      const bal = await provider.getBalance(addr);
      setBalance(ethers.formatEther(bal));
    } catch { /* silent */ }
  }, []);

  const checkPass = useCallback(async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
      const pass = new ethers.Contract(BUILDER_PASS, PASS_ABI, provider);
      const bal = await pass.balanceOf(addr);
      setHasPass(Number(bal) > 0);
    } catch { setHasPass(null); }
  }, []);

  const refreshOnChain = useCallback(async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
      const contract = new ethers.Contract(STAKING_CONTRACT, STAKING_ABI, provider);
      const [credits, staked] = await Promise.all([
        contract.getCredits(addr),
        contract.getStake(addr),
      ]);
      setOnChainCredits(ethers.formatEther(credits));
      setOnChainStake(ethers.formatEther(staked));
    } catch { /* silent */ }
  }, []);

  const fetchReports = useCallback(async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
      const contract = new ethers.Contract(REPORT_CONTRACT, REPORT_ABI, provider);
      const ids: bigint[] = await contract.getReportsByAuditor(addr);
      const entries: ReportEntry[] = [];
      for (const id of ids) {
        const [auditor, dataHash, metadata, timestamp] = await contract.getReport(id);
        entries.push({
          id: Number(id),
          auditor,
          dataHash,
          metadata,
          timestamp: Number(timestamp),
        });
      }
      setReports(entries);
    } catch { /* silent */ }
  }, []);

  // Connect OKX Wallet
  const connectWallet = async () => {
    setLoading("connect");
    try {
      const injected = getInjected();
      if (!injected) { notify("No wallet found. Install OKX Wallet.", "err"); return; }

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
              blockExplorerUrls: [EXPLORER],
            }],
          });
        } else { throw err; }
      }

      const addr = accounts[0];
      setWallet(addr);
      await refreshBalance(addr);
      await checkPass(addr);
      await refreshOnChain(addr);
      await fetchReports(addr);
      notify(`Connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
    } catch (err: any) {
      notify(err.message || "Connection failed", "err");
    } finally { setLoading(null); }
  };

  // Auto-flush stuck txs before sending
  const autoFlush = async (addr: string) => {
    try {
      await fetch("/api/dcai/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
    } catch { /* silent */ }
  };

  // Send tx to a specific contract via wallet
  const sendTx = async (to: string, data: string, value: bigint) => {
    const injected = getInjected();
    if (!injected) throw new Error("No wallet");

    await autoFlush(wallet!);

    // Fetch correct nonce from RPC to prevent stale nonce issues
    const provider = new ethers.JsonRpcProvider(DCAI_RPC_PROXY);
    const nonce = await provider.getTransactionCount(wallet!, "pending");

    const txParams: Record<string, string> = {
      from: wallet!,
      to,
      data,
      value: "0x" + value.toString(16),
      gas: "0x40000",
      nonce: "0x" + nonce.toString(16),
    };

    const txHash: string = await injected.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    setLastTxHash(txHash);
    notify(`Tx sent: ${txHash.slice(0, 10)}...`);
    
    const receipt = await provider.waitForTransaction(txHash);
    return { receipt, txHash };
  };

  // Top Up
  const topUp = async () => {
    if (!wallet) return notify("Connect wallet first", "err");
    setLoading("topup");
    try {
      const amt = parseFloat(topUpAmount);
      if (isNaN(amt) || amt <= 0) { notify("Enter a valid amount", "err"); return; }
      const iface = new ethers.Interface(STAKING_ABI);
      const data = iface.encodeFunctionData("topUp");
      const { receipt } = await sendTx(STAKING_CONTRACT, data, ethers.parseEther(topUpAmount));
      if (receipt) {
        await refreshBalance(wallet);
        await refreshOnChain(wallet);
        notify(`Top-up complete! ${topUpAmount} tDCAI credited. Block #${receipt.blockNumber}`);
      }
    } catch (err: any) { notify(err.message || "Top-up failed", "err"); }
    finally { setLoading(null); }
  };

  // Stake
  const stake = async () => {
    if (!wallet) return notify("Connect wallet first", "err");
    setLoading("stake");
    try {
      const amt = parseFloat(stakeAmount);
      if (isNaN(amt) || amt <= 0) { notify("Enter a valid amount", "err"); return; }
      const iface = new ethers.Interface(STAKING_ABI);
      const data = iface.encodeFunctionData("stake");
      const { receipt } = await sendTx(STAKING_CONTRACT, data, ethers.parseEther(stakeAmount));
      if (receipt) {
        await refreshBalance(wallet);
        await refreshOnChain(wallet);
        notify(`Staked ${stakeAmount} tDCAI! Block #${receipt.blockNumber}`);
      }
    } catch (err: any) { notify(err.message || "Stake failed", "err"); }
    finally { setLoading(null); }
  };

  // Slash
  const slashUser = async () => {
    if (!wallet) return notify("Connect wallet first", "err");
    const target = slashAddress || wallet;
    setLoading("slash");
    try {
      const iface = new ethers.Interface(STAKING_ABI);
      const data = slashAddress
        ? iface.encodeFunctionData("slash", [slashAddress, ethers.parseEther(slashAmount)])
        : iface.encodeFunctionData("slashAll", [wallet]);
      const { receipt } = await sendTx(STAKING_CONTRACT, data, 0n);
      if (receipt) {
        await refreshOnChain(wallet);
        notify(`Slashed ${target.slice(0, 6)}...! Block #${receipt.blockNumber}`);
      }
    } catch (err: any) { notify(err.message || "Slash failed", "err"); }
    finally { setLoading(null); }
  };

  // Submit Report
  const submitReport = async () => {
    if (!wallet) return notify("Connect wallet first", "err");
    if (!reportHash) return notify("Enter a data hash", "err");
    setLoading("report");
    try {
      const iface = new ethers.Interface(REPORT_ABI);
      const data = iface.encodeFunctionData("submitReport", [reportHash, reportMeta || "{}",]);
      const { receipt } = await sendTx(REPORT_CONTRACT, data, 0n);
      if (receipt) {
        await fetchReports(wallet);
        notify(`Report submitted! Block #${receipt.blockNumber}`);
        setReportHash("");
        setReportMeta("");
      }
    } catch (err: any) { notify(err.message || "Report failed", "err"); }
    finally { setLoading(null); }
  };

  const creditsNum = parseFloat(onChainCredits);
  const stakeNum = parseFloat(onChainStake);

  // Auto-refresh
  useEffect(() => {
    if (!wallet) return;
    const id = setInterval(() => {
      refreshBalance(wallet);
      refreshOnChain(wallet);
    }, 15000);
    return () => clearInterval(id);
  }, [wallet, refreshBalance, refreshOnChain]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Header />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${toast.type === "ok" ? "bg-emerald-600/90 text-white" : "bg-red-600/90 text-white"}`}>
          {toast.msg}
        </div>
      )}

      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">DCAI Staking Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Chain ID: 18441 &middot; Token: tDCAI &middot; Network: DCAI L3 Testnet</p>
        </div>

        {/* Wallet Card */}
        <div className="mb-6 rounded-xl border border-gray-800 bg-[#111] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Wallet</p>
              {wallet ? (
                <p className="mt-1 font-mono text-lg font-semibold text-emerald-400">{wallet.slice(0, 6)}...{wallet.slice(-4)}</p>
              ) : (
                <p className="mt-1 text-gray-600">Not connected</p>
              )}
            </div>
            <button onClick={connectWallet} disabled={loading === "connect"}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${wallet ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30" : "bg-white text-black hover:bg-gray-200"}`}>
              {loading === "connect" ? "Connecting..." : wallet ? "Connected" : "Connect OKX Wallet"}
            </button>
          </div>

          {wallet && (
            <div className="mt-5 grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-[#1a1a1a] p-4">
                <p className="text-xs text-gray-500">Balance</p>
                <p className="mt-1 text-xl font-bold">
                  {balance ? `${parseFloat(balance).toFixed(4)}` : "\u2014"}
                  <span className="ml-1 text-sm font-normal text-gray-500">tDCAI</span>
                </p>
              </div>
              <div className="rounded-lg bg-[#1a1a1a] p-4">
                <p className="text-xs text-gray-500">Builder Pass</p>
                <p className="mt-1 text-xl font-bold">
                  {hasPass === null ? "\u2014" : hasPass ? <span className="text-emerald-400">Owned</span> : <span className="text-red-400">None</span>}
                </p>
              </div>
              <div className="rounded-lg bg-[#1a1a1a] p-4">
                <p className="text-xs text-gray-500">Top-up Credits</p>
                <p className="mt-1 text-xl font-bold text-amber-400">
                  {creditsNum.toFixed(4)}
                  <span className="ml-1 text-sm font-normal text-gray-500">tDCAI</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Cards */}
        {wallet && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4">
              {/* Top Up */}
              <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-5">
                <p className="mb-2 text-sm font-semibold text-amber-400">Top Up</p>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.001" min="0.001" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full rounded-lg border border-amber-800/50 bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-amber-500" />
                  <span className="text-xs text-gray-500 whitespace-nowrap">tDCAI</span>
                </div>
                <button onClick={topUp} disabled={loading === "topup"}
                  className="mt-2 w-full rounded-lg bg-amber-600/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-600/50 disabled:opacity-50">
                  {loading === "topup" ? "Processing..." : `Top Up ${topUpAmount} tDCAI`}
                </button>
              </div>

              {/* Stake */}
              <div className="rounded-xl border border-purple-800/50 bg-purple-900/20 p-5">
                <p className="mb-2 text-sm font-semibold text-purple-400">Stake</p>
                <div className="flex items-center gap-2">
                  <input type="number" step="0.001" min="0.001" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)}
                    className="w-full rounded-lg border border-purple-800/50 bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-purple-500" />
                  <span className="text-xs text-gray-500 whitespace-nowrap">tDCAI</span>
                </div>
                <button onClick={stake} disabled={loading === "stake"}
                  className="mt-2 w-full rounded-lg bg-purple-600/30 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-600/50 disabled:opacity-50">
                  {loading === "stake" ? "Staking..." : `Stake ${stakeAmount} tDCAI`}
                </button>
              </div>

              {/* Slash */}
              <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-5">
                <p className="mb-2 text-sm font-semibold text-red-400">Slash</p>
                <input type="text" value={slashAddress} onChange={(e) => setSlashAddress(e.target.value)}
                  className="w-full rounded-lg border border-red-800/50 bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-red-500 mb-2"
                  placeholder="0x... address (empty = self)" />
                {slashAddress && (
                  <div className="flex items-center gap-2 mb-2">
                    <input type="number" step="0.001" min="0.001" value={slashAmount} onChange={(e) => setSlashAmount(e.target.value)}
                      className="w-full rounded-lg border border-red-800/50 bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-red-500" />
                    <span className="text-xs text-gray-500 whitespace-nowrap">tDCAI</span>
                  </div>
                )}
                <button onClick={slashUser} disabled={loading === "slash"}
                  className="w-full rounded-lg bg-red-600/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-600/50 disabled:opacity-50">
                  {loading === "slash" ? "Slashing..." : slashAddress ? `Slash ${slashAmount} tDCAI` : "Slash All (self)"}
                </button>
              </div>

              {/* Submit Report */}
              <div className="rounded-xl border border-cyan-800/50 bg-cyan-900/20 p-5">
                <p className="mb-2 text-sm font-semibold text-cyan-400">Submit Report</p>
                <input type="text" value={reportHash} onChange={(e) => setReportHash(e.target.value)}
                  className="w-full rounded-lg border border-cyan-800/50 bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500 mb-2"
                  placeholder="Data hash (e.g. QmHash123)" />
                <input type="text" value={reportMeta} onChange={(e) => setReportMeta(e.target.value)}
                  className="w-full rounded-lg border border-cyan-800/50 bg-[#0a0a0a] px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500 mb-2"
                  placeholder='Metadata (e.g. {"type":"audit"})' />
                <button onClick={submitReport} disabled={loading === "report" || !reportHash}
                  className="w-full rounded-lg bg-cyan-600/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-600/50 disabled:opacity-50">
                  {loading === "report" ? "Submitting..." : "Submit Report On-Chain"}
                </button>
              </div>
            </div>

            {/* On-Chain Overview */}
            <div className="mb-6 rounded-xl border border-gray-800 bg-[#111] p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">On-Chain Overview</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-[#1a1a1a] p-4">
                  <p className="text-xs text-gray-500">Credits</p>
                  <p className="mt-1 text-xl font-bold text-amber-400">
                    {creditsNum.toFixed(4)} <span className="text-sm font-normal text-gray-500">tDCAI</span>
                  </p>
                </div>
                <div className="rounded-lg bg-[#1a1a1a] p-4">
                  <p className="text-xs text-gray-500">Stake</p>
                  <p className="mt-1 text-xl font-bold text-purple-400">
                    {stakeNum.toFixed(4)} <span className="text-sm font-normal text-gray-500">tDCAI</span>
                  </p>
                </div>
                <div className="rounded-lg bg-[#1a1a1a] p-4">
                  <p className="text-xs text-gray-500">Reports</p>
                  <p className="mt-1 text-xl font-bold text-cyan-400">{reports.length}</p>
                </div>
              </div>

              {/* Last Tx Link */}
              {lastTxHash && (
                <p className="mt-3 text-xs text-gray-500">
                  Last tx:{" "}
                  <a href={`${EXPLORER}/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    {lastTxHash.slice(0, 14)}...{lastTxHash.slice(-6)}
                  </a>
                </p>
              )}

              <div className="mt-3 flex gap-3 text-xs text-gray-600">
                <span>Staking: <a href={`${EXPLORER}/address/${STAKING_CONTRACT}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{STAKING_CONTRACT.slice(0, 10)}...</a></span>
                <span>Report: <a href={`${EXPLORER}/address/${REPORT_CONTRACT}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{REPORT_CONTRACT.slice(0, 10)}...</a></span>
              </div>
            </div>

            {/* Reports List */}
            {reports.length > 0 && (
              <div className="mb-6 rounded-xl border border-gray-800 bg-[#111] p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Your Reports (on-chain)</h2>
                <div className="space-y-3">
                  {reports.map((r) => (
                    <div key={r.id} className="rounded-lg bg-[#1a1a1a] p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-cyan-400">Report #{r.id}</span>
                        <span className="text-xs text-gray-500">{new Date(r.timestamp * 1000).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-white mb-1">
                        <span className="text-gray-500">Hash:</span> {r.dataHash}
                      </p>
                      <p className="text-sm text-white mb-2">
                        <span className="text-gray-500">Metadata:</span> {r.metadata}
                      </p>
                      <p className="text-xs text-gray-500">
                        Auditor: {r.auditor.slice(0, 10)}...
                      </p>
                    </div>
                  ))}
                </div>
                <button onClick={() => wallet && fetchReports(wallet)} className="mt-3 text-xs text-blue-400 hover:underline">
                  Refresh reports
                </button>
              </div>
            )}
          </>
        )}

        {/* Not connected */}
        {!wallet && (
          <div className="rounded-xl border border-gray-800 bg-[#111] p-12 text-center">
            <p className="text-lg font-semibold text-gray-400">Connect your wallet to get started</p>
            <p className="mt-2 text-sm text-gray-600">Supports OKX Wallet and MetaMask on DCAI L3 (Chain 18441)</p>
          </div>
        )}
      </div>
    </div>
  );
}
