<div align="center">

  <img src="https://img.shields.io/badge/V_A_L_I_D_U_S-142c4f?style=for-the-badge&logoColor=c3af97" alt="Validus Banner" height="75" />

  <p>
    <strong>A high-end, production-grade Dash Platform prototype for publishing and retrieving decentralized package audit metadata.</strong>
  </p>

  <p>
    <a href="#overview">Overview</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#api-reference">API Reference</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Status-Active_Development-success?style=flat-square" alt="Status" />
    <img src="https://img.shields.io/badge/Environment-Dash_Testnet-008CE7?style=flat-square&logo=dash" alt="Dash Testnet" />
    <img src="https://img.shields.io/badge/TypeScript-Strict-007ACC?style=flat-square&logo=typescript" alt="TypeScript" />
  </p>
</div>

<hr />

## Overview

**Validus** is an advanced, production-standard prototype designed to interact seamlessly with the **Dash Platform testnet**. Our core objective is to formulate a decentralized trust anchoring system for package audit metadata. 

By avoiding mnemonic exposure and strictly leveraging identity IDs and private keys securely matched to on-chain public keys, Validus ensures high-security interactions without compromising on developer experience.

> **Phase 1 & 2 Focus:**
> - **Identity Validation:** Validate pre-existing Dash Platform identities.
> - **Key Capabilities Analysis:** Inspect whether a supplied private key can sign for an identity.
> - **Contract Lifecycle:** Define and publish an `auditReport` data contract.
> - **Decentralized Retrieval:** Fetch deployed contracts securely from Dash Platform.

<br />

## Core Capabilities

<table width="100%">
  <tr>
    <td width="50%" valign="top">
      <h3>Smart Identity Validation</h3>
      <p>The core engine safely validates identity states directly against the Dash testnet:</p>
      <ul>
        <li>Fetches real-time Dash Platform identity states by <code>ID</code>.</li>
        <li>Monitors transparent testnet balances.</li>
        <li>Performs cryptographic matching of configured private keys against on-chain identity keys.</li>
        <li>Confirms execution privileges.</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>Dynamic Contract Flow</h3>
      <p>A seamless data pipeline backing our decentralized data contracts:</p>
      <ul>
        <li>Locally provisioned <code>auditReport</code> contract schemas.</li>
        <li>High-fidelity <strong>Deploy APIs</strong> using the native <code>@dashevo/evo-sdk</code>.</li>
        <li>Secure <strong>Fetch APIs</strong> to rapidly verify contract deployment status and state.</li>
        <li>Comprehensive <strong>Admin Interface</strong> surfacing platform metrics.</li>
      </ul>
    </td>
  </tr>
</table>

<br />

## Architecture

Validus relies on a well-structured and separated architecture to ensure maintainability and modularity.

```text
nottshack2026/
├── frontend/              # Next.js 16 core application, UI services, and API routes
├── backend/               # Auxiliary microservices, notes, and backend structures
├── IMPLEMENTATION.md      # Live technical implementation plan and architectural decisions
└── README.md              # Project documentation
```

---

## Features

### 🔐 1. Smart Identity Validation
The core engine safely validates identity states directly against the Dash testnet:
- Fetches real-time Dash Platform identity states by `ID`.
- Monitors transparent testnet balances.
- Performs cryptographic matching of configured private keys against on-chain identity keys.
- Confirms execution privileges (e.g., name registration, contract deployment).

### 📜 2. Dynamic Contract Flow
A seamless data pipeline backing our decentralized data contracts:
- Locally provisioned `auditReport` contract schemas.
- High-fidelity **Deploy APIs** using the native `@dashevo/evo-sdk`.
- Secure **Fetch APIs** to rapidly verify contract deployment status and state.
- A comprehensive **Admin Interface** surfacing identity metrics, key capability checks, DPNS integrations, and real-time contract statuses.

### 💻 3. Polished UI Surfaces
- **`/`** - Dynamic Landing Page for Validus infrastructure.
- **`/test`** - Administration console mapping platform metrics.
- **`/report`** - Public audit report ledger and verification interface.

---

## Tech Stack

Validus is built leveraging modern tools offering top-tier scalability, type-safety, and aesthetic consistency.

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router & API capabilities)
- **Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) for robust static typing
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) for utility-first responsive aesthetics
- **Blockchain SDK**: [`@dashevo/evo-sdk`](https://www.npmjs.com/package/@dashevo/evo-sdk)

---

## Getting Started

### Prerequisites
- Node.js `v20+`
- A verified Dash Platform Testnet Identity ID.
- The corresponding private key (Hex or WIF format) capable of signing contracts.

### 1. Installation

```bash
git clone https://github.com/lapsapthong-16/nottshack2026.git
cd nottshack2026/frontend
npm install
```

### 2. Environment Configuration

Bootstrap your environment by utilizing the provided template:

```bash
cp .env.example .env
```

Populate `.env` with your secure credentials:

```ini
NETWORK=testnet
DASH_IDENTITY_ID=
DASH_PRIVATE_MASTER_AUTH=
DASH_PRIVATE_CRITICAL_AUTH=
DASH_PRIVATE_HIGH_AUTH=
DASH_PRIVATE_CRITICAL_TRANS=
```

> **Security Note:** `PLATFORM_MNEMONIC` is optional, required only for legacy utilities within the ecosystem, but strictly bypassed in the refined Validus flow for enhanced security.

### 3. Execution

```bash
# From the frontend directory
npm run dev
```

Navigate to `http://localhost:3000` to interact with Validus.

---

## API Reference

Validus exposes robust internal endpoints handling the heavy lifting of Dash Platform interactivity.

- `GET /api/evoguard/status` – Resolves Identity configuration and returns balance & cryptographic signing validations.
- `GET /api/evoguard/contract` – Retrieves full `auditReport` contract deployment status and schema IDs.
- `POST /api/evoguard/contract/deploy` – Commits the data contract to testnet securely.
- `POST /api/evoguard/dpns/register` – Initializes DPNS naming operations mapping aliases to platform IDs.

---

## Strategic Constraints & Security Policy

Validus employs a stringent zero-mnemonic operational policy designed for production safety.

Unlike older SDK iterations, this infrastructure leverages direct signature derivation, requiring:
1. Valid Dash Platform **Identity ID**.
2. A properly formatted **Private Key** correctly corresponding to bounds in the Identity's active public keys.
3. Adequate testnet balance and administrative node capability attached to that identity.

If criteria are unmet, Validus will gracefully fall back, block deployment procedures, and log extensive telemetry highlighting capability failure.

---

## Build, Lint, and Validation Check

```bash
cd frontend
npm run lint
npx next build --webpack
```
*Note: Using the `--webpack` flag circumvents potential Turbopack processing sandboxes depending on restrictive CI orchestration environments.*

---

## Product Roadmap

- [x] Dash Identity Network Resolution
- [x] Stateless Private Key Authorization Layer  
- [x] DPNS Verification Status Handling  
- [x] End-to-End Testnet Contract Deploy API  
- [x] Validus Advanced User Administration Console  
- [ ] Automated Pipeline Package Metadata Extraction
- [ ] On-chain Storage Engine for Decentralized Audit Publication
- [ ] Decentralized CLI Interrogation
- [ ] Tiered / Payment-triggered audit mechanisms
