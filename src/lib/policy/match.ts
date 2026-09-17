import { tepezzaHumanaMedicaidIndiana } from "./policies/tepezza-humana-medicaid-in";
import type { EligibilityResult, IntakeData, PolicyDocument } from "./types";

export interface PolicyMatchResult {
  policy: PolicyDocument | null;
  matchedOn: string;
  mismatchWarning?: string;
}

/**
 * Demo scope: a single ingested policy document, matched by hand. Production
 * would look this up from a policy store keyed by (drug, payer,
 * line-of-business) populated by a crawler + extraction pipeline — this
 * function is the seam where that lookup would plug in.
 */
export function matchPolicy(
  intake: IntakeData,
  eligibility: EligibilityResult
): PolicyMatchResult {
  const policy = tepezzaHumanaMedicaidIndiana;

  const drugMatches = intake.drug.toLowerCase().includes("tepezza");
  const payerMatches = eligibility.payer.toLowerCase() === policy.payer.toLowerCase();
  const lobMatches =
    eligibility.lineOfBusiness.toLowerCase() === policy.lineOfBusiness.toLowerCase();

  const matchedOn = `${intake.drug} + ${eligibility.payer} + ${eligibility.lineOfBusiness}`;

  if (drugMatches && payerMatches && lobMatches) {
    return { policy, matchedOn };
  }

  return {
    policy: drugMatches && payerMatches ? policy : null,
    matchedOn,
    mismatchWarning:
      "This demo only has one ingested policy document (Humana, Medicaid - Indiana). The member's line of business here doesn't exactly match it — a real system would query the policy store instead of falling back to this fixture.",
  };
}
