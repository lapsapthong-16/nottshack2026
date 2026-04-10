export const auditReportProperties = {
  pkgName: {
    type: "string",
    minLength: 1,
    maxLength: 214,
  },
  version: {
    type: "string",
    minLength: 1,
    maxLength: 64,
  },
  riskScore: {
    type: "integer",
    minimum: 0,
    maximum: 100,
  },
  summary: {
    type: "string",
    minLength: 1,
    maxLength: 4000,
  },
  malwareDetected: {
    type: "boolean",
  },
  auditorSignature: {
    type: "string",
    minLength: 1,
    maxLength: 512,
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
      indices: [],
      required: [...auditReportRequired],
      additionalProperties: false,
    },
  };
}

export function buildEvoguardContractJson(ownerId: string) {
  return {
    "$format_version": 1,
    ownerId,
    version: 1,
    documents: {
      auditReport: {
        type: "object",
        properties: auditReportProperties,
        indices: [],
        required: [...auditReportRequired],
        additionalProperties: false,
      },
    },
  };
}

export function getEvoguardSchemaSummary() {
  return {
    auditReport: {
      required: [...auditReportRequired],
      properties: auditReportProperties,
    },
  };
}
