<p align="center">
  <img src="https://img.shields.io/badge/Dash-008DE4?style=for-the-badge&logo=dash&logoColor=white" alt="Dash">
  <img src="https://img.shields.io/badge/Blockchain_for_Good-00C853?style=for-the-badge" alt="BGA">
  <img src="https://img.shields.io/badge/DCAI_Ecosystem-8A2BE2?style=for-the-badge" alt="DCAI">
</p>

<h1 align="center">🛡️ TrustLink</h1>
<p align="center">
  <strong>Decentralized Trust & Escrow for the Gig Economy.</strong><br>
  <em>Built for NottsHack 2026</em>
</p>

---

## 💡 The Inspiration
The global freelance economy is booming, encompassing over **1.5 billion people**. Yet, the infrastructure supporting it is broken. According to industry reports, over **70% of freelancers** face payment delays exceeding 60 days, and billions are lost annually to wage theft and non-payment. 

**The Catch-22:** Clients don't trust unverified freelancers. However, freelancers cannot prove their historical income stability without exposing sensitive, private financial data to strangers. **TrustLink** solves this by replacing human trust with cryptographic truth.

## ⚙️ Core Architecture & Features

### 1. Zero-Knowledge Income Proofs (TEE)
Freelancers need to prove they are established professionals. TrustLink utilizes a **Trusted Execution Environment (TEE)** to securely analyze a freelancer's wallet transaction history. 
* **The Result:** It generates an on-chain "Consistent Earner" attestation badge. 
* **The Privacy:** The client sees the verifiable badge, but the freelancer's actual wallet balance and transaction amounts remain 100% hidden.

### 2. Trustless Peer-to-Peer Escrow (Dash Network)
Traditional platforms like Upwork take up to 20% in fees just to hold money in escrow. We built a decentralized alternative:
* **Lock:** Client funds are locked immediately using **Dash InstantSend**, eliminating any risk of double-spending.
* **Hold:** The funds are held by a decentralized **Masternode Quorum (LLMQ)**, meaning no single entity controls the money.
* **Release:** Once a TEE Job Attestation confirms the service was rendered, funds are auto-released, and **ZMQ** notifications instantly alert both parties.

### 3. Autonomous Risk Scoring (DCAI L3)
To assess ongoing reliability, TrustLink integrates an AI assistant deployed via the **DCAI ecosystem**. 
* The AI analyzes job completion speeds and dispute rates, logging an immutable reputation score directly to the **Base L3 network**.

## 🏆 Hackathon Track Alignment

* 🔵 **DASH:** TrustLink natively utilizes Dash's InstantSend for immediate payment locking and relies on Long-Living Masternode Quorums (LLMQ) for trustless escrow holding. HD wallets are used to ensure smooth Web2-like onboarding.
* 🟢 **Blockchain for Good Alliance (BGA):** Aligned with **SDG 8** (Decent Work) and **SDG 10** (Reduced Inequalities). TrustLink serves as public digital infrastructure that prevents wage fraud and provides financial security to unbanked gig workers in the Global South.
* 🟣 **DCAI:** Integrates an AI scoring agent that interacts with the DCAI L3 on Base to log dispute resolutions and compute decentralized reputation scores.

## 📚 References & Official Documentation

* [Dash InstantSend & LLMQ Official Documentation](https://docs.dash.org/en/stable/docs/core/guide/dash-features-instantsend.html)
* [Blockchain for Good Alliance (BGA) Mission](https://chainforgood.org/)
* [The Global Freelance Payment Delay Report 2026 (Jobbers)](https://www.jobbers.io/the-global-freelance-client-payment-delay-report-2025-why-63-of-freelancers-wait-over-30-days-to-get-paid/)
* [Reversing Late Payment Culture (Remote.com 2025 Report)](https://remote.com/blog/contractor-management/reversing-late-payment-culture)
