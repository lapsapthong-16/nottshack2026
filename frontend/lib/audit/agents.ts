import { SkillEntry, fallbackSkillSelection } from "./skills";
import { AuditLogger } from "./logger";

export async function runAgent0SkillRouter(
  manifest: SkillEntry[],
  fileList: string[],
  firstChunk: string,
  client: any,
  approveAll: any,
  logger: AuditLogger
): Promise<{ selectedIds: string[]; reason: string; usedFallback: boolean }> {
  // Build a compact manifest description for the LLM
  const manifestText = manifest
    .filter((m) => m.category !== "core")
    .map((m) => `- ${m.id} [${m.category}]: ${m.description}`)
    .join("\n");

  const fileListText = fileList.slice(0, 50).join(", ");

  const routerPrompt = `You are a SKILL ROUTER. Your job is to select which security reference guides are relevant for auditing a specific codebase.

AVAILABLE SKILLS:
${manifestText}

PACKAGE FILE LIST:
${fileListText}

FIRST 2000 CHARS OF CODE:
${firstChunk.slice(0, 2000)}

Select the 3-8 most relevant skill IDs for this audit. Consider:
1. What language/framework is the code written in?
2. What attack surfaces does it expose (API routes, file handling, auth, etc.)?
3. Does it have install scripts or unusual dependencies?

Respond in EXACT JSON (no markdown, no code fences):
{
  "selectedSkills": ["skill_id_1", "skill_id_2", ...],
  "reason": "Brief explanation of why these were chosen"
}`;

  try {
    const routerSession = await client.createSession({
      model: "gpt-5-mini",
      onPermissionRequest: approveAll,
    });

    const response = await routerSession.sendAndWait({ prompt: routerPrompt });
    const content = response?.data?.content ?? "";
    const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.selectedSkills && Array.isArray(parsed.selectedSkills) && parsed.selectedSkills.length > 0) {
      // Validate: only keep IDs that exist in manifest
      const validIds = new Set(manifest.map((m) => m.id));
      const validated = parsed.selectedSkills.filter((id: string) => validIds.has(id));

      if (validated.length > 0) {
        logger.log(`Agent 0 (Skill Router) selected: ${validated.join(", ")}`);
        return { selectedIds: validated, reason: parsed.reason ?? "", usedFallback: false };
      }
    }

    // LLM returned empty/invalid — fall through to fallback
    throw new Error("Empty or invalid skill selection from Agent 0");
  } catch (err: any) {
    logger.log(`Agent 0 failed (${err.message}) — using fallback heuristic`);
    const fallbackIds = fallbackSkillSelection(manifest, fileList, firstChunk);
    return {
      selectedIds: fallbackIds,
      reason: "Fallback: selected by file extension and keyword detection",
      usedFallback: true,
    };
  }
}

export async function runAgent1Analyzer(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  name: string,
  resolvedVersion: string,
  securitySkill: string,
  client: any,
  approveAll: any
): Promise<{ text: string, parsed: any, error?: Error }> {
  const session = await client.createSession({
    model: "gpt-5-mini",
    onPermissionRequest: approveAll,
  });

  const prompt = `You are a security auditor trained with OWASP methodology. Analyze the npm package "${name}" (version ${resolvedVersion}) for safety and security. (Chunk ${chunkIndex + 1} of ${totalChunks}).

Use the following CONFIDENCE LEVELS:
- HIGH: Vulnerable pattern + attacker-controlled input confirmed → REPORT with severity
- MEDIUM: Vulnerable pattern, input source unclear → Note as "Needs verification"
- LOW: Theoretical, best practice → Do not report

Look for:
- eval(), exec(), child_process.exec() with user input (Critical)
- innerHTML/dangerouslySetInnerHTML with user data (High - XSS)
- SQL injection via template literals or string concat (High)
- Hardcoded secrets, API keys, passwords (Critical)
- Malicious obfuscation, data exfiltration, supply chain attacks
- Prototype pollution, deserialization vulnerabilities
- Network requests to suspicious URLs
- Auto-executing install scripts
${securitySkill}
PACKAGE SOURCE CODE (CHUNK ${chunkIndex + 1}/${totalChunks}):
${chunk}

Respond in this EXACT JSON format (no markdown, no code fences):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "MALICIOUS",
  "riskScore": <number 0-10>,
  "findings": [
    { "file": "<filepath>", "risk": <number 0-10>, "confidence": "HIGH" | "MEDIUM", "description": "<brief description>", "lineNumbers": [<line numbers where the issue appears>] }
  ],
  "summary": "<2-3 sentence overall summary for this chunk>"
}`;

  try {
    const response = await session.sendAndWait({ prompt });
    const content = response?.data?.content ?? "";
    try {
      const cleaned = content.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return { text: content, parsed };
    } catch {
      return { text: content, parsed: null, error: new Error("Failed to parse JSON") };
    }
  } catch (err: any) {
    return { text: "", parsed: null, error: err };
  }
}

export async function runAgent1FinalTriage(
  allAnalyses: string[],
  name: string,
  resolvedVersion: string,
  client: any,
  approveAll: any
): Promise<any> {
    try {
      const finalSession = await client.createSession({
        model: "gpt-5-mini",
        onPermissionRequest: approveAll,
      });

      const finalPrompt = `You previously analyzed the npm package "${name}@${resolvedVersion}" in ${allAnalyses.length} chunks. Here are your chunk analyses:

${allAnalyses.join("\n\n---\n\n")}

Now provide a FINAL combined security assessment. Respond in this EXACT JSON format (no markdown, no code fences):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "MALICIOUS",
  "riskScore": <number 0-10>,
  "summary": "<3-5 sentence final security assessment>",
  "recommendations": ["<action item 1>", "<action item 2>"]
}`;

      const finalResponse = await finalSession.sendAndWait({ prompt: finalPrompt });
      const finalContent = finalResponse?.data?.content ?? "";

      try {
        const cleaned = finalContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleaned);
      } catch {
        return {
          verdict: "UNKNOWN",
          riskScore: 5,
          summary: finalContent.slice(0, 500),
          recommendations: [],
        };
      }
    } catch {
      return {
        verdict: "ERROR",
        riskScore: 0,
        summary: "Agent 1 failed to generate assessment",
        recommendations: [],
      };
    }
}

export async function runAgent2Verifier(
  chunk: string,
  analyzerResult: string,
  chunkIndex: number,
  totalChunks: number,
  name: string,
  resolvedVersion: string,
  securitySkill: string,
  client: any,
  approveAll: any
): Promise<{ text: string, parsed: any, error?: Error }> {
  try {
    const verifierSession = await client.createSession({
      model: "gpt-5-mini",
      onPermissionRequest: approveAll,
    });

    const verifierPrompt = `You are an INDEPENDENT security verification agent trained with OWASP methodology. Your job is to double-check another agent's security analysis of the npm package "${name}" (version ${resolvedVersion}).

Use CONFIDENCE LEVELS to assess each finding:
- HIGH: Vulnerable pattern + attacker-controlled input confirmed
- MEDIUM: Vulnerable pattern, input source unclear
- LOW: Theoretical, best practice (do NOT flag)

You must:
1. Independently analyze the source code below for security issues
2. Compare your findings against Agent 1's analysis
3. Identify any FALSE POSITIVES (things Agent 1 flagged that are actually safe)
4. Identify any FALSE NEGATIVES (real threats Agent 1 missed)
5. Confirm or challenge Agent 1's verdict
${securitySkill}
=== AGENT 1's ANALYSIS (CHUNK ${chunkIndex + 1}/${totalChunks}) ===
${analyzerResult}

=== PACKAGE SOURCE CODE (CHUNK ${chunkIndex + 1}/${totalChunks}) ===
${chunk}

Respond in this EXACT JSON format (no markdown, no code fences):
{
  "independentVerdict": "SAFE" | "SUSPICIOUS" | "MALICIOUS",
  "independentRiskScore": <number 0-10>,
  "agreesWithAgent1": true | false,
  "falsePositives": ["<description of incorrectly flagged items>"],
  "falseNegatives": ["<description of missed threats>"],
  "findings": [
    { "file": "<filepath>", "risk": <number 0-10>, "confidence": "HIGH" | "MEDIUM", "description": "<finding>" }
  ],
  "verificationNotes": "<2-3 sentences explaining your independent assessment and where you agree/disagree with Agent 1>"
}`;

    const verifierResponse = await verifierSession.sendAndWait({ prompt: verifierPrompt });
    const verifierContent = verifierResponse?.data?.content ?? "";

    try {
      const cleaned = verifierContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return { text: verifierContent, parsed };
    } catch {
      return { text: verifierContent, parsed: null, error: new Error("Failed to parse JSON") };
    }
  } catch (err: any) {
    return { text: "", parsed: null, error: err };
  }
}

export async function runAgent2FinalVerdict(
  agent1Verdict: any,
  verifierAnalyses: string[],
  name: string,
  resolvedVersion: string,
  client: any,
  approveAll: any
): Promise<any> {
    try {
      const verifierFinalSession = await client.createSession({
        model: "gpt-5-mini",
        onPermissionRequest: approveAll,
      });

      const verifierFinalPrompt = `You are the VERIFIER agent. You have independently reviewed the npm package "${name}@${resolvedVersion}" and cross-checked Agent 1's analysis.

=== AGENT 1's FINAL VERDICT ===
${JSON.stringify(agent1Verdict, null, 2)}

=== YOUR CHUNK-BY-CHUNK VERIFICATION ===
${verifierAnalyses.join("\n\n---\n\n")}

Now provide your FINAL verification report. If you disagree with Agent 1, explain why. Respond in this EXACT JSON format (no markdown, no code fences):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "MALICIOUS",
  "riskScore": <number 0-10>,
  "agreesWithAgent1": true | false,
  "confidence": <number 0-100>,
  "summary": "<3-5 sentence verification summary>",
  "disagreements": ["<point of disagreement>"],
  "recommendations": ["<action item>"]
}`;

      const verifierFinalResponse = await verifierFinalSession.sendAndWait({ prompt: verifierFinalPrompt });
      const verifierFinalContent = verifierFinalResponse?.data?.content ?? "";

      try {
        const cleaned = verifierFinalContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleaned);
      } catch {
        return {
          verdict: "UNKNOWN",
          riskScore: 5,
          agreesWithAgent1: true,
          confidence: 50,
          summary: verifierFinalContent.slice(0, 500),
          disagreements: [],
          recommendations: [],
        };
      }

    } catch {
      return {
        verdict: "ERROR",
        riskScore: 0,
        agreesWithAgent1: true,
        confidence: 0,
        summary: "Verifier agent failed",
        disagreements: [],
        recommendations: [],
      };
    }
}
