/**
 * Target shape for the policy-extraction pipeline (extract.ts). Deliberately
 * self-contained — not part of ./types.ts — so this work stays additive: the
 * live matching engine, SOB screen, and Document Library keep compiling and
 * running against today's flat PolicyDocument shape, untouched.
 *
 * Mirrors the structure the client's extraction guide specifies: a policy
 * version holds many conditions, each with one or more branches (initial /
 * continuation / single when a condition doesn't fork), each branch gating
 * on a recursive ALL/BOTH/ONE criteria tree. Every leaf and rule carries a
 * page + exact quote (checked by validate-extraction.ts) and a provenance
 * label, matching the guide's own citation discipline.
 */

export interface PolicyDrug {
  brand: string;
  generic: string;
  hcpcs: string;
  unit: string;
}

export interface RelatedDocument {
  number: string;
  type: string;
  used: boolean;
  label?: string;
  date?: string;
}

export type ProvenanceLabel = "Policy" | "Inferred" | "Unverified";

export interface GeneralRule {
  kind: "site_of_care" | "not_covered" | "documentation" | "renewal" | "higher_dose";
  text: string;
  /** Exact source text, same role as CriterionLeaf.quote — omitted only
   *  when `label` is "Inferred" (nothing stated to quote) or "Unverified"
   *  (no readable source settles it). */
  quote?: string;
  page: string;
  label: ProvenanceLabel;
  source?: string;
}

export type BranchKind = "initial" | "continuation" | "single";

export interface DosingRule {
  branch: BranchKind | "both";
  maxDose: number;
  unit: string;
  interval: string;
  /** Free-text qualifier path for multi-dimensional dosing (e.g. Botox's
   *  limb-then-age-banded limb-spasticity dosing) — Cartesian-expanded into
   *  one flat row per combination rather than nested, since this shape has
   *  nowhere else to hang a second axis. */
  qualifier?: string;
}

export type CriterionLogic = "ALL" | "BOTH" | "ONE";

export interface CriterionOption {
  value: string;
  label: string;
}

export type CriterionEvaluatorSpec =
  | { kind: "intake-text-match"; field: string; matchAny: string[] }
  | { kind: "npi-specialty-match"; specialtyKeywords: string[] }
  | { kind: "attestation-single"; question: string; options: CriterionOption[]; satisfyingValues: string[] }
  | { kind: "attestation-multi"; question: string; options: CriterionOption[] }
  | { kind: "age-check"; minAge: number }
  | { kind: "diagnosis-match"; keywords: string[] }
  | { kind: "time-on-drug"; minMonths: number }
  | {
      kind: "concurrent-drug";
      exclusionDrugs: string[];
      question: string;
      options: CriterionOption[];
      satisfyingValues: string[];
    }
  | { kind: "site-of-care"; flagSetting: string; transitionNote: string };

export interface CriterionGroup {
  type: "group";
  logic: CriterionLogic;
  items: CriterionNode[];
}

export interface CriterionLeaf {
  type: "leaf";
  id: string;
  number: number;
  label: string;
  text: string;
  /** Exact source text this leaf was drawn from — validate-extraction.ts
   *  substring-checks this against the known document text. An invented
   *  quote is exactly the failure mode citation is meant to catch. */
  quote: string;
  /** "p.N" for the governing policy (the implicit default), or
   *  "<short-name> p.N" (e.g. "PAF-Botox p.2", "1605 p.2") for anything
   *  else — see extract.ts's page-citation convention. */
  page: string;
  provenance: ProvenanceLabel;
  check: CriterionEvaluatorSpec;
  answerSource: "intake" | "271" | "nppes" | "provider";
  documentationRequired: boolean;
}

export type CriterionNode = CriterionGroup | CriterionLeaf;

export interface Branch {
  branch: BranchKind;
  duration: string;
  /** Only meaningful on "continuation" — under this, or restarting, reverts
   *  to the initial branch per the guide's own rule. */
  minTimeOnDrug?: string;
  criteria: CriterionGroup;
}

export interface ExtractedCondition {
  number: number;
  name: string;
  category: "FDA" | "other";
  /** [] (not a guess) when the source policy states none — e.g. IP0637
   *  genuinely lists no ICD-10 codes. */
  icd10: string[];
  page: string;
  cptCode?: string;
  prescriber?: { specialties: string[]; appliesTo: "initial" | "continuation" | "both" };
  branches: Branch[];
  /** Sibling to the criteria tree, not nested in it — dosing is checked
   *  independently of whether the gating criteria are met. */
  dosing: DosingRule[];
}

export interface ExtractedPolicy {
  payer: string;
  policyNumber: string;
  title: string;
  benefit: "medical" | "pharmacy";
  route: string;
  drugs: PolicyDrug[];
  effectiveDate: string;
  reviewDate: string;
  relatedDocuments: RelatedDocument[];
  /** From the policy PDF's Revision Details page — kept for change
   *  tracking even though it's never shown on the SOB screen itself. */
  changeSummary: string;
  /** A unit-definition rule the policy states for its own approval-duration
   *  math (e.g. IP0674's "1 month = 30 days") — undefined when none is
   *  stated. Per the extraction guide's own "things the tool must handle"
   *  list, this must survive extraction even though it's easy to miss. */
  unitConversionNote?: string;
  conditions: ExtractedCondition[];
  rules: GeneralRule[];
}

export interface ValidationResult {
  /** Dotted path to the field this quote came from, e.g.
   *  "conditions[3].branches[0].criteria.items[1].quote". */
  path: string;
  quote: string;
  page: string;
  found: boolean;
}

export type ExtractDocumentKind = "governing-policy" | "pa-form" | "general-policy" | "other";

export interface ExtractSourceDocument {
  kind: ExtractDocumentKind;
  filename: string;
  bytes: Buffer;
}

export interface ExtractSourceText {
  kind: ExtractDocumentKind;
  filename: string;
  text: string;
}

export type ExtractResult =
  | { ok: true; draft: ExtractedPolicy; validation: ValidationResult[]; sourceDocs: ExtractSourceText[] }
  | { ok: false; error: string };
