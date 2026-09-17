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

export interface NpiLookupResult {
  npi: string;
  found: boolean;
  providerName?: string;
  taxonomyCode?: string;
  taxonomyDescription?: string;
  matchesRequiredSpecialty: boolean;
  source: "nppes-live";
}

export interface FollowUpAnswers {
  thyroidStatus?: "euthyroid" | "being-treated" | "not-controlled";
  priorTherapyAttested?: "attested-no-prior" | "has-prior-therapy";
  severityFindings?: string[];
}

export interface EvalContext {
  intake: IntakeData;
  eligibility: EligibilityResult | null;
  npiLookup: NpiLookupResult | null;
  answers: FollowUpAnswers;
}

export interface SubFinding {
  id: string;
  label: string;
}

export type CriterionEvaluatorSpec =
  | { kind: "intake-text-match"; field: keyof IntakeData; matchAny: string[] }
  | { kind: "npi-specialty-match" }
  | {
      kind: "follow-up-single";
      answerKey: "thyroidStatus" | "priorTherapyAttested";
      satisfyingValues: string[];
    }
  | { kind: "follow-up-multi-any"; answerKey: "severityFindings" };

export interface CriterionDefinition {
  id: string;
  number: number;
  label: string;
  description: string;
  systemVerifiable: boolean;
  subFindings?: SubFinding[];
  evaluator: CriterionEvaluatorSpec;
}

export interface CriterionResult {
  id: string;
  number: number;
  label: string;
  systemVerifiable: boolean;
  status: CriterionStatus;
  detail: string;
}

export interface PolicyDocument {
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
}
