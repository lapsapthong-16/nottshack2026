import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { fetchPackageCode } from "../../../lib/audit/unpkg";
import { writeQuoteRecord } from "../../../lib/server/auditPricingStore";
import {
  computeQuote,
  creditsToTDashString,
  PRICING_VERSION,
  QUOTE_EXPIRY_MS,
  countBillableLines,
} from "../../../lib/server/pricing";
import { normalizePackageName, normalizePaymentRoute, normalizeVersion } from "../../../lib/shared/auditSchemas";

const DCAI_ESTIMATE_TDCAI = "0.004870";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, version = "latest", paymentRoute } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: "Missing package name" });
  }

  const normalizedName = normalizePackageName(String(name));
  const requestedVersion = normalizeVersion(String(version));
  const normalizedPaymentRoute = normalizePaymentRoute(
    typeof paymentRoute === "string" ? paymentRoute : null,
  );

  if (paymentRoute !== "dash" && paymentRoute !== "dcai") {
    return res.status(400).json({ error: "Missing paymentRoute" });
  }

  try {
    const npmRes = await fetch(`https://registry.npmjs.org/${encodeURIComponent(normalizedName)}`);
    if (!npmRes.ok) {
      return res.status(404).json({ error: `Package "${normalizedName}" not found on npm` });
    }

    const npmData = await npmRes.json();
    const resolvedVersion = requestedVersion === "latest"
      ? (npmData["dist-tags"]?.latest ?? requestedVersion)
      : requestedVersion;
    const normalizedResolvedVersion = normalizeVersion(resolvedVersion);

    const { chunks, fileContentMap } = await fetchPackageCode(normalizedName, normalizedResolvedVersion);
    const billableLines = countBillableLines(fileContentMap);
    const quote = computeQuote({
      billableLines,
      chunkCount: chunks.length,
    });

    const now = new Date();
    const quoteId = sha256(`${normalizedName}@${normalizedResolvedVersion}|${now.toISOString()}`).slice(0, 16);
    const expiresAt = new Date(now.getTime() + QUOTE_EXPIRY_MS);

    writeQuoteRecord({
      quote_id: quoteId,
      package: normalizedName,
      version: normalizedResolvedVersion,
      payment_route: normalizedPaymentRoute,
      pricing_version: PRICING_VERSION,
      billable_lines: billableLines,
      estimated_minutes: quote.estimatedMinutes,
      ceiling_amount_credits: quote.ceilingAmountCredits.toString(),
      breakdown: quote.breakdown,
      status: "pending",
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    return res.status(200).json({
      quoteId,
      package: normalizedName,
      version: normalizedResolvedVersion,
      paymentRoute: normalizedPaymentRoute,
      billableLines,
      estimatedMinutes: quote.estimatedMinutes,
      estimateTDash: normalizedPaymentRoute === "dash" ? creditsToTDashString(quote.ceilingAmountCredits) : undefined,
      estimateTDcai: normalizedPaymentRoute === "dcai" ? DCAI_ESTIMATE_TDCAI : undefined,
      estimateCredits: quote.ceilingAmountCredits.toString(),
      breakdown: quote.breakdown,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate quote";
    return res.status(500).json({ error: message });
  }
}
