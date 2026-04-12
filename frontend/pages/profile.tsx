import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import Header from "@/components/Header";

const DCAI_RPC_PROXY = "http://localhost:3000/api/dcai/rpc";
const DCAI_CHAIN_ID = "0x4809";
const EXPLORER = "http://139.180.140.143";
const STAKING_CONTRACT = "0x2Fbc8aD3137991e77BC45f40c3B80e2c31B88842";


const STAKING_ABI = [
  "function topUp() payable",
  "function stake() payable",
  "function slash(address user, uint256 amount)",
  "function slashAll(address user)",
  "function getCredits(address user) view returns (uint256)",
  "function getStake(address user) view returns (uint256)",
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

// Trust Network Graph (canvas-based)
type GraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  trust: number; // 0-1
  isCenter?: boolean;
};

type GraphEdge = { from: number; to: number };

function TrustGraph({ wallet, stakeNum }: { wallet: string | null; stakeNum: number }) {
  const canvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.parentElement?.clientWidth || 800;
    const H = 420;
    canvas.width = W;
    canvas.height = H;

    const nodes: GraphNode[] = [
      { id: "center", label: "TRUST: YES", x: W * 0.5, y: H * 0.45, vx: 0, vy: 0, radius: 40, color: "#b8f5b8", trust: 1, isCenter: true },
      { id: wallet?.slice(0, 8) || "0x5974", label: wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "You", x: W * 0.25, y: H * 0.35, vx: 0, vy: 0, radius: 28, color: "#4ade80", trust: 0.85 },
      { id: "node2", label: "0xA1b2...F3d4", x: W * 0.72, y: H * 0.3, vx: 0, vy: 0, radius: 28, color: "#4ade80", trust: 0.92 },
      { id: "node3", label: "0xC5d6...E7f8", x: W * 0.62, y: H * 0.6, vx: 0, vy: 0, radius: 24, color: "#4ade80", trust: 0.78 },
      { id: "malicious", label: "0xD9e0...1A2b", x: W * 0.38, y: H * 0.15, vx: 0, vy: 0, radius: 22, color: "#ef4444", trust: 0.12 },
      { id: "node5", label: "0xF3g4...5H6i", x: W * 0.15, y: H * 0.7, vx: 0, vy: 0, radius: 18, color: "#4ade80", trust: 0.65 },
      { id: "node6", label: "0x7J8k...9L0m", x: W * 0.8, y: H * 0.75, vx: 0, vy: 0, radius: 16, color: "#4ade80", trust: 0.58 },
    ];

    const edges: GraphEdge[] = [
      { from: 0, to: 1 }, { from: 0, to: 2 }, { from: 0, to: 3 },
      { from: 0, to: 4 }, { from: 0, to: 5 }, { from: 0, to: 6 },
      { from: 1, to: 2 }, { from: 1, to: 4 }, { from: 1, to: 5 },
      { from: 2, to: 3 }, { from: 3, to: 6 }, { from: 4, to: 5 },
    ];

    // Small info labels next to nodes
    const infoLabels = [
      { nodeIdx: 1, lines: [`Stake: ${stakeNum.toFixed(3)}`, "Reports: 7", "Uptime: 99.2%"] },
      { nodeIdx: 2, lines: ["Stake: 0.050", "Reports: 12", "Uptime: 98.7%"] },
      { nodeIdx: 3, lines: ["Stake: 0.025", "Reports: 4", "Trust: High"] },
      { nodeIdx: 4, lines: ["FLAGGED", "Malicious code", "Bond: Slashed"] },
    ];

    let animFrame: number;
    let tick = 0;

    function draw() {
      tick++;
      ctx!.clearRect(0, 0, W, H);

      // Subtle floating motion
      nodes.forEach((n, i) => {
        if (!n.isCenter) {
          n.x += Math.sin(tick * 0.008 + i * 1.5) * 0.3;
          n.y += Math.cos(tick * 0.006 + i * 2.1) * 0.2;
        }
      });

      // Draw edges
      edges.forEach((e) => {
        const a = nodes[e.from];
        const b = nodes[e.to];
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.strokeStyle = b.id === "malicious" || a.id === "malicious" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)";
        ctx!.lineWidth = 1;
        ctx!.stroke();

        // Small dots along edges
        const mx = (a.x + b.x) / 2 + Math.sin(tick * 0.02 + e.from) * 5;
        const my = (a.y + b.y) / 2 + Math.cos(tick * 0.02 + e.to) * 5;
        ctx!.beginPath();
        ctx!.arc(mx, my, 2, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(255,255,255,0.15)";
        ctx!.fill();
      });

      // Draw nodes
      nodes.forEach((n) => {
        // Glow
        const gradient = ctx!.createRadialGradient(n.x, n.y, n.radius * 0.5, n.x, n.y, n.radius * 2);
        gradient.addColorStop(0, n.color + "30");
        gradient.addColorStop(1, "transparent");
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius * 2, 0, Math.PI * 2);
        ctx!.fillStyle = gradient;
        ctx!.fill();

        // Circle
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx!.fillStyle = n.color;
        ctx!.fill();

        if (n.isCenter) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, n.radius + 4, 0, Math.PI * 2);
          ctx!.strokeStyle = "rgba(184,245,184,0.3)";
          ctx!.lineWidth = 2;
          ctx!.stroke();
        }

        // Label inside node
        ctx!.fillStyle = n.isCenter ? "#0a3a0a" : n.id === "malicious" ? "#fff" : "#0a2a0a";
        ctx!.font = `bold ${n.isCenter ? 10 : 8}px monospace`;
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(n.isCenter ? "TRUST: YES" : n.label, n.x, n.y);
      });

      // Info labels
      infoLabels.forEach((info) => {
        const n = nodes[info.nodeIdx];
        const lx = n.x + n.radius + 10;
        const ly = n.y - 12;
        ctx!.font = "9px monospace";
        info.lines.forEach((line, i) => {
          ctx!.fillStyle = info.nodeIdx === 4 ? "rgba(239,68,68,0.7)" : "rgba(255,255,255,0.4)";
          ctx!.textAlign = "left";
          ctx!.fillText(line, lx, ly + i * 12);
        });
      });

      animFrame = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animFrame);
  }, [wallet, stakeNum])

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

// Resolution steps
type ResolutionStep = {
  label: string;
  sublabel?: string;
  done: boolean;
  active: boolean;
  icon: "check" | "dispute" | "vote" | "chat" | "final";
};

export default function ProfilePage() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [onChainCredits, setOnChainCredits] = useState("0");
  const [onChainStake, setOnChainStake] = useState("0");
  const [reportCount, setReportCount] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [stakeAmount, setStakeAmount] = useState("0.001");

  // Resolution state
  const [resolutionPhase, setResolutionPhase] = useState(0); // 0 = not started
  const [disputeTimer, setDisputeTimer] = useState(107 * 60); // 1h47m in seconds
  const [slashed, setSlashed] = useState(false);

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

  const fetchReportCount = useCallback(async (addr: string) => {
    try {
      const res = await fetch(`/api/dcai/query-reports?auditor=${addr}`);
      const data = await res.json();
      setReportCount(data.reports?.length ?? 0);
    } catch { /* silent */ }
  }, []);

  const connectWallet = async () => {
    setLoading("connect");
    try {
      const injected = getInjected();
      if (!injected) { notify("Install OKX Wallet", "err"); return; }
      const accounts: string[] = await injected.request({ method: "eth_requestAccounts" });
      try {
        await injected.request({ method: "wallet_switchEthereumChain", params: [{ chainId: DCAI_CHAIN_ID }] });
      } catch (err: any) {
        if (err.code === 4902) {
          await injected.request({
            method: "wallet_addEthereumChain",
            params: [{ chainId: DCAI_CHAIN_ID, chainName: "DCAI L3 Testnet", nativeCurrency: { name: "tDCAI", symbol: "tDCAI", decimals: 18 }, rpcUrls: ["http://139.180.188.61:8545"], blockExplorerUrls: [EXPLORER] }],
          });
        }
      }
      const addr = accounts[0];
      setWallet(addr);
      await refreshBalance(addr);
      await refreshOnChain(addr);
      await fetchReportCount(addr);
      notify(`Connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);
    } catch (err: any) { notify(err.message || "Failed", "err"); }
    finally { setLoading(null); }
  };

  const autoFlush = async (addr: string) => {
    try {
      await fetch("/api/dcai/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
    } catch { /* silent */ }
  };

  const sendTx = async (to: string, data: string, value: bigint) => {
    const injected = getInjected();
    if (!injected) throw new Error("No wallet");

    await autoFlush(wallet!);

    const txParams: Record<string, string> = {
      from: wallet!,
      to,
      data,
      value: "0x" + value.toString(16),
      gas: "0x40000",
    };

    const txHash: string = await injected.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    notify(`Tx sent: ${txHash.slice(0, 10)}...`);
    // Don't wait for receipt - just delay for chain confirmation
    await new Promise(r => setTimeout(r, 3000));
    return { receipt: null, txHash };
  };

  const handleStake = async () => {
    if (!wallet) return notify("Connect wallet first", "err");
    const amt = parseFloat(stakeAmount);
    if (isNaN(amt) || amt <= 0) return notify("Invalid amount", "err");
    setLoading("stake");
    try {
      const iface = new ethers.Interface(STAKING_ABI);
      const data = iface.encodeFunctionData("stake");
      await sendTx(STAKING_CONTRACT, data, ethers.parseEther(stakeAmount));
      await refreshBalance(wallet);
      await refreshOnChain(wallet);
      notify(`Staked ${stakeAmount} tDCAI!`);
    } catch (err: any) { notify(err.message || "Stake failed", "err"); }
    finally { setLoading(null); }
  };

  // Simulate resolution flow: AI detects malicious code -> slash
  const startResolution = () => {
    setResolutionPhase(1);
    setSlashed(false);
    setTimeout(() => setResolutionPhase(2), 2000);
    setTimeout(() => setResolutionPhase(3), 4000);
    setTimeout(() => setResolutionPhase(4), 6000);
    setTimeout(() => setResolutionPhase(5), 8000);
    setTimeout(async () => {
      setResolutionPhase(6);
      setSlashed(true);
      // Actually slash on-chain via server API (reliable, no wallet nonce issues)
      if (wallet) {
        try {
          const iface = new ethers.Interface(STAKING_ABI);
          const data = iface.encodeFunctionData("slashAll", [wallet]);
          const resp = await fetch("/api/dcai/send-tx", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to: STAKING_CONTRACT, data, value: "0" }),
          });
          const result = await resp.json();
          if (resp.ok) {
            await refreshOnChain(wallet);
            await refreshBalance(wallet);
            notify(`Bond slashed! Block #${result.blockNumber}`);
          }
        } catch { /* silent */ }
      }
    }, 10000);
  };

  // Dispute timer countdown
  useEffect(() => {
    if (resolutionPhase !== 2) return;
    const id = setInterval(() => setDisputeTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [resolutionPhase]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m remaining`;
  };

  // Auto-refresh
  useEffect(() => {
    if (!wallet) return;
    const id = setInterval(() => { refreshBalance(wallet); refreshOnChain(wallet); }, 15000);
    return () => clearInterval(id);
  }, [wallet, refreshBalance, refreshOnChain]);

  const steps: ResolutionStep[] = [
    { label: "Outcome proposed: Yes", sublabel: "AI detected malicious pattern", done: resolutionPhase >= 1, active: resolutionPhase === 1, icon: "check" },
    { label: "Dispute window", sublabel: resolutionPhase >= 3 ? "Bond: 0.001 tDCAI" : formatTime(disputeTimer), done: resolutionPhase >= 3, active: resolutionPhase === 2, icon: "dispute" },
    { label: "First round voting", sublabel: resolutionPhase >= 3 ? "Result: Malicious" : undefined, done: resolutionPhase >= 3, active: resolutionPhase === 3, icon: "vote" },
    { label: "Discussion", sublabel: resolutionPhase >= 4 ? "3 AI agents debated" : undefined, done: resolutionPhase >= 5, active: resolutionPhase === 4, icon: "chat" },
    { label: "Second round voting", sublabel: resolutionPhase >= 5 ? "Result: Yes" : undefined, done: resolutionPhase >= 5, active: resolutionPhase === 5, icon: "vote" },
    { label: "Final outcome", done: resolutionPhase >= 6, active: resolutionPhase === 6, icon: "final" },
  ];

  const creditsNum = parseFloat(onChainCredits);
  const stakeNum = parseFloat(onChainStake);

  return (
    <div className="min-h-screen bg-[#f7f3ee]">
      <Header />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Profile Header */}
        <div className="rounded-2xl border border-[#e0dbd4] bg-white p-8 shadow-sm">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-purple-500 to-amber-400 flex items-center justify-center text-4xl text-white font-bold shadow-lg">
                {wallet ? wallet.slice(2, 4).toUpperCase() : "?"}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-[#1a1a1a]">
                    {wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Not Connected"}
                  </h1>
                  <p className="mt-1 text-sm text-[#6b6b6b]">DCAI L3 Node</p>
                </div>
                {!wallet ? (
                  <button onClick={connectWallet} disabled={loading === "connect"}
                    className="rounded-lg bg-[#1a1a1a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333] transition">
                    {loading === "connect" ? "Connecting..." : "Connect Wallet"}
                  </button>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Connected</span>
                )}
              </div>

              {wallet && (
                <div className="mt-5 grid grid-cols-4 gap-4">
                  <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#8a8580]">Balance</p>
                    <p className="mt-1 text-lg font-bold text-[#1a1a1a]">{balance ? parseFloat(balance).toFixed(4) : "—"} <span className="text-xs font-normal text-[#8a8580]">tDCAI</span></p>
                  </div>
                  <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#8a8580]">Credits</p>
                    <p className="mt-1 text-lg font-bold text-amber-600">{creditsNum.toFixed(4)} <span className="text-xs font-normal text-[#8a8580]">tDCAI</span></p>
                  </div>
                  <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#8a8580]">Staked</p>
                    <p className="mt-1 text-lg font-bold text-purple-600">{stakeNum.toFixed(4)} <span className="text-xs font-normal text-[#8a8580]">tDCAI</span></p>
                  </div>
                  <div className="rounded-xl border border-[#eee7df] bg-[#faf8f5] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-[#8a8580]">Reports Audited</p>
                    <p className="mt-1 text-lg font-bold text-[#1a1a1a]">{reportCount}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {wallet && (
          <>
            {/* Node Provider - Stake Section */}
            <div className="mt-6 rounded-2xl border border-[#e0dbd4] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#1a1a1a] mb-4">Node Provider</h2>
              <p className="text-sm text-[#6b6b6b] mb-4">Stake tDCAI to become an auditor node. Your stake acts as a bond — if the AI detects you passed malicious code, your stake gets slashed.</p>

              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-xs font-medium text-[#8a8580] uppercase tracking-wider">Stake Amount</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="number" step="0.001" min="0.001" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)}
                      className="w-full rounded-lg border border-[#e0dbd4] bg-[#faf8f5] px-4 py-2.5 text-sm text-[#1a1a1a] outline-none focus:border-purple-400" />
                    <span className="text-sm text-[#8a8580]">tDCAI</span>
                  </div>
                </div>
                <button onClick={handleStake} disabled={loading === "stake"}
                  className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition disabled:opacity-50">
                  {loading === "stake" ? "Staking..." : "Stake"}
                </button>
              </div>

              <div className="mt-4 flex gap-4 text-xs text-[#8a8580]">
                <span>Current Stake: <strong className="text-purple-600">{stakeNum.toFixed(4)} tDCAI</strong></span>
                <span>Contract: <a href={`${EXPLORER}/address/${STAKING_CONTRACT}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{STAKING_CONTRACT.slice(0, 12)}...</a></span>
              </div>
            </div>

            {/* Trust Network Graph */}
            <div className="mt-6 rounded-2xl border border-[#e0dbd4] bg-[#050505] p-6 shadow-sm overflow-hidden">
              <h2 className="text-lg font-bold text-white mb-4">Trust Network</h2>
              <p className="text-xs text-gray-500 mb-4">Visualizing auditor trust relationships and node integrity scores on DCAI L3.</p>
              <div className="relative h-[420px] w-full">
                <TrustGraph wallet={wallet} stakeNum={stakeNum} />
              </div>
            </div>

            {/* Resolution Section */}
            <div className="mt-6 rounded-2xl border border-[#e0dbd4] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[#1a1a1a] mb-6">Resolution</h2>

              {/* Progress Steps */}
              <div className="relative flex items-center justify-between mb-8">
                {/* Connecting line */}
                <div className="absolute top-5 left-5 right-5 h-0.5 bg-[#e0dbd4]" />
                <div className="absolute top-5 left-5 h-0.5 bg-blue-500 transition-all duration-1000"
                  style={{ width: `${Math.max(0, (resolutionPhase - 1) / 5) * 100}%`, maxWidth: "calc(100% - 40px)" }} />

                {steps.map((step, i) => (
                  <div key={i} className="relative z-10 flex flex-col items-center" style={{ width: `${100 / 6}%` }}>
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${step.done ? "border-blue-500 bg-blue-500 text-white" :
                        step.active ? "border-blue-500 bg-white text-blue-500" :
                          "border-[#e0dbd4] bg-white text-[#ccc]"
                      }`}>
                      {step.done ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : step.icon === "dispute" ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /></svg>
                      ) : step.icon === "chat" ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </div>
                    <p className={`mt-2 text-center text-[10px] font-medium leading-tight ${step.active ? "text-blue-600" : step.done ? "text-[#1a1a1a]" : "text-[#bbb]"}`}>
                      {step.label}
                    </p>
                    {step.sublabel && (
                      <p className={`text-center text-[9px] ${step.active ? "text-blue-500" : "text-[#aaa]"}`}>{step.sublabel}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Resolution Status */}
              {resolutionPhase === 0 && (
                <div className="flex items-center justify-between rounded-xl border border-[#e0dbd4] bg-[#faf8f5] p-4 cursor-pointer hover:bg-[#f5f0ea] transition"
                  onClick={startResolution}>
                  <div>
                    <p className="text-sm text-[#6b6b6b]">
                      {stakeNum > 0
                        ? "Simulate: AI detects a node passed malicious code through audit"
                        : "Click to simulate the resolution process"}
                    </p>
                    <p className="text-xs text-[#aaa] mt-1">
                      {stakeNum > 0
                        ? <>Bond at risk: <strong className="text-[#1a1a1a]">{stakeNum.toFixed(4)} tDCAI</strong></>
                        : "Stake tDCAI above to enable on-chain slashing"}
                    </p>
                  </div>
                  <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 transition">
                    Start Resolution
                  </button>
                </div>
              )}

              {resolutionPhase >= 1 && resolutionPhase < 6 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-700 font-medium">
                    {resolutionPhase === 1 && "AI flagged suspicious code pattern..."}
                    {resolutionPhase === 2 && "Dispute window open — waiting for challenges..."}
                    {resolutionPhase === 3 && "First round voting — AI agents casting votes..."}
                    {resolutionPhase === 4 && "Discussion — 3 AI agents debating the evidence..."}
                    {resolutionPhase === 5 && "Second round voting — final consensus forming..."}
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-1000"
                      style={{ width: `${(resolutionPhase / 6) * 100}%` }} />
                  </div>
                </div>
              )}

              {slashed && (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <p className="text-sm font-medium text-[#1a1a1a]">Market resolved: <span className="text-emerald-600 font-bold">Yes</span></p>
                  </div>

                  <div className="rounded-xl border border-red-200 bg-red-50 p-5">
                    <p className="text-red-600 font-bold text-sm">Bond slashed</p>
                    <p className="mt-1 text-sm text-red-500">
                      The AI audit confirmed malicious code was passed through. The result didn&apos;t change from the original proposal. Your bond of <strong>{stakeNum > 0 ? stakeNum.toFixed(4) : "0.0010"} tDCAI</strong> has been slashed.
                    </p>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Not connected */}
        {!wallet && (
          <div className="mt-10 rounded-2xl border border-[#e0dbd4] bg-white p-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-[#8a8580]">Connect your wallet to view your profile</p>
            <p className="mt-2 text-sm text-[#aaa]">DCAI L3 (Chain 18441)</p>
          </div>
        )}
      </main>
    </div>
  );
}
