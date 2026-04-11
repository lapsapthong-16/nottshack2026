# DCAI L3 Development Skill

When the user asks you to write DCAI code, use these chain details, endpoints, and patterns.

---

## Chain Details

| Field | Value |
|-------|-------|
| Chain ID | `18441` (hex: `0x4809`) |
| Network Name | DCAI L3 Testnet |
| Gas Token | tDCAI (18 decimals) |
| Block Time | ~2s |
| Consensus | PoA (Clique-based validator set) |
| EVM | 100% compatible |
| Direct RPC | `http://139.180.188.61:8545` |
| Unified RPC Gateway | `http://139.180.140.143/rpc/` (API key required — ask organizer) |
| WebSocket Gateway | `ws://139.180.140.143/ws/` (API key required — ask organizer) |
| Explorer (Blockscout) | `http://139.180.140.143/` |
| Explorer Dashboard | `http://139.180.140.143:3002/dashboard` |
| Faucet Address | `0xefD5198c51c4cBA11283156d31D4dB6c0200A0A9` |

---

## Faucet

**Check status:**
```
GET http://139.180.140.143/faucet/
```
Returns:
```json
{
  "chainId": 18441,
  "rpc": "http://139.180.188.61:8545",
  "faucetAddress": "0xefD5198c51c4cBA11283156d31D4dB6c0200A0A9",
  "sendAmountWei": "1000000000000000000",
  "cooldownSeconds": 3600
}
```

**Claim tokens (1 tDCAI, 1hr cooldown):**
```
POST http://139.180.140.143/faucet/request
Content-Type: application/json
Body: { "address": "0x..." }
```
Returns:
```json
{ "ok": true, "txHash": "0x..." }
```

**JavaScript:**
```javascript
const getFaucetStatus = async () => {
  const response = await fetch('http://139.180.140.143/faucet/');
  return await response.json();
};

const claimTokens = async (address) => {
  const res = await fetch('http://139.180.140.143/faucet/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  return res.json(); // { ok: true, txHash: "0x..." }
};
```

---

## Builder Pass NFT (ERC-721)

| Field | Value |
|-------|-------|
| Contract | `0x08A8C0497f2756676dEeE5ba32935B2152adF968` |
| Standard | ERC-721 |
| Name | DCAI Builder Pass |
| Symbol | DBPASS |
| Mint selector | `0x755edd17` (mintTo) |
| balanceOf selector | `0x70a08231` |
| Description | Grants gated access, wallet-based verification, and participant identity for NottsHack x DCAI |

**Check if address owns a Builder Pass:**
```javascript
// eth_call to balanceOf(address)
const data = '0x70a08231' + address.slice(2).padStart(64, '0');
const result = await provider.call({
  to: '0x08A8C0497f2756676dEeE5ba32935B2152adF968',
  data,
});
const balance = parseInt(result, 16); // > 0 means they own a pass
```

**Status API (includes pass ownership + participant info):**
```javascript
const checkStatus = async (address) => {
  const res = await fetch(
    `https://workshop.skybutter.com/404/api/status.php?address=${address}`
  );
  return res.json();
};
// Returns:
// {
//   ok: true,
//   status: {
//     address, connected: true, chainId: "0x4809", chainIdDecimal: 18441,
//     contract: "0x08A8C0497f2756676dEeE5ba32935B2152adF968",
//     passName: "DCAI Builder Pass", passSymbol: "DBPASS",
//     passImage: "https://workshop.skybutter.com/404/metadata/dcai-builder-pass/dcai-builder-pass-monster.png",
//     tokenBalance: "0", ownsPass: false,
//     participant: null, assignedPass: null
//   }
// }
```

**Token metadata URL pattern:**
```
https://workshop.skybutter.com/404/metadata/dcai-builder-pass/{tokenId}.json
```

NFT attributes: Collection (DCAI Builder Pass), Pass Type (Hackathon Access), Network (DCAI L3), Chain ID (18441), Tier (Builder), Theme (Pixel Monster Variant).

---

## Pre-deployed Contracts

Don't write your own contracts unless you have to. Use these pre-audited ones.

| Contract | Address | Purpose |
|----------|---------|---------|
| OperatorRegistry | `0xb37c81eBC4b1B4bdD5476fe182D6C72133F41db9` | Operator status and rewards eligibility |
| MerkleRewardDistributor | `0x728f2C63b9A0ff0918F5ffB3D4C2d004107476B7` | Rewards distribution for published reward epochs |
| Builder Pass NFT | `0x08A8C0497f2756676dEeE5ba32935B2152adF968` | ERC-721 hackathon access pass |

---

## Rewards Epoch

```
GET http://139.180.140.143/rewards/latest.json
```
Returns:
```json
{
  "epochId": "202603191100",
  "dayId": "20260319",
  "scoringVersion": "v0.2-breakdown"
}
```

---

## Connect with ethers.js

```javascript
import { ethers } from 'ethers';

// Direct RPC (no API key needed)
const provider = new ethers.JsonRpcProvider('http://139.180.188.61:8545');

// Or unified RPC gateway (API key required — ask organizer)
const provider = new ethers.JsonRpcProvider('http://139.180.140.143/rpc/');

// Check connection
const chainId = await provider.getNetwork();
console.log('Chain ID:', chainId.chainId); // 18441n

// Get balance
const balance = await provider.getBalance('0x...');
console.log('Balance:', ethers.formatEther(balance), 'tDCAI');

// Get block number
const block = await provider.getBlockNumber();
```

## Add Chain to MetaMask (Frontend)

```javascript
await window.ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x4809',
    chainName: 'DCAI L3 Testnet',
    nativeCurrency: { name: 'tDCAI', symbol: 'tDCAI', decimals: 18 },
    rpcUrls: ['http://139.180.188.61:8545'],
    blockExplorerUrls: ['http://139.180.140.143/'],
  }],
});
```

## Switch to DCAI Chain

```javascript
try {
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: '0x4809' }],
  });
} catch (err) {
  if (err.code === 4902) {
    // Chain not added yet, add it
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0x4809',
        chainName: 'DCAI L3 Testnet',
        nativeCurrency: { name: 'tDCAI', symbol: 'tDCAI', decimals: 18 },
        rpcUrls: ['http://139.180.188.61:8545'],
        blockExplorerUrls: ['http://139.180.140.143/'],
      }],
    });
  }
}
```

---

## Raw JSON-RPC Examples

```bash
# Get chain ID
curl -s http://139.180.188.61:8545 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
# Returns: "0x4809"

# Get balance
curl -s http://139.180.188.61:8545 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["0x...","latest"]}'

# Read contract (balanceOf)
curl -s http://139.180.188.61:8545 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x08A8C0497f2756676dEeE5ba32935B2152adF968","data":"0x70a08231000000000000000000000000YOUR_ADDRESS_NO_0x"},"latest"]}'
```

---

## Portal API Endpoints (workshop.skybutter.com)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/404/api/status.php?address=0x...` | GET | Check Builder Pass ownership + participant info |
| `/404/api/participant-wallet.php` | POST | Submit team wallet `{teamName, walletAddress}` |
| `/404/api/team-wallet-submissions.php` | GET | List submissions (admin, needs X-Admin-Token) |
| `/404/api/operation-report.php` | GET/POST | Get or save project submission (needs sessionToken) |
| `/404/api/verify.php` | POST | Wallet verification / auth challenge |
| `/404/api/mint-pass.php` | POST | Mint Builder Pass NFT |
| `/404/api/rpc-proxy.php` | POST | RPC proxy to DCAI L3 |

**Operation Report (project submission):**
```javascript
// Save draft
await fetch('https://workshop.skybutter.com/404/api/operation-report.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionToken: token,
    action: 'save', // or 'submit' for final
    projectName: 'EvoGuard',
    tagline: 'AI npm security auditor',
    shortDescription: '...',
    fullDescription: '...',
    githubUrl: 'https://github.com/...',
    demoUrl: 'https://...',
  }),
});
```

---

## Integration Architecture

The standard DCAI L3 app architecture:

```
Frontend App (React/Mobile) → Dev API (Node.js/Python) → DCAI L3 Chain (RPC/Contracts) → User Result (Badge/Reward)
```

### Example Flows

1. **Read-Only Dashboard** — App requests balance → API calls RPC endpoint → Chain returns data
2. **Proof Issuance** — App submits name → API signs transaction → Chain mints NFT badge
3. **Game Rewards** — App completes level → API verifies score → Chain sends tokens

---

## Judging Criteria

| Criterion | What judges look for |
|-----------|---------------------|
| Creativity | Is the idea novel? Does it solve a problem in a unique way? |
| Usefulness / Fun | Would people actually use this? Is it engaging? |
| Technical Execution | Does the code work? Is the architecture sound? |
| Meaningful Chain Integration | Does it actually need a blockchain? Is the chain used effectively? |
| Polish / Demo | Is the UI clean? Was the presentation clear and compelling? |

**Pro Tip:** Judges will almost always ask: "Why does this need to be on a blockchain?" Have a solid answer (e.g., transparency, verifiable ownership, interoperability, censorship resistance).

## Integration Requirements

Your project MUST have real DCAI L3 interaction. Valid integrations:
- Wallet connect to chain 18441
- RPC calls to read chain data
- Smart contract reads/writes on DCAI L3
- Builder Pass NFT ownership check (token-gating)
- Faucet usage
- Deploying a contract on DCAI L3

**Key rule:** "A small working demo is better than a big broken one."
**Avoid:** Fake blockchain screens, mock-only data, demos that don't match code.

---

## How to Win

### Good Scope (do this)
- 1 user role, 1 clear flow
- Use pre-deployed contracts and simple API calls
- Use a UI library (like shadcn) to build fast
- Demo works perfectly and tells a clear story

### Bad Scope (avoid this)
- Multiple user roles, complex tokenomics, governance, DEX
- Writing 3+ smart contracts from scratch
- Spending 12 hours on CSS
- Demo crashes because backend isn't connected

### What Judges Actually Remember
1. **The Problem** — Did you clearly explain *why* this needs to exist?
2. **The "Aha!" Moment** — That one click where the magic happens (e.g., NFT appears in wallet)
3. **It Actually Worked** — Simple app that works beats complex app that crashes

---

## Key Addresses

| Role | Address |
|------|---------|
| Faucet | `0xefD5198c51c4cBA11283156d31D4dB6c0200A0A9` |
| Builder Pass NFT | `0x08A8C0497f2756676dEeE5ba32935B2152adF968` |
| OperatorRegistry | `0xb37c81eBC4b1B4bdD5476fe182D6C72133F41db9` |
| MerkleRewardDistributor | `0x728f2C63b9A0ff0918F5ffB3D4C2d004107476B7` |
| DCAI Token (Base mainnet) | `0xb8147ce9b0dac5f8165785dec6494e57748e4b78` |
| Staking (Base mainnet) | `0xc26951b472906a8d44762ec189037bccf7756be9` |
