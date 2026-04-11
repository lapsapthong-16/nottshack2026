import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/npm/versions?name=<package-name>
 *
 * Returns the top 5 most recent versions + dist-tags for a given npm package.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = (req.query.name as string || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Missing name query param" });
  }

  try {
    const upstream = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (upstream.status === 404) {
      return res.status(404).json({ error: "Package not found" });
    }
    if (!upstream.ok) {
      return res.status(502).json({ error: `npm registry returned ${upstream.status}` });
    }

    const data = await upstream.json();
    const distTags = data["dist-tags"] ?? {};
    const latest = distTags.latest ?? "";

    // Get all versions in reverse order (newest first), take top 5
    const allVersions: string[] = Object.keys(data.versions ?? {}).reverse();
    const top5 = allVersions.slice(0, 5);

    // Ensure "latest" is always included and at the front
    if (latest && !top5.includes(latest)) {
      top5.unshift(latest);
      if (top5.length > 5) top5.pop();
    } else if (latest) {
      // Move it to the front if present
      const idx = top5.indexOf(latest);
      if (idx > 0) {
        top5.splice(idx, 1);
        top5.unshift(latest);
      }
    }

    return res.status(200).json({
      name: data.name,
      latest,
      distTags,
      versions: top5,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Failed to fetch versions" });
  }
}
