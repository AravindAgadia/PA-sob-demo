/**
 * Hand-built JSON Schemas for OpenAI's Structured Outputs (`response_format:
 * {type:"json_schema", json_schema:{strict:true, schema:...}}`), which
 * guarantees schema-conformant output from the API itself rather than only
 * from defensive coercion after the fact (today's extract.ts's old
 * approach, kept as a fallback in extract.ts if a strict recursive schema
 * ever proves unreliable).
 *
 * Strict mode's own rules shape every object below: every property must be
 * listed in `required` (optionality is expressed as a nullable type, e.g.
 * `["string","null"]`, not by omitting the key) and every object needs
 * `additionalProperties: false`. Helper functions below exist only to avoid
 * re-typing those two rules on every object literal.
 */

type JsonSchema = Record<string, unknown>;

function obj(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const str: JsonSchema = { type: "string" };
const num: JsonSchema = { type: "number" };
const bool: JsonSchema = { type: "boolean" };
const nullableStr: JsonSchema = { type: ["string", "null"] };
const strArray: JsonSchema = { type: "array", items: str };

const CRITERION_OPTION = obj({ value: str, label: str });

const CHECK = {
  anyOf: [
    obj({ kind: { type: "string", enum: ["intake-text-match"] }, field: str, matchAny: strArray }),
    obj({ kind: { type: "string", enum: ["npi-specialty-match"] }, specialtyKeywords: strArray }),
    obj({
      kind: { type: "string", enum: ["attestation-single"] },
      question: str,
      options: { type: "array", items: CRITERION_OPTION },
      satisfyingValues: strArray,
    }),
    obj({
      kind: { type: "string", enum: ["attestation-multi"] },
      question: str,
      options: { type: "array", items: CRITERION_OPTION },
    }),
    obj({ kind: { type: "string", enum: ["age-check"] }, minAge: num }),
    obj({ kind: { type: "string", enum: ["diagnosis-match"] }, keywords: strArray }),
    obj({ kind: { type: "string", enum: ["time-on-drug"] }, minMonths: num }),
    obj({
      kind: { type: "string", enum: ["concurrent-drug"] },
      exclusionDrugs: strArray,
      question: str,
      options: { type: "array", items: CRITERION_OPTION },
      satisfyingValues: strArray,
    }),
    obj({ kind: { type: "string", enum: ["site-of-care"] }, flagSetting: str, transitionNote: str }),
  ],
};

const CRITERION_LEAF = obj({
  type: { type: "string", enum: ["leaf"] },
  id: str,
  number: num,
  label: str,
  text: str,
  quote: str,
  page: str,
  provenance: { type: "string", enum: ["Policy", "Inferred", "Unverified"] },
  check: CHECK,
  answerSource: { type: "string", enum: ["intake", "271", "nppes", "provider"] },
  documentationRequired: bool,
});

const CRITERION_GROUP = obj({
  type: { type: "string", enum: ["group"] },
  logic: { type: "string", enum: ["ALL", "BOTH", "ONE"] },
  items: { type: "array", items: { $ref: "#/$defs/criterionNode" } },
});

const CRITERION_TREE_DEFS = {
  criterionNode: { anyOf: [{ $ref: "#/$defs/criterionGroup" }, { $ref: "#/$defs/criterionLeaf" }] },
  criterionGroup: CRITERION_GROUP,
  criterionLeaf: CRITERION_LEAF,
};

const DOSING_RULE = obj({
  branch: { type: "string", enum: ["initial", "continuation", "single", "both"] },
  maxDose: num,
  unit: str,
  interval: str,
  qualifier: nullableStr,
});

const BRANCH = obj({
  branch: { type: "string", enum: ["initial", "continuation", "single"] },
  duration: str,
  minTimeOnDrug: nullableStr,
  criteria: { $ref: "#/$defs/criterionNode" },
});

const PRESCRIBER = obj({
  specialties: strArray,
  appliesTo: { type: "string", enum: ["initial", "continuation", "both"] },
});

const POLICY_DRUG = obj({ brand: str, generic: str, hcpcs: str, unit: str });

const RELATED_DOCUMENT = obj({
  number: str,
  type: str,
  used: bool,
  label: nullableStr,
  date: nullableStr,
});

const GENERAL_RULE = obj({
  kind: { type: "string", enum: ["site_of_care", "not_covered", "documentation", "renewal", "higher_dose"] },
  text: str,
  quote: nullableStr,
  page: str,
  label: { type: "string", enum: ["Policy", "Inferred", "Unverified"] },
  source: nullableStr,
});

/** Phase A: policy/drug-level header fields + a condition index (name/page
 *  range only — full criteria come from Phase B, one call per condition) +
 *  the page ranges of sections every condition's Phase B call will need. */
const PAGE_RANGE = obj({ startPage: num, endPage: num });

export const PHASE_A_SCHEMA = {
  name: "policy_header_extraction",
  strict: true,
  schema: {
    ...obj({
      payer: str,
      policyNumber: str,
      title: str,
      benefit: { type: "string", enum: ["medical", "pharmacy"] },
      route: str,
      drugs: { type: "array", items: POLICY_DRUG },
      effectiveDate: str,
      reviewDate: str,
      relatedDocuments: { type: "array", items: RELATED_DOCUMENT },
      changeSummary: str,
      unitConversionNote: nullableStr,
      rules: { type: "array", items: GENERAL_RULE },
      conditionIndex: {
        type: "array",
        items: obj({
          number: num,
          name: str,
          category: { type: "string", enum: ["FDA", "other"] },
          startPage: num,
          endPage: num,
        }),
      },
      sharedSectionPages: obj({
        policyStatement: { $ref: "#/$defs/pageRange" },
        dosingInformation: { $ref: "#/$defs/pageRange" },
        codingInformation: { $ref: "#/$defs/pageRange" },
        conditionsNotCovered: { $ref: "#/$defs/pageRange" },
        revisionDetails: { $ref: "#/$defs/pageRange" },
      }),
    }),
    $defs: { pageRange: PAGE_RANGE },
  },
} as const;

/** Phase B: one full Condition object (branches, criteria tree, dosing). */
export const PHASE_B_SCHEMA = {
  name: "condition_extraction",
  strict: true,
  schema: {
    ...obj({
      number: num,
      name: str,
      category: { type: "string", enum: ["FDA", "other"] },
      icd10: strArray,
      page: str,
      cptCode: nullableStr,
      prescriber: { anyOf: [PRESCRIBER, { type: "null" }] },
      branches: { type: "array", items: { $ref: "#/$defs/branch" } },
      dosing: { type: "array", items: DOSING_RULE },
    }),
    $defs: { ...CRITERION_TREE_DEFS, branch: BRANCH },
  },
} as const;
