export type CriterionStatus = "confirmed" | "not-met" | "needs-info";

export interface IntakeData {
  patientName: string;
  patientDob: string;
  insuranceId: string;
  payer: string;
  drug: string;
  diagnosis: string;
  buyAndBill: boolean;
  orderingProviderNpi: string;
  dispensingLocation: string;
}

export interface EligibilityResult {
  active: boolean;
  payer: string;
  lineOfBusiness: string;
  planType: string;
  deductibleRemaining: number | null;
  coinsurancePercent: number | null;
  oopRemaining: number | null;
  source: "271-mock";
}

export type NpiLookupStatus = "resolved" | "invalid-format" | "not-found" | "lookup-failed";

export interface NpiLookupResult {
  npi: string;
  status: NpiLookupStatus;
  found: boolean;
  providerName?: string;
  taxonomyCode?: string;
  taxonomyDescription?: string;
  source: "nppes-live";
}

export type FollowUpAnswerValue = string | string[];

/** Keyed by CriterionDefinition.id — generic across any ingested policy. */
export type FollowUpAnswers = Record<string, FollowUpAnswerValue>;

export interface EvalContext {
  intake: IntakeData;
  eligibility: EligibilityResult | null;
  npiLookup: NpiLookupResult | null;
  answers: FollowUpAnswers;
}

export interface CriterionOption {
  value: string;
  label: string;
}

export type CriterionEvaluatorSpec =
  | { kind: "intake-text-match"; field: keyof IntakeData; matchAny: string[] }
  | { kind: "npi-specialty-match"; specialtyKeywords: string[] }
  | {
      kind: "attestation-single";
      question: string;
      options: CriterionOption[];
      satisfyingValues: string[];
    }
  | { kind: "attestation-multi"; question: string; options: CriterionOption[] };

export interface CriterionDefinition {
  id: string;
  number: number;
  label: string;
  description: string;
  systemVerifiable: boolean;
  evaluator: CriterionEvaluatorSpec;
}

export interface CriterionResult {
  id: string;
  number: number;
  label: string;
  systemVerifiable: boolean;
  status: CriterionStatus;
  detail: string;
  evaluator: CriterionEvaluatorSpec;
}

export interface PolicyDocument {
  id: string;
  drug: string;
  payer: string;
  lineOfBusiness: string;
  policyType: string;
  effectiveDate: string;
  reviewDate: string;
  sourceNote: string;
  approvalDuration: { initial: string; renewal: string };
  notApplicable: string[];
  criteria: CriterionDefinition[];
  /** Pasted source text, kept for future AI-assisted extraction. */
  rawText?: string;
  /** Whether a semantic-search embedding has been generated for this policy. */
  hasEmbedding: boolean;
  createdAt: string;
}

/** Lightweight projection for pickers/search results over a large catalog. */
export interface PolicySummary {
  id: string;
  drug: string;
  payer: string;
  lineOfBusiness: string;
  criteriaCount: number;
}

/**
 * How a request's drug/payer/line-of-business resolved to an ingested
 * policy — surfaced in the UI so an AI-suggested match is never presented
 * with the same confidence as an exact field match.
 */
export type PolicyMatchMethod = "exact" | "partial" | "keyword" | "semantic" | "none";
