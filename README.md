# EvoGuard

EvoGuard is a Dash Platform prototype for publishing and retrieving package audit metadata on testnet.

The current repo is focused on phases 1 and 2:

- validate a pre-existing Dash Platform identity
- inspect whether a supplied private key can sign for that identity
- define and publish an `auditReport` data contract
- fetch the deployed contract back from Dash Platform

The current implementation does **not** require a mnemonic for the EvoGuard flow. It is built around:

- `EVOGUARD_IDENTITY_ID`
- `EVOGUARD_PRIVATE_KEY_WIF` or `EVOGUARD_PRIVATE_KEY_HEX`

## Repo Layout

```text
.
├── frontend/              Next.js app and EvoGuard UI/API routes
├── backend/               Misc backend notes/assets
├── IMPLEMENTATION.md      Working implementation plan / notes
└── README.md
```

## Current Features

### Identity validation

The app can:

- fetch a Dash Platform identity by ID
- read its balance on testnet
- test whether the configured private key matches any on-chain identity key
- report whether that matched key can register names or deploy contracts

### Contract flow

The app includes:

- a local EvoGuard `auditReport` contract schema
- a deploy route backed by the Dash Evo SDK
- a fetch route to retrieve a deployed contract by ID
- a frontend admin page that shows identity, key capability, DPNS status, and contract state

### UI surfaces

- `/` renders the EvoGuard admin page
- `/evoguard` renders the same EvoGuard admin page

### API routes

- `GET /api/evoguard/status`
- `GET /api/evoguard/contract`
- `POST /api/evoguard/contract/deploy`
- `POST /api/evoguard/dpns/register`

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- `@dashevo/evo-sdk`

## Getting Started

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure env

Create `frontend/.env` using `frontend/.env.example`.

Minimum required config for the EvoGuard flow:

```bash
NETWORK=testnet
EVOGUARD_IDENTITY_ID=your_identity_id
EVOGUARD_PRIVATE_KEY_WIF=
EVOGUARD_PRIVATE_KEY_HEX=
EVOGUARD_CONTRACT_ID=
EVOGUARD_DPNS_LABEL=evoguard
```

Notes:

- Use either `EVOGUARD_PRIVATE_KEY_WIF` or `EVOGUARD_PRIVATE_KEY_HEX`.
- The key must belong to an on-chain public key on the configured identity.
- Contract deployment will only work if that identity key is contract-capable.
- `PLATFORM_MNEMONIC` is only relevant to older wallet utilities in the frontend and is not required for the EvoGuard path.

### 3. Run the app

```bash
cd frontend
npm run dev
```

Open:

- `http://localhost:3000`

## How to Verify

### Identity status

Open:

- `http://localhost:3000/api/evoguard/status`

Successful identity resolution looks like:

- `exists: true`
- non-null `balance`

Successful signing capability looks like:

- `keyMatchesIdentity: true`
- non-null `matchedKeyId`
- `canDeployContracts: true` for contract publishing

If the response says `Invalid private key`, the supplied secret is not parseable as a single WIF or 64-char hex private key.

### Contract status

Open:

- `http://localhost:3000/api/evoguard/contract`

After a successful deployment, the route should return:

- `exists: true`
- a `fetchedId`
- `documentTypes` containing `auditReport`

## Important Constraint

This repo can publish a data contract **without a mnemonic**, but only if you provide:

1. the correct Dash Platform identity ID
2. the correct private key for a public key on that identity
3. a key with permissions sufficient for contract signing

If your key does not match the identity, the app will still fetch the identity and balance, but deployment will remain blocked.

## Build and Checks

From `frontend/`:

```bash
npm run lint
npx next build --webpack
```

`next build` with Turbopack may fail in restricted environments due to sandbox/process limits, so webpack is the more reliable verification command here.

## Status

Implemented:

- identity lookup
- private key matching
- DPNS status lookup
- contract deploy/fetch API routes
- EvoGuard admin frontend

Not yet implemented:

- package scanning
- document publishing for audit reports
- CLI package lookup
- payment-triggered audits
