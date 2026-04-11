## EvoGuard Frontend

This Next.js app now has two main surfaces:

- `/` for the wallet and platform-address dashboard.
- `/evoguard` for EvoGuard phase 1-2 identity validation, DPNS alias status, and contract deployment.

## Setup

Copy the example env file and fill in the identity credentials:

```bash
cp .env.example .env
```

Minimum values for the EvoGuard flow:

```bash
NETWORK=testnet
DASH_IDENTITY_ID=...
EVOGUARD_PRIVATE_KEY_WIF=...
```

Optional values:

```bash
EVOGUARD_CONTRACT_ID=
EVOGUARD_DPNS_LABEL=evoguard
```

`PLATFORM_MNEMONIC` can still exist for the older wallet dashboard, but the EvoGuard flow does not depend on it.

## Run

```bash
npm run dev
```

Then open:

- `http://localhost:3000`
- `http://localhost:3000/evoguard`

## EvoGuard API routes

- `GET /api/evoguard/status`
- `POST /api/evoguard/dpns/register`
- `GET /api/evoguard/contract`
- `POST /api/evoguard/contract/deploy`

## Notes

The EvoGuard implementation assumes only one private key WIF is available. Write actions are enabled only when that key can be matched to an on-chain identity key with sufficient permissions.
