import { DataContract } from "@dashevo/evo-sdk";
import { createClient, createDataContractFromSchema } from "../../setupDashClient.mjs";
import { getEvoguardConfig } from "./evoguardConfig";
import { resolveWritableIdentityContext } from "./identityCredentialService";
import {
  buildEvoguardContractJson,
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

function buildContractForIdentity(identityId: string, identityNonce: bigint) {
  try {
    return createDataContractFromSchema({
      identityId,
      identityNonce,
      schema: buildEvoguardContractSchema(),
    });
  } catch {
    return DataContract.fromJSON(buildEvoguardContractJson(identityId), false, 1);
  }
}

export async function deployEvoguardContract() {
  const config = getEvoguardConfig();
  const currentStatus = await getContractStatus();

  if (currentStatus.exists && currentStatus.fetchedId) {
    return {
      id: currentStatus.fetchedId,
      documentTypes: currentStatus.documentTypes,
      verificationFetched: true,
    };
  }

  const context = await resolveWritableIdentityContext();

  if (!context.canDeployContracts) {
    throw new Error("The configured private key does not match a contract-capable identity key.");
  }

  const sdk = await createClient(config.network);
  const identityNonce = await sdk.identities.nonce(context.identityId);

  if (identityNonce === null) {
    throw new Error("Could not resolve the identity nonce needed for contract deployment.");
  }

  const dataContract = buildContractForIdentity(context.identityId, identityNonce);
  const publishedContract = await sdk.contracts.publish({
    dataContract,
    identityKey: context.identityKey,
    signer: context.signer,
  });
  const publishedId = publishedContract.id.toString();
  const fetchedContract = await sdk.contracts.fetch(publishedId);

  return {
    id: publishedId,
    documentTypes: getDocumentTypes(fetchedContract ?? publishedContract),
    verificationFetched: Boolean(fetchedContract),
  };
}
