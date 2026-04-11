import {
  DataContract,
  IdentityPublicKeyInCreation,
  IdentitySigner,
  KeyType,
  PrivateKey,
  Purpose,
  SecurityLevel,
} from "@dashevo/evo-sdk";
import crypto from "crypto";
import { createClient, getIdentityPublicKeys } from "@/setupDashClient.mjs";
import { getEvoguardConfig } from "./evoguardConfig";
import { resolveWritableIdentityContext } from "./identityCredentialService";
import {
  buildEvoguardContractSchema,
  getEvoguardSchemaSummary,
} from "./schema/evoguardContract";

function getDocumentTypes(contract: unknown): string[] {
  if (!contract || typeof contract !== "object") {
    return [];
  }

  const maybeToJSON = contract as { toJSON?: (platformVersion?: unknown) => unknown };
  const json =
    typeof maybeToJSON.toJSON === "function" ? maybeToJSON.toJSON(1) : contract;

  if (
    json &&
    typeof json === "object" &&
    "documents" in json &&
    json.documents &&
    typeof json.documents === "object"
  ) {
    return Object.keys(json.documents as Record<string, unknown>);
  }

  if (
    json &&
    typeof json === "object" &&
    "documentTypes" in json &&
    json.documentTypes &&
    typeof json.documentTypes === "object"
  ) {
    return Object.keys(json.documentTypes as Record<string, unknown>);
  }

  return [];
}

export async function getContractStatus() {
  const config = getEvoguardConfig();

  if (!config.contractId) {
    return {
      configuredId: null,
      exists: false,
      fetchedId: null,
      documentTypes: [],
      deploymentAllowed: false,
      schema: getEvoguardSchemaSummary(),
      error: null,
    };
  }

  const sdk = await createClient(config.network);

  try {
    const contract = await sdk.contracts.fetch(config.contractId);

    return {
      configuredId: config.contractId,
      exists: Boolean(contract),
      fetchedId: contract?.id?.toString?.() ?? null,
      documentTypes: getDocumentTypes(contract),
      deploymentAllowed: false,
      schema: getEvoguardSchemaSummary(),
      error: contract ? null : `Contract "${config.contractId}" not found on-chain.`,
    };
  } catch (error) {
    return {
      configuredId: config.contractId,
      exists: false,
      fetchedId: null,
      documentTypes: [],
      deploymentAllowed: false,
      schema: getEvoguardSchemaSummary(),
      error: error instanceof Error ? error.message : "Failed to fetch contract",
    };
  }
}

import { Identifier } from "@dashevo/evo-sdk";

function buildContractForIdentity(ownerId: string, identityNonce: bigint) {
  return new DataContract({
    ownerId: Identifier.fromBase58(ownerId),
    identityNonce: BigInt(identityNonce) + 1n,
    schemas: buildEvoguardContractSchema(),


    fullValidation: false,
    platformVersion: 1,
  });
}

export async function deployEvoguardContract(force = false) {
  const config = getEvoguardConfig();
  const currentStatus = await getContractStatus();
  console.log("Current Contract Status:", JSON.stringify(currentStatus));

  if (!force && currentStatus.exists && currentStatus.fetchedId) {

    console.log("Contract already exists, skipping deployment.");
    return {
      id: currentStatus.fetchedId,
      documentTypes: currentStatus.documentTypes,
      verificationFetched: true,
    };
  }

  console.log("Starting real deployment...");

  const context = await resolveWritableIdentityContext();

  if (!context.canDeployContracts) {
    throw new Error("The configured private key does not match a contract-capable identity key.");
  }

  const sdk = await createClient(config.network);

  // Contract deployment requires CRITICAL or HIGH key, not MASTER.
  // If the matched key is MASTER, add a new CRITICAL key to the identity first.
  let deployKey = context.identityKey;
  let deploySigner = context.signer;

  const secLevel = (context.identityKey as any).securityLevel ?? (context.identityKey as any).securityLevelNumber;
  const isMaster = secLevel === "MASTER" || secLevel === 0;

  if (isMaster) {
    // Generate a new random private key for CRITICAL level
    const randomBytes = crypto.randomBytes(32);
    const newPrivateKey = PrivateKey.fromBytes(new Uint8Array(randomBytes), config.network as any);
    const newPublicKeyData = newPrivateKey.getPublicKey().toBytes();

    // Find next available key ID
    const identity = context.identity as any;
    const existingKeys = getIdentityPublicKeys(identity);
    const maxKeyId = existingKeys.reduce((max: number, k: any) => Math.max(max, k.keyId ?? 0), 0);
    const newKeyId = maxKeyId + 1;

    // Create the new CRITICAL key
    const newKeyInCreation = new IdentityPublicKeyInCreation({
      keyId: newKeyId,
      purpose: Purpose.AUTHENTICATION,
      securityLevel: SecurityLevel.CRITICAL,
      keyType: KeyType.ECDSA_SECP256K1,
      isReadOnly: false,
      data: new Uint8Array(newPublicKeyData),
    });

    // Add the new key to the identity using the MASTER signer
    await sdk.identities.update({
      identity,
      addPublicKeys: [newKeyInCreation],
      signer: context.signer,
    });

    // Re-fetch identity to get the newly added key
    const updatedIdentity = await sdk.identities.fetch(context.identityId);
    const updatedKeys = getIdentityPublicKeys(updatedIdentity);
    const criticalKey = updatedKeys.find((k: any) => k.keyId === newKeyId);

    if (!criticalKey) {
      throw new Error("Failed to add CRITICAL key to identity.");
    }

    deployKey = criticalKey;

    // Create a new signer with the new private key
    deploySigner = new IdentitySigner();
    deploySigner.addKey(newPrivateKey);

    console.log(`Added CRITICAL key (id=${newKeyId}) to identity for contract deployment.`);
  }

  const rawNonce = await sdk.identities.nonce(context.identityId);
  const identityNonce = rawNonce != null ? BigInt(rawNonce) : 0n;

  const dataContract = buildContractForIdentity(context.identityId, identityNonce);
  const publishedContract = await sdk.contracts.publish({
    dataContract,
    identityKey: deployKey,
    signer: deploySigner,
  });
  const publishedId = publishedContract.id.toString();
  const fetchedContract = await sdk.contracts.fetch(publishedId);

  return {
    id: publishedId,
    documentTypes: getDocumentTypes(fetchedContract ?? publishedContract),
    verificationFetched: Boolean(fetchedContract),
  };
}
