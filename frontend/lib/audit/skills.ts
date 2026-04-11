import fs from "fs";
import path from "path";

export type SkillEntry = {
  id: string;
  relativePath: string;
  category: "core" | "reference" | "language" | "infrastructure";
  description: string;
};

/**
 * Scans the security-review skill folder and returns a manifest of all
 * available .md files with their category and a short description.
 */
export function buildSkillManifest(): { skillDir: string; manifest: SkillEntry[] } {
  const skillDir = path.join(process.cwd(), "..", ".claude", "skills", "security-review");
  const manifest: SkillEntry[] = [];

  // Core — always included
  manifest.push({ id: "core", relativePath: "SKILL.md", category: "core", description: "Core OWASP methodology and confidence levels" });

  // Descriptions by filename (from the SKILL.md table)
  const descriptions: Record<string, string> = {
    "injection": "SQL, NoSQL, OS command, LDAP, template injection",
    "xss": "Reflected, stored, DOM-based XSS",
    "authorization": "Authorization, IDOR, privilege escalation",
    "authentication": "Sessions, credentials, password storage",
    "cryptography": "Algorithms, key management, randomness",
    "deserialization": "Pickle, YAML, Java, PHP deserialization",
    "file-security": "Path traversal, uploads, XXE",
    "ssrf": "Server-side request forgery",
    "csrf": "Cross-site request forgery",
    "data-protection": "Secrets exposure, PII, logging",
    "api-security": "REST, GraphQL, mass assignment",
    "business-logic": "Race conditions, workflow bypass",
    "modern-threats": "Prototype pollution, LLM injection, WebSocket",
    "misconfiguration": "Headers, CORS, debug mode, defaults",
    "error-handling": "Fail-open, information disclosure",
    "supply-chain": "Dependencies, build security",
    "logging": "Audit failures, log injection",
    "python": "Django, Flask, FastAPI patterns",
    "javascript": "Node, Express, React, Vue, Next.js",
    "go": "Go security patterns",
    "rust": "Rust security patterns",
    "java": "Spring, Jakarta security patterns",
    "docker": "Container security",
    "kubernetes": "K8s manifest security",
    "terraform": "IaC security",
    "ci-cd": "GitHub Actions, GitLab CI security",
    "cloud": "AWS/GCP/Azure config security",
  };

  const scanDir = (dir: string, category: SkillEntry["category"]) => {
    try {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const id = file.replace(".md", "");
        const subPath = category === "reference" ? `references/${file}` : category === "language" ? `languages/${file}` : `infrastructure/${file}`;
        manifest.push({
          id,
          relativePath: subPath,
          category,
          description: descriptions[id] ?? id,
        });
      }
    } catch { /* dir doesn't exist */ }
  };

  scanDir(path.join(skillDir, "references"), "reference");
  scanDir(path.join(skillDir, "languages"), "language");
  scanDir(path.join(skillDir, "infrastructure"), "infrastructure");

  return { skillDir, manifest };
}

/**
 * Deterministic fallback: picks skills based on file extensions and content
 * keywords. Used when the LLM router call fails.
 */
export function fallbackSkillSelection(
  manifest: SkillEntry[],
  fileList: string[],
  firstChunk: string
): string[] {
  const selected = new Set<string>();

  // Always include core high-value references
  selected.add("injection");
  selected.add("data-protection");

  const allText = fileList.join(" ") + " " + firstChunk.slice(0, 5000);
  const extensions = fileList.map((f) => path.extname(f).toLowerCase());

  // Language detection
  if (extensions.some((e) => [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs"].includes(e))) {
    selected.add("javascript");
    selected.add("xss");
    selected.add("modern-threats");
  }
  if (extensions.some((e) => [".py"].includes(e))) {
    selected.add("python");
  }
  if (extensions.some((e) => [".go"].includes(e))) {
    selected.add("go");
  }
  if (extensions.some((e) => [".rs"].includes(e))) {
    selected.add("rust");
  }
  if (extensions.some((e) => [".java"].includes(e))) {
    selected.add("java");
  }

  // Infrastructure detection
  if (fileList.some((f) => /dockerfile/i.test(f) || /\.dockerignore/i.test(f))) {
    selected.add("docker");
  }
  if (fileList.some((f) => /\.tf$/i.test(f))) {
    selected.add("terraform");
  }

  // Content-based detection
  if (/postinstall|preinstall|install.*script/i.test(allText)) {
    selected.add("supply-chain");
  }
  if (/express|fastify|koa|hapi|router\.post|app\.get\(/i.test(allText)) {
    selected.add("authentication");
    selected.add("authorization");
  }
  if (/cors|helmet|csp|content-security/i.test(allText)) {
    selected.add("misconfiguration");
  }
  if (/crypto|bcrypt|argon|jwt|jsonwebtoken/i.test(allText)) {
    selected.add("cryptography");
  }
  if (/serialize|deserialize|pickle|yaml\.load/i.test(allText)) {
    selected.add("deserialization");
  }
  if (/upload|multer|formidable|busboy/i.test(allText)) {
    selected.add("file-security");
  }
  if (/fetch\(|axios|request\(|http\.get|urllib/i.test(allText)) {
    selected.add("ssrf");
  }
  if (/graphql|apollo|type Query|type Mutation/i.test(allText)) {
    selected.add("api-security");
  }

  // Only return IDs that actually exist in the manifest
  const validIds = new Set(manifest.map((m) => m.id));
  return [...selected].filter((id) => validIds.has(id));
}

/**
 * Loads only the selected skill files (by ID) plus the core SKILL.md.
 * Returns the concatenated skill text to inject into agent prompts.
 */
export function loadSelectedSkills(skillDir: string, manifest: SkillEntry[], selectedIds: string[]): string {
  // Always include core
  const idsToLoad = new Set(["core", ...selectedIds]);
  const entriesToLoad = manifest.filter((m) => idsToLoad.has(m.id));

  const sections: string[] = [];
  for (const entry of entriesToLoad) {
    const filePath = path.join(skillDir, entry.relativePath);
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        // Trim to keep token usage reasonable
        const trimmed = content.slice(0, 3000);
        sections.push(`=== ${entry.relativePath} [${entry.category}] ===\n${trimmed}`);
      }
    } catch {
      // skip files that can't be read
    }
  }

  if (sections.length === 0) return "";
  return `\n\n--- SECURITY REVIEW SKILL (OWASP-based, dynamically selected) ---\n${sections.join("\n\n")}\n--- END SKILL ---\n`;
}
