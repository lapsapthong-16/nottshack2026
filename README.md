<div align="center">

  <img src="https://img.shields.io/badge/V_A_L_I_D_U_S-142c4f?style=for-the-badge&logoColor=c3af97" alt="Validus Banner" height="45" />

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
