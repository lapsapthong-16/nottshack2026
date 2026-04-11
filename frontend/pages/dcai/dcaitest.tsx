import { useState } from "react";
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const DCAI_CHAIN_ID = "0x4809";
const DCAI_RPC = "http://139.180.188.61:8545";
const EXPLORER = "http://139.180.140.143";

const OPERATOR_REGISTRY = "0xb37c81eBC4b1B4bdD5476fe182D6C72133F41db9";
const MERKLE_REWARD = "0x728f2C63b9A0ff0918F5ffB3D4C2d004107476B7";
const BUILDER_PASS = "0x08A8C0497f2756676dEeE5ba32935B2152adF968";

// Minimal ABIs for read calls
const OPERATOR_ABI = [
  "function owner() view returns (address)",
];
const REWARD_ABI = [
  "function owner() view returns (address)",
];
const PASS_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

export default function DcaiTest() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  // 1) Connect Wallet
  const connectWallet = async () => {
    setLoading("connect");
    try {
      if (!window.ethereum) {
        log("No MetaMask found. Install MetaMask.");
        return;
      }

      // Request accounts
      const accounts: string[] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      // Switch to DCAI chain
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: DCAI_CHAIN_ID }],
        });
      } catch (err: any) {
        if (err.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: DCAI_CHAIN_ID,
                chainName: "DCAI L3 Testnet",
                nativeCurrency: { name: "tDCAI", symbol: "tDCAI", decimals: 18 },
                rpcUrls: [DCAI_RPC],
                blockExplorerUrls: [EXPLORER],
              },
            ],
          });
        }
      }

      setWallet(accounts[0]);
      log(`Connected: ${accounts[0]}`);

      // Show balance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(accounts[0]);
      log(`Balance: ${ethers.formatEther(balance)} tDCAI`);
    } catch (err: any) {
      log(`Connect error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  // 2) Pay 0.001 tDCAI
  const payTDCAI = async () => {
    if (!wallet) return log("Connect wallet first");
    setLoading("pay");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const tx = await signer.sendTransaction({
        to: wallet, // send to self for testing
        value: ethers.parseEther("0.001"),
      });

      log(`Tx sent: ${tx.hash}`);
      log(`Explorer: ${EXPLORER}/tx/${tx.hash}`);

      const receipt = await tx.wait();
      log(`Confirmed in block ${receipt?.blockNumber}`);
    } catch (err: any) {
      log(`Pay error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  // 3) Test pre-deployed contracts
  const testContracts = async () => {
    if (!wallet) return log("Connect wallet first");
    setLoading("contracts");
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);

      log("--- Builder Pass NFT ---");
      const pass = new ethers.Contract(BUILDER_PASS, PASS_ABI, provider);
      const name = await pass.name();
      const symbol = await pass.symbol();
      const bal = await pass.balanceOf(wallet);
      log(`Name: ${name} (${symbol})`);
      log(`Your balance: ${bal.toString()} passes`);
      log(`Owns pass: ${Number(bal) > 0 ? "YES" : "NO"}`);

      log("--- OperatorRegistry ---");
      const opReg = new ethers.Contract(OPERATOR_REGISTRY, OPERATOR_ABI, provider);
      try {
        const opOwner = await opReg.owner();
        log(`Registry owner: ${opOwner}`);
      } catch {
        log("Could not read owner (may need different ABI)");
      }
      log(`Contract: ${EXPLORER}/address/${OPERATOR_REGISTRY}`);

      log("--- MerkleRewardDistributor ---");
      const reward = new ethers.Contract(MERKLE_REWARD, REWARD_ABI, provider);
      try {
        const rwOwner = await reward.owner();
        log(`Distributor owner: ${rwOwner}`);
      } catch {
        log("Could not read owner (may need different ABI)");
      }
      log(`Contract: ${EXPLORER}/address/${MERKLE_REWARD}`);
    } catch (err: any) {
      log(`Contract error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "monospace", padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>DCAI L3 Test Page</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>
        Chain ID: 18441 | Token: tDCAI | Block time: ~2s
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          onClick={connectWallet}
          disabled={loading === "connect"}
          style={btnStyle(wallet ? "#22c55e" : "#3b82f6")}
        >
          {loading === "connect" ? "Connecting..." : wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Connect Wallet"}
        </button>

        <button
          onClick={payTDCAI}
          disabled={loading === "pay" || !wallet}
          style={btnStyle("#f59e0b")}
        >
          {loading === "pay" ? "Sending..." : "Pay 0.001 tDCAI"}
        </button>

        <button
          onClick={testContracts}
          disabled={loading === "contracts" || !wallet}
          style={btnStyle("#8b5cf6")}
        >
          {loading === "contracts" ? "Reading..." : "Test Contracts"}
        </button>
      </div>

      {/* Log output */}
      <div
        style={{
          background: "#111",
          color: "#0f0",
          padding: 16,
          borderRadius: 8,
          minHeight: 200,
          maxHeight: 400,
          overflowY: "auto",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {logs.length === 0 && <span style={{ color: "#555" }}>Logs will appear here...</span>}
        {logs.map((l, i) => (
          <div key={i}>{`> ${l}`}</div>
        ))}
      </div>

      {logs.length > 0 && (
        <button
          onClick={() => setLogs([])}
          style={{ marginTop: 8, background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 12 }}
        >
          Clear logs
        </button>
      )}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "10px 20px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: 600,
  };
}
