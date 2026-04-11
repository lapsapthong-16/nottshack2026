export const SEVERITY_LEVELS = ["high", "medium", "low", "none"] as const;
export const PAYMENT_ROUTES = ["dash", "dcai"] as const;

export type Severity = (typeof SEVERITY_LEVELS)[number];
export type PaymentRoute = (typeof PAYMENT_ROUTES)[number];

export type SeveritySummary = Record<Severity, number>;

export type AuditVerdict = "flagged" | "safe" | "error" | "unknown";

export interface AgentFinding {
  severity: Severity;
  tags: string[];
  line_start: number;
  line_end: number;
  snippet_id: string;
  reasoning: string;
}

export interface AgentFileFinding {
  file: string;
  file_sha256: string;
  findings: AgentFinding[];
}

export interface DecodedPayload {
  encoding: string;
  original: string;
  decoded: string;
}

export interface SnippetRecord {
  snippet_id: string;
  package: string;
  version: string;
  file: string;
  file_sha256: string;
  tarball_sha512: string;
  line_start?: number;
  line_end?: number;
  char_start?: number;
  char_end?: number;
  snippet_raw: string;
  snippet_decoded: string;
  was_minified: boolean;
  was_obfuscated: boolean;
  decoded_payloads: DecodedPayload[];
}

export interface ScanRunRecord {
  scan_id: string;
  package: string;
  version: string;
  registry_tarball_url: string;
  tarball_sha512: string;
  scanned_at: string;
  triggered_by: string;
  verdict: AuditVerdict;
  severity_summary: SeveritySummary;
  files_scanned: number;
  billable_lines: number;
  duration_ms: number;
}

export interface PricingBreakdown {
  lineRateCredits: string;
  lineChargeCredits: string;
  timeRateCredits: string;
  timeChargeCredits: string;
  totalCredits: string;
}

export interface ScanQuoteRecord {
  quote_id: string;
  package: string;
  version: string;
  payment_route: PaymentRoute;
  pricing_version: string;
  billable_lines: number;
  estimated_minutes: number;
  ceiling_amount_credits: string;
  breakdown: PricingBreakdown;
  status: "pending" | "accepted" | "expired";
  created_at: string;
  expires_at: string;
}

export interface ScanBillingRecord {
  scan_id: string;
  quote_id: string;
  package: string;
  version: string;
  payment_route: PaymentRoute;
  pricing_version: string;
  billable_lines: number;
  actual_duration_ms: number;
  actual_minutes: number;
  line_charge_credits: string;
  time_charge_credits: string;
  ceiling_amount_credits: string;
  final_amount_credits: string;
  payment_status: "pending" | "paid";
  payer_identity_id: string | null;
  recipient_identity_id: string | null;
  transition_id: string | null;
  dcai_tx_hash: string | null;
  paid_at: string | null;
  publication_status: "pending" | "published" | "failed";
  publication_trigger: "dash_payment_confirm" | "dcai_credit_burn" | null;
}

export interface FindingRecord {
  finding_id: string;
  scan_id: string;
  package: string;
  version: string;
  file: string;
  file_sha256: string;
  severity: Severity;
  tags: string[];
  line_start?: number;
  line_end?: number;
  reasoning: string;
  snippet_id: string;
  reviewed: boolean;
  reviewer_notes: string | null;
  false_positive: boolean | null;
}

export interface PublicScanListItem {
  name: string;
  version: string;
  risk: Severity;
  files: number;
  flags: number;
  date: string;
}

export interface PublicPackageVersionData {
  key: string;
  scan_run: ScanRunRecord;
  findings: FindingRecord[];
  snippets?: SnippetRecord[];
}

export const SNIPPET_EXTRACTION_RULES = {
  contextLinesBefore: 10,
  contextLinesAfter: 10,
  hardCapLines: 200,
  storeBase64Only: true,
} as const;

export const SCAN_RUN_SCHEMA = {
  type: "object",
  required: [
    "scan_id",
    "package",
    "version",
    "registry_tarball_url",
    "tarball_sha512",
    "scanned_at",
    "triggered_by",
    "verdict",
    "severity_summary",
    "files_scanned",
    "billable_lines",
    "duration_ms",
  ],
  properties: {
    scan_id: { type: "string" },
    package: { type: "string" },
    version: { type: "string" },
    registry_tarball_url: { type: "string" },
    tarball_sha512: { type: "string" },
    scanned_at: { type: "string", format: "date-time" },
    triggered_by: { type: "string" },
    verdict: { type: "string", enum: ["flagged", "safe", "error", "unknown"] },
    severity_summary: {
      type: "object",
      required: ["high", "medium", "low", "none"],
      properties: {
        high: { type: "integer", minimum: 0 },
        medium: { type: "integer", minimum: 0 },
        low: { type: "integer", minimum: 0 },
        none: { type: "integer", minimum: 0 },
      },
    },
    files_scanned: { type: "integer", minimum: 0 },
    billable_lines: { type: "integer", minimum: 0 },
    duration_ms: { type: "integer", minimum: 0 },
  },
} as const;

export const FINDING_SCHEMA = {
  type: "object",
  required: [
    "finding_id",
    "scan_id",
    "package",
    "version",
    "file",
    "file_sha256",
    "severity",
    "tags",
    "reasoning",
    "snippet_id",
    "reviewed",
    "reviewer_notes",
    "false_positive",
  ],
  properties: {
    finding_id: { type: "string" },
    scan_id: { type: "string" },
    package: { type: "string" },
    version: { type: "string" },
    file: { type: "string" },
    file_sha256: { type: "string" },
    severity: { type: "string", enum: [...SEVERITY_LEVELS] },
    tags: { type: "array", items: { type: "string" } },
    line_start: { type: "integer", minimum: 0 },
    line_end: { type: "integer", minimum: 0 },
    reasoning: { type: "string" },
    snippet_id: { type: "string" },
    reviewed: { type: "boolean" },
    reviewer_notes: { type: ["string", "null"] },
    false_positive: { type: ["boolean", "null"] },
  },
} as const;

export const SNIPPET_SCHEMA = {
  type: "object",
  required: [
    "snippet_id",
    "package",
    "version",
    "file",
    "file_sha256",
    "tarball_sha512",
    "snippet_raw",
    "snippet_decoded",
    "was_minified",
    "was_obfuscated",
    "decoded_payloads",
  ],
  properties: {
    snippet_id: { type: "string" },
    package: { type: "string" },
    version: { type: "string" },
    file: { type: "string" },
    file_sha256: { type: "string" },
    tarball_sha512: { type: "string" },
    line_start: { type: "integer", minimum: 0 },
    line_end: { type: "integer", minimum: 0 },
    char_start: { type: "integer", minimum: 0 },
    char_end: { type: "integer", minimum: 0 },
    snippet_raw: { type: "string", contentEncoding: "base64" },
    snippet_decoded: { type: "string", contentEncoding: "base64" },
    was_minified: { type: "boolean" },
    was_obfuscated: { type: "boolean" },
    decoded_payloads: {
      type: "array",
      items: {
        type: "object",
        required: ["encoding", "original", "decoded"],
        properties: {
          encoding: { type: "string" },
          original: { type: "string" },
          decoded: { type: "string" },
        },
      },
    },
  },
  anyOf: [
    { required: ["line_start", "line_end"] },
    { required: ["char_start", "char_end"] },
  ],
} as const;

export const PUBLIC_PACKAGE_VERSION_SCHEMA = {
  type: "object",
  required: ["scan_run", "findings"],
  properties: {
    scan_run: SCAN_RUN_SCHEMA,
    findings: {
      type: "array",
      items: FINDING_SCHEMA,
    },
    snippets: {
      type: "array",
      items: SNIPPET_SCHEMA,
    },
  },
} as const;

export function normalizePackageName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeVersion(version?: string | null): string {
  const v = (version ?? "").trim();
  return v.length > 0 ? v : "latest";
}

export function normalizePaymentRoute(route?: string | null): PaymentRoute {
  return route === "dcai" ? "dcai" : "dash";
}

export function buildPackageVersionKey(name: string, version?: string | null): string {
  return `${normalizePackageName(name)}@${normalizeVersion(version)}`;
}

export function isSeverity(value: unknown): value is Severity {
  return typeof value === "string" && (SEVERITY_LEVELS as readonly string[]).includes(value);
}

export function emptySeveritySummary(): SeveritySummary {
  return {
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  };
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}

function asNonNegativeInt(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function asStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a string array`);
  }
  return value;
}

export function parseSeveritySummary(input: unknown): SeveritySummary {
  const obj = asObject(input, "severity_summary");
  return {
    high: asNonNegativeInt(obj.high, "severity_summary.high"),
    medium: asNonNegativeInt(obj.medium, "severity_summary.medium"),
    low: asNonNegativeInt(obj.low, "severity_summary.low"),
    none: asNonNegativeInt(obj.none, "severity_summary.none"),
  };
}

export function parseScanRunRecord(input: unknown): ScanRunRecord {
  const obj = asObject(input, "scan_run");
  const verdict = asString(obj.verdict, "scan_run.verdict").toLowerCase() as AuditVerdict;

  if (!["flagged", "safe", "error", "unknown"].includes(verdict)) {
    throw new Error("scan_run.verdict must be one of flagged|safe|error|unknown");
  }

  return {
    scan_id: asString(obj.scan_id, "scan_run.scan_id"),
    package: normalizePackageName(asString(obj.package, "scan_run.package")),
    version: normalizeVersion(asString(obj.version, "scan_run.version")),
    registry_tarball_url: asString(obj.registry_tarball_url, "scan_run.registry_tarball_url"),
    tarball_sha512: asString(obj.tarball_sha512, "scan_run.tarball_sha512"),
    scanned_at: asString(obj.scanned_at, "scan_run.scanned_at"),
    triggered_by: asString(obj.triggered_by, "scan_run.triggered_by"),
    verdict,
    severity_summary: parseSeveritySummary(obj.severity_summary),
    files_scanned: asNonNegativeInt(obj.files_scanned, "scan_run.files_scanned"),
    billable_lines: asNonNegativeInt(obj.billable_lines, "scan_run.billable_lines"),
    duration_ms: asNonNegativeInt(obj.duration_ms, "scan_run.duration_ms"),
  };
}

export function parseFindingRecord(input: unknown): FindingRecord {
  const obj = asObject(input, "finding");
  const severity = asString(obj.severity, "finding.severity").toLowerCase();
  if (!isSeverity(severity)) {
    throw new Error("finding.severity must be high|medium|low|none");
  }

  const reviewerNotes = obj.reviewer_notes;
  const falsePositive = obj.false_positive;

  return {
    finding_id: asString(obj.finding_id, "finding.finding_id"),
    scan_id: asString(obj.scan_id, "finding.scan_id"),
    package: normalizePackageName(asString(obj.package, "finding.package")),
    version: normalizeVersion(asString(obj.version, "finding.version")),
    file: asString(obj.file, "finding.file"),
    file_sha256: asString(obj.file_sha256, "finding.file_sha256"),
    severity,
    tags: asStringArray(obj.tags, "finding.tags"),
    line_start: obj.line_start === undefined ? undefined : asNonNegativeInt(obj.line_start, "finding.line_start"),
    line_end: obj.line_end === undefined ? undefined : asNonNegativeInt(obj.line_end, "finding.line_end"),
    reasoning: asString(obj.reasoning, "finding.reasoning"),
    snippet_id: asString(obj.snippet_id, "finding.snippet_id"),
    reviewed: asBoolean(obj.reviewed, "finding.reviewed"),
    reviewer_notes: reviewerNotes === null ? null : asString(reviewerNotes, "finding.reviewer_notes"),
    false_positive:
      falsePositive === null
        ? null
        : asBoolean(falsePositive, "finding.false_positive"),
  };
}

export function parseSnippetRecord(input: unknown): SnippetRecord {
  const obj = asObject(input, "snippet");

  const decodedPayloads = Array.isArray(obj.decoded_payloads)
    ? obj.decoded_payloads.map((item, idx) => {
        const payload = asObject(item, `snippet.decoded_payloads[${idx}]`);
        return {
          encoding: asString(payload.encoding, `snippet.decoded_payloads[${idx}].encoding`),
          original: asString(payload.original, `snippet.decoded_payloads[${idx}].original`),
          decoded: asString(payload.decoded, `snippet.decoded_payloads[${idx}].decoded`),
        };
      })
    : [];

  const hasLineRange = obj.line_start !== undefined || obj.line_end !== undefined;
  const hasCharRange = obj.char_start !== undefined || obj.char_end !== undefined;
  if (!hasLineRange && !hasCharRange) {
    throw new Error("snippet must include line range or char range");
  }

  return {
    snippet_id: asString(obj.snippet_id, "snippet.snippet_id"),
    package: normalizePackageName(asString(obj.package, "snippet.package")),
    version: normalizeVersion(asString(obj.version, "snippet.version")),
    file: asString(obj.file, "snippet.file"),
    file_sha256: asString(obj.file_sha256, "snippet.file_sha256"),
    tarball_sha512: asString(obj.tarball_sha512, "snippet.tarball_sha512"),
    line_start:
      obj.line_start === undefined ? undefined : asNonNegativeInt(obj.line_start, "snippet.line_start"),
    line_end: obj.line_end === undefined ? undefined : asNonNegativeInt(obj.line_end, "snippet.line_end"),
    char_start:
      obj.char_start === undefined ? undefined : asNonNegativeInt(obj.char_start, "snippet.char_start"),
    char_end: obj.char_end === undefined ? undefined : asNonNegativeInt(obj.char_end, "snippet.char_end"),
    snippet_raw: asString(obj.snippet_raw, "snippet.snippet_raw"),
    snippet_decoded: asString(obj.snippet_decoded, "snippet.snippet_decoded"),
    was_minified: asBoolean(obj.was_minified, "snippet.was_minified"),
    was_obfuscated: asBoolean(obj.was_obfuscated, "snippet.was_obfuscated"),
    decoded_payloads: decodedPayloads,
  };
}

export function parsePublicPackageVersionData(input: unknown): PublicPackageVersionData {
  const obj = asObject(input, "public_package_version_data");
  const scanRun = parseScanRunRecord(obj.scan_run);

  if (!Array.isArray(obj.findings)) {
    throw new Error("findings must be an array");
  }

  const findings = obj.findings.map((item, idx) => parseFindingRecord(asObject(item, `findings[${idx}]`)));

  const snippets = Array.isArray(obj.snippets)
    ? obj.snippets.map((item, idx) => parseSnippetRecord(asObject(item, `snippets[${idx}]`)))
    : undefined;

  return {
    key: buildPackageVersionKey(scanRun.package, scanRun.version),
    scan_run: scanRun,
    findings,
    snippets,
  };
}

export function toPublicScanListItem(scanRun: ScanRunRecord, findings: FindingRecord[]): PublicScanListItem {
  // Compute the highest severity found
  const severityOrder: Severity[] = ["high", "medium", "low", "none"];
  let highestSeverity: Severity = "none";
  for (const finding of findings) {
    const idx = severityOrder.indexOf(finding.severity);
    if (idx >= 0 && idx < severityOrder.indexOf(highestSeverity)) {
      highestSeverity = finding.severity;
    }
  }

  return {
    name: scanRun.package,
    version: scanRun.version,
    risk: highestSeverity,
    files: scanRun.files_scanned,
    flags: findings.length,
    date: scanRun.scanned_at.slice(0, 10),
  };
}
