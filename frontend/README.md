# Validus — AI-Powered Security Audit Platform

## The Problem: Open Source Supply Chain Attacks

In 2025, the `colors.js` and `faker.js` npm packages were intentionally sabotaged by their own maintainer, injecting infinite loops and corrupting data for millions of downstream applications. This wasn't an isolated incident — the `event-stream` attack in 2018 injected cryptocurrency-stealing malware into a package with 2 million weekly downloads, and the `ua-parser-js` hijack in 2021 distributed cryptominers to 8 million users.

**The core problem:** developers blindly trust open-source dependencies. A single malicious update can cascade through the entire software supply chain, and there is no decentralized, transparent, incentive-aligned system to catch these attacks before they ship.

### Real-World Attack Scenarios

1. **Crypto Address Hijacking** — You think your app is sending crypto to your wallet. But the package quietly changes the address. So the money goes to the attacker instead. Your users lose funds and you have no idea until it's too late.

2. **Secret Exfiltration via Update** — You update a normal developer tool. But the update is fake. Once installed, it starts snooping around your computer and steals secrets like tokens, keys, or environment variables. One compromised dependency = full access to your infrastructure.

3. **Poisoned Trust Chain** — Imagine your friend gives you a box of screws. You trust the box because your friend always gives good stuff. But this time, someone secretly swapped one screw with a tiny bomb. You use the whole box, and now the bad part gets into your project. Even trusted packages can become dangerous if one update is poisoned.

### Why This Matters Beyond Tech — BGA Impact

**NGOs:** A small NGO uses an open-source donor management app. One of its npm dependencies is updated with malicious code that silently steals environment variables during install. The leaked secrets include the NGO's database credentials and email API keys, exposing donor data and forcing the NGO to shut down its donation portal for days. A dependency-audit tool like Validus could flag the suspicious install script, outbound network calls, and secret-access behavior before deployment — protecting the donors and the organization's mission.

**Schools:** A school IT team installs a package update for its learning portal. The package contains hidden malware that exfiltrates student records and admin tokens. Student names, grades, and parent contact information are leaked. Validus would scan the package before installation and warn the team before the malicious update reaches production — keeping student data safe.

**Low-Budget Startups:** A bootstrapped startup with no dedicated security team ships a product built on 200+ npm packages. They can't afford a manual security audit for each dependency. One malicious package update slips in, and their entire user database is compromised before they even launch. Validus provides automated, affordable, AI-powered auditing that any team can access — no security budget required, just top up tDCAI and scan.

**The common thread:** organizations that can least afford a breach are the most vulnerable. Validus makes enterprise-grade supply chain security accessible to everyone through decentralized AI and transparent on-chain accountability.

---

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

## How We Utilize Dash Platform

Dash Platform provides the identity and data layer for Validus:

| Feature | How It Works |
|---------|-------------|
| **Identity Management** | Each auditor and user has a Dash Platform identity tied to their on-chain actions |
| **DPNS Naming** | Human-readable aliases (e.g., `validus.dash`) for identity resolution |
| **Data Contracts** | Structured audit metadata stored on Dash Platform for cross-chain discoverability |
| **Ceiling Estimates** | Scan pricing quotes are generated based on billable lines and estimated time, denominated in tDASH |

---

## How We Utilize DCAI L3

DCAI L3 is the EVM-compatible execution layer where all financial and audit logic runs:

| Feature | How It Works |
|---------|-------------|
| **Top Up** | Users send tDCAI to the ValidusStaking contract — credits are recorded on-chain and used to pay for audit services |
| **Stake** | AI node providers lock tDCAI as collateral to participate in the audit network — honest work earns staking rewards |
| **Slash** | If an AI node provider submits a dishonest audit (e.g., claims malicious code is safe), their entire stake is slashed through the on-chain resolution process |
| **On-Chain Reports** | Every audit report is submitted to the ValidusReport contract — anyone can query and verify results |
| **Builder Pass NFT** | Access control via ERC-721 token ownership on DCAI L3 |

---

## On-Chain Deployments

### Dash Platform

| Resource | Identifier |
|----------|------------|
| **Platform Identity** | `DkFeADqFup7kxWPZAW9ZMrY4MvxCq2u9Tm4dz8vM8cWv` |
| **Data Contract** | `7HWCuY12REWbP68wQDcmtCPuZA8Cncjv9ZafyXdqXgf6` |

### Smart Contracts (DCAI L3 — Chain ID 18441)

| Contract | Address | Purpose |
|----------|---------|---------|
| **ValidusStaking** | `0x47423b0286099CFF00B6Bc2830674CED8caf2BFf` | Top-up credits, staking, and slashing |
| **ValidusReport** | `0x7fD01C2d75E271e34eF7ABec9BB9Da2C4E78f8Da` | On-chain audit report storage & querying |

### Key Transactions

| Description | Tx Hash |
|------------|---------|
| ValidusStaking deployment | Contract created at `0x47423b0286099CFF00B6Bc2830674CED8caf2BFf` |
| ValidusReport deployment | Contract created at `0x7fD01C2d75E271e34eF7ABec9BB9Da2C4E78f8Da` |
| Code quality report submitted | `0x6b0c1a1a972ef09144be37dceca056e4ec3b262c6cd700577e02bcaa5ba47668` |
| Top-up test (0.001 tDCAI) | Confirmed via Hardhat — credits: 0.005 tDCAI |

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
