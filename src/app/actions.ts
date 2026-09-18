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

  let policyMatch: PolicyMatchResult;
  try {
    policyMatch = await matchPolicy(intake, eligibility);
  } catch (err) {
    throw new Error(
      `Couldn't look up the matching policy document (database error): ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
  const criteria = policyMatch.policy?.criteria ?? [];
  const results = evaluatePolicy(criteria, {
    intake,
    eligibility,
    npiLookup,
    answers: {},
  });

  return { intake, eligibility, npiLookup, policyMatch, results };
}
