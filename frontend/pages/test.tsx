import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

type StatusResponse = {
  ok: true;
  status: {
    network: string;
    identity: {
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
    dpns: {
      label: string;
      fqdn: string;
      exists: boolean;
      ownerIdentityId: string | null;
      matchesConfiguredIdentity: boolean | null;
      registrationAllowed: boolean;
      error: string | null;
    };
    contract: {
      configuredId: string | null;
      exists: boolean;
      fetchedId: string | null;
      documentTypes: string[];
      deploymentAllowed: boolean;
      error: string | null;
    };
  };
};

type ActionResponse =
  | {
      ok: true;
      registration?: {
        label: string;
        fqdn: string;
        identityId: string;
        state: "registered" | "already-owned";
      };
      contract?: {
        id: string;
        documentTypes: string[];
        verificationFetched: boolean;
      };
    }
  | { ok: false; error: string };

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClasses = {
    good: "border-emerald-300 bg-emerald-50 text-emerald-700",
    warn: "border-amber-300 bg-amber-50 text-amber-700",
    bad: "border-red-300 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

export default function EvoGuardPage() {
  const [status, setStatus] = useState<StatusResponse["status"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dpnsLoading, setDpnsLoading] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function loadStatus() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/evoguard/status");
      const data = (await response.json()) as StatusResponse | { ok: false; error: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.ok ? "Request failed" : data.error);
      }

      setStatus(data.status);
    } catch (requestError) {
      setStatus(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to load EvoGuard status",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleRegisterDpns() {
    setDpnsLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/evoguard/dpns/register", {
        method: "POST",
      });
      const data = (await response.json()) as ActionResponse;

      if (!response.ok || !data.ok || !data.registration) {
        throw new Error(data.ok ? "DPNS registration failed" : data.error);
      }

      setActionMessage(
        data.registration.state === "already-owned"
          ? `${data.registration.fqdn} is already owned by this identity.`
          : `${data.registration.fqdn} was registered successfully.`,
      );
      await loadStatus();
    } catch (actionError) {
      setActionMessage(
        actionError instanceof Error ? actionError.message : "DPNS registration failed",
      );
    } finally {
      setDpnsLoading(false);
    }
  }

  async function handleDeployContract() {
    setContractLoading(true);
    setActionMessage(null);

    try {
      const response = await fetch("/api/evoguard/contract/deploy", {
        method: "POST",
      });
      const data = (await response.json()) as ActionResponse;

      if (!response.ok || !data.ok || !data.contract) {
        throw new Error(data.ok ? "Contract deployment failed" : data.error);
      }

      setActionMessage(`Contract deployed or resolved as ${data.contract.id}.`);
      await loadStatus();
    } catch (actionError) {
      setActionMessage(
        actionError instanceof Error ? actionError.message : "Contract deployment failed",
      );
    } finally {
      setContractLoading(false);
    }
  }

  const identity = status?.identity;
  const dpns = status?.dpns;
  const contract = status?.contract;

  return (
    <>
      <Head>
        <title>EvoGuard Admin</title>
      </Head>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f5f3e8_0%,_#fbfaf4_35%,_#eef4ff_100%)] text-slate-950">
        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-10 lg:py-14">
          <header className="rounded-[2rem] border border-slate-200 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="font-mono text-xs uppercase tracking-[0.32em] text-amber-700">
                  EvoGuard Phase 1-2
                </p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
                  Validate the identity, inspect key permissions, and deploy the registry.
                </h1>
                <p className="mt-4 text-base leading-8 text-slate-600">
                  This admin view assumes only an identity ID and one private key WIF.
                  It verifies whether that key can register a DPNS alias or publish the
                  EvoGuard audit contract.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Wallet Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void loadStatus()}
                  disabled={isLoading}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isLoading ? "Refreshing..." : "Refresh Status"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <StatusPill
                label={identity?.exists ? "Identity Live" : "Identity Missing"}
                tone={identity?.exists ? "good" : "bad"}
              />
              <StatusPill
                label={identity?.key.canRegisterNames ? "DPNS Ready" : "DPNS Blocked"}
                tone={identity?.key.canRegisterNames ? "good" : "warn"}
              />
              <StatusPill
                label={identity?.key.canDeployContracts ? "Contract Ready" : "Contract Blocked"}
                tone={identity?.key.canDeployContracts ? "good" : "warn"}
              />
            </div>
          </header>

          {error ? (
            <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {actionMessage ? (
            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
              {actionMessage}
            </div>
          ) : null}

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-slate-200 bg-white/85 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-sky-700">
                Identity
              </p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Configured identity ID</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">
                    {identity?.configuredId ?? "Not configured"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Balance</p>
                  <p className="mt-2 font-mono text-sm text-slate-900">
                    {identity?.balance ?? "--"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Network</p>
                  <p className="mt-2 font-mono text-sm text-slate-900">
                    {status?.network ?? "--"}
                  </p>
                </div>
                {identity?.error ? (
                  <div className="rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {identity.error}
                  </div>
                ) : null}
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white/85 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-emerald-700">
                Signing Capability
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Private key</p>
                  <p className="mt-2 text-sm text-slate-900">
                    {identity?.key.provided
                      ? `Configured${identity.key.format ? ` (${identity.key.format.toUpperCase()})` : ""}`
                      : "Missing"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Key match</p>
                  <p className="mt-2 text-sm text-slate-900">
                    {identity?.key.keyMatchesIdentity ? "Matched on-chain key" : "No match"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Matched key ID</p>
                  <p className="mt-2 font-mono text-sm text-slate-900">
                    {identity?.key.matchedKeyId ?? "--"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Purpose / security</p>
                  <p className="mt-2 text-sm text-slate-900">
                    {identity?.key.matchedPurpose ?? "--"} /{" "}
                    {identity?.key.matchedSecurityLevel ?? "--"}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <StatusPill
                  label="Can Register Names"
                  tone={identity?.key.canRegisterNames ? "good" : "warn"}
                />
                <StatusPill
                  label="Can Deploy Contracts"
                  tone={identity?.key.canDeployContracts ? "good" : "warn"}
                />
              </div>
              {identity?.key.error ? (
                <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {identity.key.error}
                </div>
              ) : null}
            </article>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-[2rem] border border-slate-200 bg-white/85 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-fuchsia-700">
                    DPNS
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Target alias: {dpns?.fqdn ?? "evoguard.dash"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRegisterDpns()}
                  disabled={!identity?.key.canRegisterNames || dpnsLoading}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {dpnsLoading ? "Registering..." : "Register Alias"}
                </button>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Owner identity</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">
                    {dpns?.ownerIdentityId ?? "Unregistered"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Ownership match</p>
                  <p className="mt-2 text-sm text-slate-900">
                    {dpns?.matchesConfiguredIdentity === null
                      ? "No owner yet"
                      : dpns?.matchesConfiguredIdentity
                        ? "Matches configured identity"
                        : "Owned by a different identity"}
                  </p>
                </div>
              </div>
              {dpns?.error ? (
                <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {dpns.error}
                </div>
              ) : null}
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white/85 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-amber-700">
                    Contract
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    One-time deployment of the EvoGuard audit registry.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeployContract()}
                  disabled={!identity?.key.canDeployContracts || contractLoading}
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {contractLoading ? "Deploying..." : "Deploy Contract"}
                </button>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Configured contract ID</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">
                    {contract?.configuredId ?? "Not configured"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Fetched contract ID</p>
                  <p className="mt-2 break-all font-mono text-sm text-slate-900">
                    {contract?.fetchedId ?? "Not deployed or not found"}
                  </p>
                </div>
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500">Document types</p>
                  <p className="mt-2 font-mono text-sm text-slate-900">
                    {contract?.documentTypes?.length
                      ? contract.documentTypes.join(", ")
                      : "--"}
                  </p>
                </div>
              </div>
              {contract?.error ? (
                <div className="mt-5 rounded-[1.25rem] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {contract.error}
                </div>
              ) : null}
            </article>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-slate-950 p-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-emerald-300">
              Persist These Values
            </p>
            <div className="mt-5 grid gap-4">
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 font-mono text-sm">
                DASH_IDENTITY_ID={identity?.configuredId ?? ""}
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 font-mono text-sm">
                EVOGUARD_CONTRACT_ID={contract?.fetchedId ?? ""}
              </div>
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4 font-mono text-sm">
                EVOGUARD_DPNS_LABEL={dpns?.label ?? "evoguard"}
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
