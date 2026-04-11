import fs from "fs";
import path from "path";
import type {
  PublicPackageVersionData,
  PaymentRoute,
  ScanBillingRecord,
  ScanQuoteRecord,
  ScanRunRecord,
} from "../shared/auditSchemas";
import { normalizePaymentRoute } from "../shared/auditSchemas";

const JSON_BASE = path.join(process.cwd(), "logs", "audit", "json");
const PRICING_BASE = path.join(process.cwd(), "logs", "audit", "pricing");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, value: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

export function safeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9@._-]/g, "_");
}

export function getQuoteFilePath(quoteId: string): string {
  return path.join(PRICING_BASE, `quote_${quoteId}.json`);
}

export function getBillingFilePath(scanId: string): string {
  return path.join(PRICING_BASE, `billing_${scanId}.json`);
}

export function writeQuoteRecord(record: ScanQuoteRecord): void {
  writeJsonFile(getQuoteFilePath(record.quote_id), record);
}

export function readQuoteRecord(quoteId: string): ScanQuoteRecord | null {
  const record = readJsonFile<ScanQuoteRecord & { payment_route?: PaymentRoute }>(getQuoteFilePath(quoteId));
  if (!record) return null;
  return {
    ...record,
    payment_route: normalizePaymentRoute(record.payment_route),
  };
}

export function writeBillingRecord(record: ScanBillingRecord): void {
  writeJsonFile(getBillingFilePath(record.scan_id), record);
}

export function readBillingRecord(scanId: string): ScanBillingRecord | null {
  const record = readJsonFile<ScanBillingRecord & { payment_route?: PaymentRoute; dcai_tx_hash?: string | null; publication_trigger?: "dash_payment_confirm" | "dcai_credit_burn" | null }>(getBillingFilePath(scanId));
  if (!record) return null;
  return {
    ...record,
    payment_route: normalizePaymentRoute(record.payment_route),
    dcai_tx_hash: record.dcai_tx_hash ?? null,
    publication_trigger: record.publication_trigger ?? null,
  };
}

export function getScanDir(scanId: string): string {
  return path.join(JSON_BASE, scanId);
}

export function getPublicFilePath(scanId: string): string {
  return path.join(getScanDir(scanId), "public_package_version.json");
}

export function getScanRunFilePath(scanId: string): string {
  return path.join(getScanDir(scanId), "scan_run.json");
}

export function getPackagePointerFilePath(key: string): string {
  return path.join(JSON_BASE, "by-package", `${safeName(key)}.json`);
}

export function readPublicPackage(scanId: string): PublicPackageVersionData | null {
  return readJsonFile<PublicPackageVersionData>(getPublicFilePath(scanId));
}

export function readScanRun(scanId: string): ScanRunRecord | null {
  return readJsonFile<ScanRunRecord>(getScanRunFilePath(scanId));
}

export function updateScanRun(scanRun: ScanRunRecord): void {
  writeJsonFile(getScanRunFilePath(scanRun.scan_id), scanRun);
}

export function publishPackagePointer(key: string, scanId: string): void {
  writeJsonFile(getPackagePointerFilePath(key), {
    key,
    scan_id: scanId,
    public_payload_file: getPublicFilePath(scanId),
  });
}

export function isBillingPaid(scanId: string): boolean {
  const billing = readBillingRecord(scanId);
  return billing?.payment_status === "paid";
}

export function listPaidScanIds(): Set<string> {
  ensureDir(PRICING_BASE);
  const entries = fs.readdirSync(PRICING_BASE, { withFileTypes: true });
  const ids = new Set<string>();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith("billing_") || !entry.name.endsWith(".json")) {
      continue;
    }

    const scanId = entry.name.slice("billing_".length, -".json".length);
    if (isBillingPaid(scanId)) {
      ids.add(scanId);
    }
  }

  return ids;
}
