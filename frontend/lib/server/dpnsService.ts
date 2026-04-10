import { createClient } from "../../setupDashClient.mjs";
import { getEvoguardConfig } from "./evoguardConfig";
import { resolveWritableIdentityContext } from "./identityCredentialService";

export type DpnsStatus = {
  label: string;
  fqdn: string;
  exists: boolean;
  ownerIdentityId: string | null;
  matchesConfiguredIdentity: boolean | null;
  registrationAllowed: boolean;
  error: string | null;
};

export async function getDpnsStatus(): Promise<DpnsStatus> {
  const config = getEvoguardConfig();
  const fqdn = `${config.dpnsLabel}.dash`;
  const sdk = await createClient(config.network);

  try {
    const ownerIdentityId = await sdk.dpns.resolveName(fqdn);
    const identityStatus = await resolveWritableIdentityContext()
      .then((context) => ({
        canRegisterNames: context.canRegisterNames,
        identityId: context.identityId,
      }))
      .catch(() => ({
        canRegisterNames: false,
        identityId: config.identityId,
      }));

    return {
      label: config.dpnsLabel,
      fqdn,
      exists: Boolean(ownerIdentityId),
      ownerIdentityId: ownerIdentityId ?? null,
      matchesConfiguredIdentity: ownerIdentityId
        ? ownerIdentityId === config.identityId
        : null,
      registrationAllowed: identityStatus.canRegisterNames,
      error: null,
    };
  } catch (error) {
    return {
      label: config.dpnsLabel,
      fqdn,
      exists: false,
      ownerIdentityId: null,
      matchesConfiguredIdentity: null,
      registrationAllowed: false,
      error: error instanceof Error ? error.message : "Failed to inspect DPNS status",
    };
  }
}

export async function registerDpnsName(labelOverride?: string) {
  const config = getEvoguardConfig();
  const label = labelOverride?.trim() || config.dpnsLabel;
  const fqdn = `${label}.dash`;
  const status = await getDpnsStatus();

  if (status.exists) {
    if (status.ownerIdentityId === config.identityId) {
      return {
        label,
        fqdn,
        identityId: config.identityId!,
        state: "already-owned" as const,
      };
    }

    throw new Error(
      `DPNS alias "${fqdn}" is already owned by identity ${status.ownerIdentityId}.`,
    );
  }

  const context = await resolveWritableIdentityContext();

  if (!context.canRegisterNames) {
    throw new Error("The configured private key does not match a DPNS-capable identity key.");
  }

  const sdk = await createClient(config.network);

  await sdk.dpns.registerName({
    label,
    identity: context.identity as never,
    identityKey: context.identityKey,
    signer: context.signer,
  });

  return {
    label,
    fqdn,
    identityId: context.identityId,
    state: "registered" as const,
  };
}
