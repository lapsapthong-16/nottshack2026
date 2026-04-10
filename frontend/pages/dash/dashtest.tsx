import { useState } from "react";

export default function DashTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  const call = async (label: string, url: string, opts?: RequestInit) => {
    setLoading(label);
    try {
      log(`--- ${label} ---`);
      const res = await fetch(url, opts);
      const data = await res.json();
      if (data.ok) {
        log(JSON.stringify(data, null, 2));
      } else {
        log(`Error: ${data.error}`);
      }
    } catch (err: any) {
      log(`Error: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  // 1) Connect — check identity status from .env
  const connectIdentity = () =>
    call("Connect Identity", "/api/evoguard/status");

  // 2) Deploy Contract
  const deployContract = () =>
    call("Deploy Contract", "/api/evoguard/contract/deploy", { method: "POST" });

  // 3) Register DPNS
  const registerDpns = () =>
    call("Register DPNS", "/api/evoguard/dpns/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "evoguard" }),
    });

  // 4) Store test audit report
  const storeReport = () =>
    call("Store Audit Report", "/api/evoguard/document/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pkgName: "evil-package",
        version: "1.0.0",
        riskScore: 95,
        summary: "Contains obfuscated code that exfiltrates env vars to remote server.",
        malwareDetected: true,
        auditorSignature: "sha256:test123abc",
      }),
    });

  // 5) Seed sample reports from JSON file
  const seedReports = () =>
    call("Seed Sample Reports", "/api/evoguard/document/seed", { method: "POST" });

  // 6) Query all audit reports
  const queryAll = () =>
    call("Query All Reports", "/api/evoguard/document/query");

  // 7) Query malicious only
  const queryMalicious = () =>
    call("Query Malicious Only", "/api/evoguard/document/query?malicious=true");

  // 8) Register as Auditor on DCAI OperatorRegistry (server-side)
  const registerAuditor = () =>
    call("Register Auditor", "/api/dcai/register-operator", { method: "POST" });

  // 9) Reward Reporter via DCAI (server-side)
  const rewardReporter = () =>
    call("Reward Reporter", "/api/dcai/reward-reporter", { method: "POST" });

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "monospace", padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Dash Platform Test Page</h1>
      <p style={{ color: "#888", marginBottom: 8 }}>
        Network: testnet | SDK: @dashevo/evo-sdk | Identity + key from .env
      </p>
      <p style={{ color: "#666", marginBottom: 24, fontSize: 12 }}>
        All calls are server-side. Dash uses Evo SDK, DCAI uses ethers.js + private key from .env.
      </p>

      {/* Identity & Setup */}
      <Section title="Identity & Setup (Dash)">
        <Btn
          onClick={connectIdentity}
          loading={loading === "Connect Identity"}
          color="#3b82f6"
          label="Connect Identity"
        />
        <Btn
          onClick={deployContract}
          loading={loading === "Deploy Contract"}
          color="#8b5cf6"
          label="Deploy Contract"
        />
        <Btn
          onClick={registerDpns}
          loading={loading === "Register DPNS"}
          color="#06b6d4"
          label="Register DPNS (evoguard.dash)"
        />
      </Section>

      {/* Documents */}
      <Section title="Audit Reports (Dash Drive)">
        <Btn
          onClick={storeReport}
          loading={loading === "Store Audit Report"}
          color="#ef4444"
          label="Store Test Report (malware)"
        />
        <Btn
          onClick={seedReports}
          loading={loading === "Seed Sample Reports"}
          color="#f97316"
          label="Seed 10 Sample Reports"
        />
        <Btn
          onClick={queryAll}
          loading={loading === "Query All Reports"}
          color="#22c55e"
          label="Query All Reports"
        />
        <Btn
          onClick={queryMalicious}
          loading={loading === "Query Malicious Only"}
          color="#f59e0b"
          label="Query Malicious Only"
        />
      </Section>

      {/* DCAI On-Chain */}
      <Section title="DCAI On-Chain (Server-side)">
        <Btn
          onClick={registerAuditor}
          loading={loading === "Register Auditor"}
          color="#8b5cf6"
          label="Register as Auditor"
        />
        <Btn
          onClick={rewardReporter}
          loading={loading === "Reward Reporter"}
          color="#f59e0b"
          label="Reward Reporter"
        />
      </Section>

      {/* Log output */}
      <div
        style={{
          background: "#111",
          color: "#0f0",
          padding: 16,
          borderRadius: 8,
          minHeight: 200,
          maxHeight: 500,
          overflowY: "auto",
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          marginTop: 16,
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 14, color: "#aaa", marginBottom: 8 }}>{title}</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Btn({ onClick, loading, color, label }: {
  onClick: () => void;
  loading: boolean;
  color: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "10px 16px",
        background: loading ? "#555" : color,
        color: "#fff",
        border: "none",
        borderRadius: 6,
        cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "monospace",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {loading ? "Loading..." : label}
    </button>
  );
}
