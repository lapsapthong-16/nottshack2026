export const auditReportProperties = {
  pkgName: {
    type: "string",
    minLength: 1,
    maxLength: 214,
    position: 0,
  },
  version: {
    type: "string",
    minLength: 1,
    maxLength: 64,
    position: 1,
  },
  riskScore: {
    type: "integer",
    minimum: 0,
    maximum: 100,
    position: 2,
  },
  summary: {
    type: "string",
    minLength: 1,
    maxLength: 4000,
    position: 3,
  },
  malwareDetected: {
    type: "boolean",
    position: 4,
  },
  auditorSignature: {
    type: "string",
    minLength: 1,
    maxLength: 512,
    position: 5,
  },
  findingsCount: {
    type: "integer",
    minimum: 0,
    position: 6,
  },
  snippetsCount: {
    type: "integer",
    minimum: 0,
    position: 7,
  },
  filesCount: {
    type: "integer",
    minimum: 0,
    position: 8,
  },
} as const;


export const auditFindingProperties = {
  reportId: {
    type: "string",
    minLength: 1,
    maxLength: 63,
    position: 0,
  },
  file: {
    type: "string",
    minLength: 1,
    maxLength: 256,
    position: 1,
  },
  severity: {
    type: "string",
    enum: ["critical", "high", "medium", "low", "info", "none"],

    position: 2,
  },
  risk: {
    type: "integer",
    minimum: 0,
    maximum: 10,
    position: 3,
  },
  reasoning: {
    type: "string",
    minLength: 1,
    maxLength: 2000,
    position: 4,
  },
  lineNumbers: {
    type: "string",
    minLength: 1,
    maxLength: 1024,
    position: 5,
  },
} as const;



export const auditSnippetProperties = {
  reportId: {
    type: "string",
    minLength: 1,
    maxLength: 63,
    position: 0,
  },
  file: {
    type: "string",
    minLength: 1,
    maxLength: 256,
    position: 1,
  },
  lineStart: {
    type: "integer",
    minimum: 1,
    position: 2,
  },
  lineEnd: {
    type: "integer",
    minimum: 1,
    position: 3,
  },
  part: {
    type: "integer",
    minimum: 0,
    position: 4,
  },
  content: {
    type: "array",
    byteArray: true,
    minItems: 1,
    maxItems: 16000,
    position: 5,
  },
} as const;

export const auditReportRequired = [
  "pkgName",
  "version",
  "riskScore",
  "summary",
  "malwareDetected",
  "auditorSignature",
] as const;

export function buildEvoguardContractSchema() {
  return {
    auditReport: {
      type: "object",
      properties: auditReportProperties,
      indices: [
        { name: "byOwner", properties: [{ "$ownerId": "asc" }], unique: false },
      ],
      required: [...auditReportRequired],
      additionalProperties: false,
    },
    auditFinding: {
      type: "object",
      properties: auditFindingProperties,
      indices: [
        { name: "byReport", properties: [{ "reportId": "asc" }], unique: false },
      ],
      required: ["reportId", "file", "severity", "risk", "reasoning"],
      additionalProperties: false,
    },
    auditSnippet: {
      type: "object",
      properties: auditSnippetProperties,
      indices: [
        { name: "byReport", properties: [{ "reportId": "asc" }], unique: false },
      ],
      required: ["reportId", "file", "lineStart", "lineEnd", "part", "content"],
      additionalProperties: false,
    },
  };
}

export function buildEvoguardContractJson(ownerId: string) {
  return {
    "$format_version": 1,
    ownerId,
    version: 1,
    documents: buildEvoguardContractSchema(),
  };
}

export function getEvoguardSchemaSummary() {
  return {
    auditReport: {
      required: [...auditReportRequired],
      properties: auditReportProperties,
    },
    auditFinding: {
      properties: auditFindingProperties,
    },
    auditSnippet: {
      properties: auditSnippetProperties,
    },
  };
}
