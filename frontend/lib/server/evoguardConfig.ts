export type EvoguardConfig = {
  network: "testnet" | "mainnet" | "local";
  identityId: string | null;
  privateKeyWif: string | null;
  privateKeyHex: string | null;
  contractId: string | null;
  dpnsLabel: string;
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();

  if (!value) {
    return null;
  }

  return value.replace(/^['"]|['"]$/g, "");
}

export function getEvoguardConfig(): EvoguardConfig {
  const network = (readEnv("NETWORK") ?? "testnet") as EvoguardConfig["network"];

  if (!["testnet", "mainnet", "local"].includes(network)) {
    throw new Error(`Unsupported NETWORK "${network}"`);
  }

  return {
    network,
    identityId: readEnv("DASH_IDENTITY_ID"),
    privateKeyWif:
      readEnv("DASH_PRIVATE_CRITICAL_AUTH") ||
      readEnv("DASH_PRIVATE_MASTER_AUTH") ||
      readEnv("EVOGUARD_PRIVATE_KEY_WIF"),
    privateKeyHex: readEnv("EVOGUARD_PRIVATE_KEY_HEX"),
    contractId: readEnv("EVOGUARD_CONTRACT_ID"),
    dpnsLabel: readEnv("EVOGUARD_DPNS_LABEL") ?? "evoguard",
  };
}
