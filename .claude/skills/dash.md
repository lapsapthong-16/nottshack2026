# Dash Platform Development Skill

When the user asks you to write Dash Platform code, follow these patterns and use these references.

---

## Project-Specific Files (READ THESE FIRST)

- **`frontend/setupDashClient.mjs`** — Core SDK utilities. Exports: `createClient()`, `createDataContractFromSchema()`, `matchPrivateKeyToIdentityKey()`, `parseIdentityPrivateKey()`, `fetchIdentityById()`, `IdentityKeyManager`, `AddressKeyManager`
- **`frontend/lib/server/evoguardConfig.ts`** — Reads env vars into typed config object
- **`frontend/lib/server/identityCredentialService.ts`** — `resolveWritableIdentityContext()` returns ready-to-use `{identityId, identityKey, signer, canDeployContracts, canRegisterNames}`
- **`frontend/lib/server/contractService.ts`** — `deployEvoguardContract()`, `getContractStatus()`
- **`frontend/lib/server/dpnsService.ts`** — `registerDpnsName()`, `getDpnsStatus()`
- **`frontend/lib/server/schema/evoguardContract.ts`** — `buildEvoguardContractSchema()` returns the auditReport document type schema

## Environment Variables (.env)

```
NETWORK=testnet
DASH_IDENTITY_ID=DkFeADqFup7kxWPZAW9ZMrY4MvxCq2u9Tm4dz8vM8cWv
EVOGUARD_PRIVATE_KEY_HEX=
EVOGUARD_PRIVATE_KEY_WIF=
EVOGUARD_CONTRACT_ID=
```

---

## WARNINGS

- **dash-evo-tool** — DO NOT USE. Teammate confirmed it's a massive time sink ("big act waste time only"). It's a desktop GUI for managing identities/contracts, but for this project we use the SDK directly via code. If someone suggests using it, refuse.
- **Masternodes / full core node setup** — DO NOT DO. Not needed for development. The SDK connects to testnet masternodes automatically via `EvoSDK.testnetTrusted()`.
- **Mnemonic-based key derivation** — NOT NEEDED for this project. We use identity ID + private key directly from `.env`. The `IdentityKeyManager` class in `setupDashClient.mjs` exists but our flow uses `resolveWritableIdentityContext()` from `identityCredentialService.ts` which reads `DASH_IDENTITY_ID` + `EVOGUARD_PRIVATE_KEY_WIF`/`HEX` instead.

### About dash-evo-tool (for reference only — DO NOT USE)
- Repo: https://github.com/dashpay/dash-evo-tool
- It's a desktop application for managing Dash Platform identities, contracts, and documents
- It requires running a full Dash Core node locally
- For hackathon purposes, it's overkill — everything it does can be done faster with SDK calls in code
- If you find yourself wanting to use it, use the Platform Explorer instead: https://testnet.platform-explorer.com/

---

## SDK: @dashevo/evo-sdk v3.0.1

### Connect to Testnet

```javascript
import { EvoSDK, ensureInitialized } from '@dashevo/evo-sdk';

await ensureInitialized();
const sdk = EvoSDK.testnetTrusted();
await sdk.connect();
```

Or use the project helper:

```javascript
import { createClient } from '../setupDashClient.mjs';
const sdk = await createClient('testnet');
```

### Register a Data Contract

```javascript
import { DataContract } from '@dashevo/evo-sdk';

// Get identity context from project helper
const context = await resolveWritableIdentityContext();
const sdk = await createClient(config.network);
const identityNonce = await sdk.identities.nonce(context.identityId);

const documentSchemas = {
  auditReport: {
    type: 'object',
    properties: {
      pkgName:    { type: 'string', minLength: 1, maxLength: 214, position: 0 },
      version:    { type: 'string', minLength: 1, maxLength: 64, position: 1 },
      riskScore:  { type: 'integer', minimum: 0, maximum: 100, position: 2 },
      summary:    { type: 'string', minLength: 1, maxLength: 4000, position: 3 },
      malwareDetected: { type: 'boolean', position: 4 },
      auditorSignature: { type: 'string', minLength: 1, maxLength: 512, position: 5 },
    },
    indices: [
      { name: 'byOwner', properties: [{ '$ownerId': 'asc' }], unique: false },
    ],
    required: ['pkgName', 'version', 'riskScore', 'summary', 'malwareDetected', 'auditorSignature'],
    additionalProperties: false,
  },
};

const dataContract = new DataContract({
  ownerId: context.identity.id,
  identityNonce: (identityNonce || 0n) + 1n,
  schemas: documentSchemas,
  fullValidation: true,
});

const published = await sdk.contracts.publish({
  dataContract,
  identityKey: context.identityKey,
  signer: context.signer,
});
console.log('Contract ID:', published.id.toString());
```

### Create a Document

```javascript
import { Document } from '@dashevo/evo-sdk';

const document = new Document({
  properties: {
    pkgName: 'express',
    version: '5.2.1',
    riskScore: 15,
    summary: 'No malicious patterns detected.',
    malwareDetected: false,
    auditorSignature: 'sha256:abc123...',
  },
  documentTypeName: 'auditReport',
  dataContractId: DATA_CONTRACT_ID,
  ownerId: identity.id,
});

await sdk.documents.create({
  document,
  identityKey,
  signer,
});
```

### Query Documents

```javascript
const results = await sdk.documents.query({
  dataContractId: DATA_CONTRACT_ID,
  documentTypeName: 'auditReport',
  where: [['$ownerId', '==', identityId]],
  orderBy: [['$createdAt', 'asc']],
  limit: 50,
});

for (const [id, doc] of results) {
  console.log(id.toString(), doc.toJSON());
}
```

### Update a Document

```javascript
// 1. Fetch existing document to get current revision
const docs = await sdk.documents.query({
  dataContractId: DATA_CONTRACT_ID,
  documentTypeName: 'auditReport',
  where: [['$id', '==', DOCUMENT_ID]],
});
const existing = [...docs.values()][0];

// 2. Create replacement with incremented revision
const updated = new Document({
  properties: { ...newProperties },
  documentTypeName: 'auditReport',
  dataContractId: DATA_CONTRACT_ID,
  ownerId: identity.id,
  revision: existing.revision + 1n,
  id: DOCUMENT_ID,
});

await sdk.documents.replace({ document: updated, identityKey, signer });
```

### Delete a Document

```javascript
await sdk.documents.delete({
  document: {
    id: DOCUMENT_ID,
    ownerId: identity.id,
    dataContractId: DATA_CONTRACT_ID,
    documentTypeName: 'auditReport',
  },
  identityKey,
  signer,
});
```

### DPNS (Name Service)

```javascript
// Check availability
const available = await sdk.dpns.isNameAvailable('evoguard');

// Register
await sdk.dpns.registerName({
  label: 'evoguard',
  identityId: identity.id.toString(),
  publicKeyId: identityKey.keyId,
  privateKeyWif: privateKeyWif,
});

// Resolve
const resolved = await sdk.dpns.resolveName('evoguard.dash');
```

### Identity Operations

```javascript
// Fetch identity
const identity = await sdk.identities.fetch(identityId);

// Get nonce (needed for contract registration)
const nonce = await sdk.identities.nonce(identityId);

// Get balance
const balance = await sdk.identities.balance(identityId);
```

---

## Schema Rules

- Every property MUST have a `position` field (integer, starting from 0) — required since Platform v0.25.16
- Indices only support ascending order (`asc`)
- Max document size: 20 KiB
- Max single field size: 5 KiB
- `additionalProperties: false` is required
- System properties available: `$ownerId` (always), `$createdAt`, `$updatedAt` (opt-in via `required`)
- Max 100 results per query
- `where` conditions: `==`, `in`, `>`, `>=`, `<`, `<=`, `startsWith`

## Testnet Resources

- Faucet: https://faucet.testnet.networks.dash.org/
- Platform Explorer: https://testnet.platform-explorer.com/
- Dashscan: https://testnet.dashscan.io/
- Seed Node: https://seed-1.testnet.networks.dash.org:1443/
- Bridge (fund address): https://bridge.thepasta.org/

## SDK Method Reference

### Queries
- `sdk.identities.fetch(id)` / `.nonce(id)` / `.balance(id)` / `.balanceAndRevision(id)`
- `sdk.contracts.fetch(id)` / `.getMany([ids])` / `.getHistory({dataContractId, limit})`
- `sdk.documents.query({dataContractId, documentTypeName, where?, orderBy?, limit?})` / `.get(contractId, type, docId)`
- `sdk.dpns.resolveName(name)` / `.isNameAvailable(label)` / `.username(identityId)`
- `sdk.system.status()`

### State Transitions
- `sdk.contracts.publish({dataContract, identityKey, signer})`
- `sdk.documents.create({document, identityKey, signer})`
- `sdk.documents.replace({document, identityKey, signer})`
- `sdk.documents.delete({document, identityKey, signer})`
- `sdk.dpns.registerName({label, identityId, publicKeyId, privateKeyWif})`

### Key Security Levels (which key can do what)
- **Key 0 (MASTER)** — identity updates (add/disable keys)
- **Key 1 (HIGH auth)** — documents, names
- **Key 2 (CRITICAL auth)** — contracts, documents, names
- **Key 3 (TRANSFER)** — credit transfers/withdrawals
- **Key 4 (ENCRYPTION)** — encrypted messaging
