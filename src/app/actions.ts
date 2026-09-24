"use server";

import { mock271Provider } from "@/lib/eligibility/mock-271";
import { log } from "@/lib/log";
import { lookupNpi } from "@/lib/npi/nppes";
import { evaluatePolicy } from "@/lib/policy/evaluator";
import { matchPolicy, type PolicyMatchResult } from "@/lib/policy/match";
import { assertRateLimit } from "@/lib/rate-limit";
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
  await assertRateLimit("intake", 20, 5 * 60 * 1000);

  const [eligibility, npiLookup] = await Promise.all([
    mock271Provider.check(intake.insuranceId, intake.payer),
    lookupNpi(intake.orderingProviderNpi),
  ]);

  let policyMatch: PolicyMatchResult;
  try {
    policyMatch = await matchPolicy(intake, eligibility);
  } catch (err) {
    log.error("Policy match failed", { message: err instanceof Error ? err.message : String(err) });
    throw new Error("Couldn't look up the matching policy document right now. Try again in a moment.");
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
