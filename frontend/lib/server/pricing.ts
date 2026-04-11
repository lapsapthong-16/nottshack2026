import path from "path";

export const PRICING_VERSION = "v1";
export const QUOTE_EXPIRY_MS = 30 * 60 * 1000;
export const CREDITS_PER_TDASH = 100_000_000_000n;

const BILLABLE_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
]);

type RateBand = {
  min: number;
  max: number | null;
  rate: bigint;
};

const LINE_RATE_BANDS: RateBand[] = [
  { min: 1, max: 500, rate: 150_000n },
  { min: 501, max: 2_000, rate: 250_000n },
  { min: 2_001, max: 5_000, rate: 350_000n },
  { min: 5_001, max: null, rate: 500_000n },
];

const TIME_RATE_BANDS: RateBand[] = [
  { min: 1, max: 2, rate: 100_000_000n },
  { min: 3, max: 5, rate: 150_000_000n },
  { min: 6, max: 10, rate: 225_000_000n },
  { min: 11, max: null, rate: 300_000_000n },
];

export type PricingBreakdown = {
  lineRateCredits: string;
  lineChargeCredits: string;
  timeRateCredits: string;
  timeChargeCredits: string;
  totalCredits: string;
};

function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export function countBillableLines(fileContentMap: Record<string, string>): number {
  let total = 0;

  for (const [filePath, content] of Object.entries(fileContentMap)) {
    if (!BILLABLE_EXTENSIONS.has(getExtension(filePath))) {
      continue;
    }

    const count = content.split("\n").reduce((sum, line) => {
      return line.trim().length > 0 ? sum + 1 : sum;
    }, 0);

    total += count;
  }

  return total;
}

function getBand(value: number, bands: RateBand[]): RateBand {
  for (const band of bands) {
    if (value >= band.min && (band.max === null || value <= band.max)) {
      return band;
    }
  }

  return bands[bands.length - 1];
}

export function getLineRate(lines: number): bigint {
  if (lines <= 0) return 0n;
  return getBand(lines, LINE_RATE_BANDS).rate;
}

export function getTimeRate(minutes: number): bigint {
  if (minutes <= 0) return 0n;
  return getBand(minutes, TIME_RATE_BANDS).rate;
}

export function estimateMinutes(input: { billableLines: number; chunkCount: number }): number {
  const byLines = input.billableLines / 400;
  const byChunks = input.chunkCount * 1.5;
  return Math.ceil(Math.max(1, byLines, byChunks));
}

function makeBreakdown(lineRate: bigint, lineCharge: bigint, timeRate: bigint, timeCharge: bigint): PricingBreakdown {
  return {
    lineRateCredits: lineRate.toString(),
    lineChargeCredits: lineCharge.toString(),
    timeRateCredits: timeRate.toString(),
    timeChargeCredits: timeCharge.toString(),
    totalCredits: (lineCharge + timeCharge).toString(),
  };
}

export function computeQuote(input: {
  billableLines: number;
  chunkCount: number;
}) {
  const estimatedMinutes = estimateMinutes(input);
  const lineRate = getLineRate(input.billableLines);
  const timeRate = getTimeRate(estimatedMinutes);
  const lineCharge = lineRate * BigInt(input.billableLines);
  const timeCharge = timeRate * BigInt(estimatedMinutes);

  return {
    estimatedMinutes,
    ceilingAmountCredits: lineCharge + timeCharge,
    breakdown: makeBreakdown(lineRate, lineCharge, timeRate, timeCharge),
  };
}

export function computeFinalCharge(input: {
  billableLines: number;
  durationMs: number;
  acceptedCeilingCredits: bigint;
}) {
  const actualMinutes = Math.max(1, Math.ceil(input.durationMs / 60_000));
  const lineRate = getLineRate(input.billableLines);
  const timeRate = getTimeRate(actualMinutes);
  const lineCharge = lineRate * BigInt(input.billableLines);
  const timeCharge = timeRate * BigInt(actualMinutes);
  const computedTotal = lineCharge + timeCharge;
  const finalAmountCredits =
    computedTotal > input.acceptedCeilingCredits ? input.acceptedCeilingCredits : computedTotal;

  return {
    actualMinutes,
    finalAmountCredits,
    breakdown: makeBreakdown(lineRate, lineCharge, timeRate, timeCharge),
  };
}

export function creditsToTDashString(credits: bigint): string {
  const whole = credits / CREDITS_PER_TDASH;
  const fraction = credits % CREDITS_PER_TDASH;
  const fractionString = fraction.toString().padStart(11, "0").replace(/0+$/, "");
  return fractionString.length > 0 ? `${whole}.${fractionString}` : whole.toString();
}
