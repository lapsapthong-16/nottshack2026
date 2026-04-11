import {
  createClient,
  fetchIdentityById,
  matchPrivateKeyToIdentityKey,
  parseIdentityPrivateKey,
} from './setupDashClient.mjs';
import { DataContract, IdentityPublicKeyInCreation, Purpose, SecurityLevel, KeyType, PrivateKey, IdentitySigner } from '@dashevo/evo-sdk';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const network = process.env.NETWORK || 'testnet';
const identityId = process.env.DASH_IDENTITY_ID;

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value.replace(/^['"]|['"]$/g, '') : null;
}

function candidateKeys() {
  return [
    {
      envName: 'DASH_PRIVATE_CRITICAL_AUTH',
      value: readEnv('DASH_PRIVATE_CRITICAL_AUTH'),
      expectedUse: 'best choice for contract deployment',
    },
    {
      envName: 'DASH_PRIVATE_MASTER_AUTH',
      value: readEnv('DASH_PRIVATE_MASTER_AUTH'),
      expectedUse: 'can update identity and add a CRITICAL auth key',
    },
    {
      envName: 'EVOGUARD_PRIVATE_KEY_WIF',
      value: readEnv('EVOGUARD_PRIVATE_KEY_WIF'),
      expectedUse: 'legacy single-key config',
    },
    {
      envName: 'DASH_PRIVATE_HIGH_AUTH',
      value: readEnv('DASH_PRIVATE_HIGH_AUTH'),
      expectedUse: 'can register names/documents but cannot deploy contracts',
    },
    {
      envName: 'DASH_PRIVATE_CRITICAL_TRANS',
      value: readEnv('DASH_PRIVATE_CRITICAL_TRANS'),
      expectedUse: 'transfer key, not valid for contract deployment',
    },
  ].filter((entry) => entry.value);
}

async function run() {
  if (!identityId) throw new Error('DASH_IDENTITY_ID must be set in .env');

  console.log(`--- Mock Contract Deployment ---`);
  console.log(`Network: ${network}`);
  console.log(`Identity: ${identityId}`);

  const sdk = await createClient(network);

  // 1. Fetch Identity & select a usable key from the configured env vars.
  const identity = await fetchIdentityById(sdk, identityId);
  if (!identity) throw new Error(`Identity ${identityId} not found.`);
  console.log(`Balance: ${identity.balance} credits`);

  const candidates = candidateKeys();
  if (candidates.length === 0) {
    throw new Error(
      'No private key configured. Set DASH_PRIVATE_CRITICAL_AUTH or DASH_PRIVATE_MASTER_AUTH in frontend/.env.',
    );
  }

  const evaluations = await Promise.all(
    candidates.map(async (candidate) => {
      const match = await matchPrivateKeyToIdentityKey({
        sdk,
        identityId,
        privateKeyWif: candidate.value,
        network,
      });

      return { ...candidate, match };
    }),
  );

  const selected = evaluations.find(
    (entry) => entry.match.keyMatchesIdentity && entry.match.canDeployContracts,
  );

  if (!selected) {
    console.error('No configured private key can deploy contracts for this identity.');
    for (const entry of evaluations) {
      const { match } = entry;
      const detail = match.error
        ? match.error
        : match.keyMatchesIdentity
          ? `matched key ${match.matchedKeyId} (${match.matchedPurpose}/${match.matchedSecurityLevel}) but lacks contract deployment permission`
          : 'did not match this identity';

      console.error(`- ${entry.envName}: ${detail}`);
    }
    process.exit(1);
  }

  const { match } = selected;
  const { signer, format } = parseIdentityPrivateKey({
    privateKeyWif: selected.value,
    network,
  });
  console.log(`Using ${selected.envName} (${selected.expectedUse})`);
  console.log(`Private key format: ${format}`);

  // 2. Match key to identity
  const identityKeys = identity.getPublicKeys();
  const matchedKey = match.identityKey;

  if (!matchedKey) {
    throw new Error('Provided private key does not match any key on the identity.');
  }
  console.log(`Matched Key ID: ${matchedKey.keyId} (${matchedKey.securityLevel})`);

  // 3. Handle Privilege Escalation if needed
  // (Contract deployment requires CRITICAL or MASTER auth)
  let deployKey = matchedKey;
  let deploySigner = signer;

  const secLevel = matchedKey.securityLevel;
  if (secLevel === 'MASTER' || secLevel === 0) {
    console.log('MASTER key detected. Adding a CRITICAL key for deployment...');
    
    const randomBytes = crypto.randomBytes(32);
    const newPrivateKey = PrivateKey.fromBytes(new Uint8Array(randomBytes), network);
    const newPublicKeyData = newPrivateKey.getPublicKey().toBytes();

    const maxKeyId = identityKeys.reduce((max, k) => Math.max(max, k.keyId || 0), 0);
    const newKeyId = maxKeyId + 1;

    const newKeyInCreation = new IdentityPublicKeyInCreation(
      newKeyId,
      Purpose.AUTHENTICATION,
      SecurityLevel.CRITICAL,
      KeyType.ECDSA_SECP256K1,
      false,
      new Uint8Array(newPublicKeyData),
      undefined,
      undefined,
    );

    await sdk.identities.update({
      identity,
      addPublicKeys: [newKeyInCreation],
      signer: signer,
    });

    console.log(`Added CRITICAL key (id=${newKeyId}). Re-fetching identity...`);
    const updatedIdentity = await sdk.identities.fetch(identityId);
    deployKey = updatedIdentity.getPublicKeyById(newKeyId);
    
    deploySigner = new IdentitySigner();
    deploySigner.addKey(newPrivateKey);
    console.log(`CRITICAL key ready.`);
  }

  // 4. Define Mock Schema
  const schema = {
    mockNote: {
      type: 'object',
      properties: {
        message: { type: 'string', minLength: 1, maxLength: 100, position: 0 }
      },
      additionalProperties: false,
      required: ['message']
    }
  };

  const rawNonce = await sdk.identities.nonce(identityId);
  const identityNonce = rawNonce != null ? BigInt(rawNonce) : 0n;

  const dataContract = new DataContract(
    identityId,
    identityNonce + 1n,
    schema,
    null,
    {},
    true,
    1
  );

  console.log('Publishing mock contract...');
  try {
    const publishedContract = await sdk.contracts.publish({
      dataContract,
      identityKey: deployKey,
      signer: deploySigner,
    });
    
    console.log('SUCCESS!');
    console.log('Contract ID:', publishedContract.id.toString());
    console.log('To query this contract later, use this ID.');
  } catch (err) {
    console.error('Deployment failed:', err.message || err);
  } finally {
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
