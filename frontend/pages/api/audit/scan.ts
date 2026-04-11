import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import type {
  PublicPackageVersionData,
  ScanRunRecord,
  FindingRecord,
} from "../../../lib/shared/auditSchemas";
import {
  toPublicScanListItem,
  normalizePackageName,
  normalizeVersion,
  buildPackageVersionKey,
} from "../../../lib/shared/auditSchemas";
import { isBillingPaid, listPaidScanIds, readBillingRecord } from "../../../lib/server/auditPricingStore";

const JSON_BASE = path.join(process.cwd(), "logs", "audit", "json");

function safeName(input: string): string {
  return input.replace(/[^a-zA-Z0-9@._-]/g, "_");
}

/**
 * Read a JSON file and parse it, returning null on any error.
 */
function readJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * GET /api/audit/scan
 *   → list all scans (returns PublicScanListItem[])
 *
 * GET /api/audit/scan?id=scan_xxx
 *   → get one scan by scan_id (returns PublicPackageVersionData)
 *
 * GET /api/audit/scan?package=react&version=19.2.5
 *   → get one scan by package+version (returns PublicPackageVersionData)
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const scanId = req.query.id as string | undefined;
  const packageName = req.query.package as string | undefined;
  const version = req.query.version as string | undefined;

  // ── Single scan by ID ──
  if (scanId) {
    return getScanById(scanId, res);
  }

  // ── Single scan by package+version ──
  if (packageName) {
    return getScanByPackage(packageName, version, res);
  }

  // ── List all scans ──
  return listAllScans(res);
}

function getScanById(scanId: string, res: NextApiResponse) {
  if (!isBillingPaid(scanId)) {
    const billing = readBillingRecord(scanId);
    return res.status(402).json({
      error: `Scan "${scanId}" requires payment before it can be viewed`,
      scanId,
      paymentRequired: true,
      paymentStatus: billing?.payment_status ?? "pending",
      paymentRoute: billing?.payment_route ?? "dash",
    });
  }

  const scanDir = path.join(JSON_BASE, scanId);
  const publicFile = path.join(scanDir, "public_package_version.json");

  const data = readJsonFile<PublicPackageVersionData>(publicFile);
  if (!data) {
    return res.status(404).json({ error: `Scan "${scanId}" not found` });
  }

  return res.status(200).json(data);
}

function getScanByPackage(packageName: string, version: string | undefined, res: NextApiResponse) {
  const normalizedName = normalizePackageName(packageName);
  const normalizedVersion = normalizeVersion(version);
  const key = buildPackageVersionKey(normalizedName, normalizedVersion);
  const pointerFile = path.join(JSON_BASE, "by-package", `${safeName(key)}.json`);

  const pointer = readJsonFile<{ scan_id: string }>(pointerFile);
  if (!pointer || !pointer.scan_id) {
    return res.status(404).json({ error: `No scan found for "${key}"` });
  }

  return getScanById(pointer.scan_id, res);
}

function listAllScans(res: NextApiResponse) {
  if (!fs.existsSync(JSON_BASE)) {
    return res.status(200).json([]);
  }

  const entries = fs.readdirSync(JSON_BASE, { withFileTypes: true });
  const scanDirs = entries.filter(
    (e) => e.isDirectory() && e.name.startsWith("scan_")
  );
  const paidIds = listPaidScanIds();

  const items = [];

  for (const dir of scanDirs) {
    if (!paidIds.has(dir.name)) continue;

    const scanRunFile = path.join(JSON_BASE, dir.name, "scan_run.json");
    const findingsFile = path.join(JSON_BASE, dir.name, "findings.json");

    const scanRun = readJsonFile<ScanRunRecord>(scanRunFile);
    if (!scanRun) continue;

    const findings = readJsonFile<FindingRecord[]>(findingsFile) ?? [];
    const listItem = toPublicScanListItem(scanRun, findings);

    // Include scan_id so the frontend can link to the detail page
    items.push({ ...listItem, scanId: dir.name });
  }

  // Sort by date descending
  items.sort((a, b) => b.date.localeCompare(a.date));

  return res.status(200).json(items);
}
