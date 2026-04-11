import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/npm/search?q=<query>
 *
 * Searches the npm registry and returns the top 5 matching packages.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const q = (req.query.q as string || "").trim();
  if (!q) {
    return res.status(200).json({ results: [] });
  }

  try {
    const params = new URLSearchParams({ text: q, size: "5" });
    const upstream = await fetch(`https://registry.npmjs.org/-/v1/search?${params}`);
    if (!upstream.ok) {
      return res.status(502).json({ error: `npm registry returned ${upstream.status}` });
    }

    const data = await upstream.json();
    const results = (data.objects ?? []).map((obj: any) => {
      const pkg = obj.package;
      return {
        name: pkg.name,
        version: pkg.version,
        description: (pkg.description ?? "").slice(0, 120),
        publisher: pkg.publisher?.username ?? "unknown",
      };
    });

    return res.status(200).json({ results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Failed to search npm" });
  }
}
