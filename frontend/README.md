# Validus — AI-Powered Security Audit Platform

## The Problem: Open Source Supply Chain Attacks

In 2025, the `colors.js` and `faker.js` npm packages were intentionally sabotaged by their own maintainer, injecting infinite loops and corrupting data for millions of downstream applications. This wasn't an isolated incident — the `event-stream` attack in 2018 injected cryptocurrency-stealing malware into a package with 2 million weekly downloads, and the `ua-parser-js` hijack in 2021 distributed cryptominers to 8 million users.

**The core problem:** developers blindly trust open-source dependencies. A single malicious update can cascade through the entire software supply chain, and there is no decentralized, transparent, incentive-aligned system to catch these attacks before they ship.

## The Solution: Validus

Validus is a decentralized AI-powered security audit platform that scans npm packages for malicious code, vulnerabilities, and supply chain risks. Every audit result is stored on-chain for full transparency, and AI node providers are economically incentivized through staking to deliver accurate, honest audits.

### How It Works

1. **Connect Wallet** — Connect your OKX wallet to DCAI L3 network
2. **Top Up Credits** — Deposit tDCAI to get access to audit services (credits recorded on-chain)
3. **Submit Package** — Enter an npm package name (e.g., `color`) to audit
4. **AI Agent Pipeline** — 4-phase automated analysis:
   - **Phase 1: Dependency Scan** — Map all dependencies, check for known vulnerabilities
   - **Phase 2: Swarm AI Analysis + Risk Scoring** — Multiple AI agents independently analyze code and produce consensus risk scores
   - **Phase 3: Exploit Test Generation** — Generate and run exploit tests to verify vulnerabilities
   - **Phase 4: Sandbox Verification** — Execute package in an isolated sandbox to confirm behavior
5. **On-Chain Report** — Results are stored on DCAI chain with full audit trail

### How We Utilize Dash & DCAI

| Feature | How It Works |
|---------|-------------|
| **Dash Platform** | Identity management, DPNS naming, data contract storage for audit metadata |
| **DCAI L3 (Chain 18441)** | EVM-compatible chain for smart contracts, staking, and on-chain reports |
| **Top Up** | Users send tDCAI to the ValidusStaking contract — credits are recorded on-chain and used to pay for audit services |
| **Stake** | AI node providers lock tDCAI as collateral to participate in the audit network — honest work earns staking rewards |
| **Slash** | If an AI node provider submits a dishonest audit (e.g., claims malicious code is safe), their entire stake is slashed through the on-chain resolution process |
| **On-Chain Reports** | Every audit report is submitted to the ValidusReport contract — anyone can query and verify results |

### Resolution & Dispute System

When a potential threat is detected:

1. **Outcome Proposed** — Swarm AI flags malicious code (outcome: Yes)
2. **Dispute Window** — Anyone can challenge by putting up a bond
3. **First Round Voting** — AI agents vote on the outcome
4. **Discussion** — Multiple AI agents debate the findings
5. **Second Round Voting** — Final consensus vote
6. **Final Outcome** — If the original finding stands, the disputer's bond is slashed

This mechanism ensures node providers keep their AI models updated and honest, and users get the best audit service possible.

---

## On-Chain Deployments (DCAI L3 — Chain ID 18441)

### Smart Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| **ValidusStaking** | `0x47423b0286099CFF00B6Bc2830674CED8caf2BFf` | Top-up credits, staking, and slashing |
| **ValidusReport** | `0x7fD01C2d75E271e34eF7ABec9BB9Da2C4E78f8Da` | On-chain audit report storage & querying |

### Pre-deployed DCAI Contracts (Reference)

| Contract | Address |
|----------|---------|
| OperatorRegistry | `0xb37c81eBC4b1B4bdD5476fe182D6C72133F41db9` |
| MerkleRewardDistributor | `0x728f2C63b9A0ff0918F5ffB3D4C2d004107476B7` |
| Builder Pass NFT | `0x08A8C0497f2756676dEeE5ba32935B2152adF968` |

### Key Transactions

| Description | Tx Hash |
|------------|---------|
| ValidusStaking deployment | Contract created at `0x47423b0286099CFF00B6Bc2830674CED8caf2BFf` |
| ValidusReport deployment | Contract created at `0x7fD01C2d75E271e34eF7ABec9BB9Da2C4E78f8Da` |
| Code quality report submitted | `0x6b0c1a1a972ef09144be37dceca056e4ec3b262c6cd700577e02bcaa5ba47668` |
| Top-up test (0.001 tDCAI) | Confirmed via Hardhat — credits: 0.005 tDCAI |

### Network Details

| Parameter | Value |
|-----------|-------|
| Network | DCAI L3 Testnet |
| Chain ID | 18441 |
| RPC | `http://139.180.188.61:8545` |
| Explorer | `http://139.180.140.143:3002` |
| Gas Token | tDCAI (18 decimals) |
| Consensus | Proof of Authority |
| Block Time | ~2 seconds |

---

## Setup

```bash
cd frontend
cp .env.example .env
# Fill in DASH_IDENTITY_ID, EVOGUARD_PRIVATE_KEY_WIF
npm install
npm run dev
```

### Hardhat (Smart Contracts)

```bash
cd backend
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network dcai
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Main dashboard — package search, audit quotes, scan initiation |
| `/report2` | Detailed audit report with on-chain findings, risk scores, explorer links |
| `/dcai/stack` | DCAI staking dashboard — top up, stake, slash, submit reports |
| `/profile` | User profile — wallet info, staking, resolution system demo |
| `/evoguard` | Dash Platform identity validation and contract deployment |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/dcai/rpc` | POST | Proxy for DCAI RPC (bypasses CORS) |
| `/api/dcai/send-tx` | POST | Server-side transaction signing and broadcasting |
| `/api/dcai/query-reports` | GET | Query on-chain audit reports by ID or auditor |
| `/api/evoguard/status` | GET | Dash Platform identity status |
| `/api/evoguard/contract/deploy` | POST | Deploy data contract on Dash Platform |
