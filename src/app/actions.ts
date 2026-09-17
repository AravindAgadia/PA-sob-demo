"use server";

import { mock271Provider } from "@/lib/eligibility/mock-271";
import { lookupNpi } from "@/lib/npi/nppes";
import { evaluatePolicy } from "@/lib/policy/evaluator";
import { matchPolicy, type PolicyMatchResult } from "@/lib/policy/match";
import type {
  CriterionResult,
  EligibilityResult,
  IntakeData,
  NpiLookupResult,
} from "@/lib/policy/types";

export interface IntakeRunResult {
  intake: IntakeData;
  eligibility: EligibilityResult;
  npiLookup: NpiLookupResult;
  policyMatch: PolicyMatchResult;
  results: CriterionResult[];
}

export async function runIntake(intake: IntakeData): Promise<IntakeRunResult> {
  const [eligibility, npiLookup] = await Promise.all([
    mock271Provider.check(intake.insuranceId, intake.payer),
    lookupNpi(intake.orderingProviderNpi),
  ]);

  const policyMatch = await matchPolicy(intake, eligibility);
  const criteria = policyMatch.policy?.criteria ?? [];
  const results = evaluatePolicy(criteria, {
    intake,
    eligibility,
    npiLookup,
    answers: {},
  });

  return { intake, eligibility, npiLookup, policyMatch, results };
}
