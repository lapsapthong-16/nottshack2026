import type { IdentityPublicKey, IdentitySigner } from "@dashevo/evo-sdk";
import {
  createClient,
  fetchIdentityById,
  matchPrivateKeyToIdentityKey,
} from "../../setupDashClient.mjs";
import { getEvoguardConfig } from "./evoguardConfig";

export type IdentityCapabilityStatus = {
  configuredId: string | null;
  exists: boolean;
  balance: string | null;
  error: string | null;
  key: {
    provided: boolean;
    format: "wif" | "hex" | null;
    keyMatchesIdentity: boolean;
    matchedKeyId: number | null;
    matchedPurpose: string | null;
    matchedSecurityLevel: string | null;
    canRegisterNames: boolean;
    canDeployContracts: boolean;
    error: string | null;
  };
};

export type ResolvedIdentityContext = {
  identity: unknown;
  identityId: string;
  identityKey: IdentityPublicKey;
  signer: IdentitySigner;
  canRegisterNames: boolean;
  canDeployContracts: boolean;
  network: string;
};

export async function getIdentityCapabilityStatus(): Promise<{
  network: string;
  identity: IdentityCapabilityStatus;
}> {
  const config = getEvoguardConfig();

  if (!config.identityId) {
    return {
      network: config.network,
      identity: {
        configuredId: null,
        exists: false,
        balance: null,
        error: "DASH_IDENTITY_ID is not configured.",
        key: {
          provided: Boolean(config.privateKeyWif || config.privateKeyHex),
          format: null,
          keyMatchesIdentity: false,
          matchedKeyId: null,
          matchedPurpose: null,
          matchedSecurityLevel: null,
          canRegisterNames: false,
          canDeployContracts: false,
          error:
            config.privateKeyWif || config.privateKeyHex
              ? null
              : "No private key configured.",
        },
      },
    };
  }

  const sdk = await createClient(config.network);
  const identity = await fetchIdentityById(sdk, config.identityId);
  const match = await matchPrivateKeyToIdentityKey({
    sdk,
    identityId: config.identityId,
    privateKeyWif: config.privateKeyWif,
    privateKeyHex: config.privateKeyHex,
    network: config.network,
  });

  return {
    network: config.network,
    identity: {
      configuredId: config.identityId,
      exists: Boolean(identity),
      balance: identity ? identity.balance.toString() : null,
      error: identity ? null : `Identity "${config.identityId}" not found on-chain.`,
      key: {
        provided: match.privateKeyProvided,
        format: match.privateKeyFormat,
        keyMatchesIdentity: match.keyMatchesIdentity,
        matchedKeyId: match.matchedKeyId,
        matchedPurpose: match.matchedPurpose,
        matchedSecurityLevel: match.matchedSecurityLevel,
        canRegisterNames: match.canRegisterNames,
        canDeployContracts: match.canDeployContracts,
        error: match.error,
      },
    },
  };
}

export async function resolveWritableIdentityContext(): Promise<ResolvedIdentityContext> {
  const config = getEvoguardConfig();

  if (!config.identityId) {
    throw new Error("DASH_IDENTITY_ID is not configured.");
  }

  const sdk = await createClient(config.network);
  const match = await matchPrivateKeyToIdentityKey({
    sdk,
    identityId: config.identityId,
    privateKeyWif: config.privateKeyWif,
    privateKeyHex: config.privateKeyHex,
    network: config.network,
  });

  if (!match.identity) {
    throw new Error(`Identity "${config.identityId}" not found on-chain.`);
  }

  if (!match.identityKey || !match.signer) {
    throw new Error(match.error ?? "The configured private key cannot sign for this identity.");
  }

  return {
    identity: match.identity,
    identityId: config.identityId,
    identityKey: match.identityKey,
    signer: match.signer,
    canRegisterNames: match.canRegisterNames,
    canDeployContracts: match.canDeployContracts,
    network: config.network,
  };
}
