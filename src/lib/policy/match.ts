import { isEmbeddingConfigured } from "./embeddings";
import {
  findExactPolicy,
  findPolicyByDrugAndPayer,
  searchPoliciesByKeyword,
  searchPoliciesBySemanticSimilarity,
} from "./store";
import type { EligibilityResult, IntakeData, PolicyDocument, PolicyMatchMethod } from "./types";

/** Starting point for "is this semantic match good enough to surface" —
 *  cosine similarity from text-embedding-3-small. Tune against real data;
 *  a false-negative here just falls through to "no policy found," which is
 *  the safe failure mode for a compliance-adjacent tool. */
const SEMANTIC_MATCH_THRESHOLD = 0.3;

export interface PolicyMatchResult {
  policy: PolicyDocument | null;
  matchedOn: string;
  /** How this policy was found — surfaced in the UI so a keyword or AI
   *  suggestion is never shown with the same confidence as an exact match. */
  matchMethod: PolicyMatchMethod;
  /** Only set for "semantic" matches: the cosine similarity score. */
  matchConfidence?: number;
  mismatchWarning?: string;
}

/**
 * Looks up the ingested policy document matching this request, trying
 * progressively looser tiers: exact (drug + payer + line of business) →
 * exact drug/payer with a different line of business → keyword search →
 * semantic similarity (only if an OpenAI key is configured). Any number of
 * documents can be ingested via the Document Library — this is just the
 * lookup against whatever has been ingested so far.
 */
export async function matchPolicy(
  intake: IntakeData,
  eligibility: EligibilityResult
): Promise<PolicyMatchResult> {
  const matchedOn = `${intake.drug} + ${eligibility.payer} + ${eligibility.lineOfBusiness}`;

  const exact = await findExactPolicy(intake.drug, eligibility.payer, eligibility.lineOfBusiness);
  if (exact) {
    return { policy: exact, matchedOn, matchMethod: "exact" };
  }

  const drugAndPayer = await findPolicyByDrugAndPayer(intake.drug, eligibility.payer);
  if (drugAndPayer) {
    return {
      policy: drugAndPayer,
      matchedOn,
      matchMethod: "partial",
      mismatchWarning: `This request's line of business ("${eligibility.lineOfBusiness}") doesn't exactly match the ingested policy's ("${drugAndPayer.lineOfBusiness}"). Showing the closest match — a real system would query the policy store instead of falling back to this fixture.`,
    };
  }

  const keywordMatches = await searchPoliciesByKeyword(`${intake.drug} ${intake.diagnosis}`, 1);
  const keywordMatch = keywordMatches[0];
  if (keywordMatch) {
    return {
      policy: keywordMatch,
      matchedOn,
      matchMethod: "keyword",
      mismatchWarning: `No exact drug/payer match. Suggested by keyword search on "${keywordMatch.drug}" (${keywordMatch.payer} / ${keywordMatch.lineOfBusiness}) — verify this is the right policy before relying on it.`,
    };
  }

  if (isEmbeddingConfigured()) {
    const semanticMatches = await searchPoliciesBySemanticSimilarity(
      `${intake.drug} ${intake.diagnosis}`,
      1
    );
    const top = semanticMatches[0];
    if (top && top.similarity >= SEMANTIC_MATCH_THRESHOLD) {
      return {
        policy: top.policy,
        matchedOn,
        matchMethod: "semantic",
        matchConfidence: top.similarity,
        mismatchWarning: `No exact or keyword match. AI-suggested by semantic similarity to "${top.policy.drug}" (${top.policy.payer} / ${top.policy.lineOfBusiness}, ${Math.round(top.similarity * 100)}% similarity) — this is not a guaranteed match, verify manually.`,
      };
    }
  }

  return {
    policy: null,
    matchedOn,
    matchMethod: "none",
    mismatchWarning: `No ingested policy document matches "${intake.drug}" yet. Add it in the Document Library to enable a Summary of Benefits for this drug.`,
  };
}
