"use server";

import { revalidatePath } from "next/cache";
import { extractPolicyFromText, type ExtractResult } from "@/lib/policy/extract";
import {
  addPolicy,
  deletePolicy,
  searchPolicySummaries,
  type NewPolicyInput,
} from "@/lib/policy/store";
import type { PolicySummary } from "@/lib/policy/types";

/** Generous cap for a full policy document's pasted text (SQLite handles
 *  large TEXT columns fine) — this just guards against pathological input. */
const MAX_RAW_TEXT_LENGTH = 200_000;

/**
 * Server Actions are reachable via direct POST requests, not just through
 * this app's own form — never trust that client-side validation already ran.
 */
function validateNewPolicy(input: NewPolicyInput): string | null {
  if (!input.drug?.trim()) return "Drug is required.";
  if (!input.payer?.trim()) return "Payer is required.";
  if (!input.lineOfBusiness?.trim()) return "Line of business is required.";
  if (!Array.isArray(input.criteria) || input.criteria.length === 0) {
    return "At least one criterion is required.";
  }
  for (const criterion of input.criteria) {
    if (!criterion.id?.trim() || !criterion.label?.trim()) {
      return "Every criterion needs a label.";
    }
    const evaluator = criterion.evaluator;
    switch (evaluator.kind) {
      case "intake-text-match":
        if (!evaluator.matchAny || evaluator.matchAny.length === 0) {
          return `Criterion "${criterion.label}" needs at least one match keyword.`;
        }
        break;
      case "npi-specialty-match":
        if (!evaluator.specialtyKeywords || evaluator.specialtyKeywords.length === 0) {
          return `Criterion "${criterion.label}" needs at least one specialty keyword.`;
        }
        break;
      case "attestation-single":
        if (!evaluator.options || evaluator.options.length === 0) {
          return `Criterion "${criterion.label}" needs at least one option.`;
        }
        if (!evaluator.satisfyingValues || evaluator.satisfyingValues.length === 0) {
          return `Criterion "${criterion.label}" needs at least one option marked as satisfying it.`;
        }
        break;
      case "attestation-multi":
        if (!evaluator.options || evaluator.options.length === 0) {
          return `Criterion "${criterion.label}" needs at least one option.`;
        }
        break;
      default:
        return `Criterion "${criterion.label}" has an unrecognized evaluator type.`;
    }
  }
  if (input.rawText && input.rawText.length > MAX_RAW_TEXT_LENGTH) {
    return `Source document text is too long (max ${MAX_RAW_TEXT_LENGTH.toLocaleString()} characters).`;
  }
  return null;
}

export async function createPolicyDocument(input: NewPolicyInput) {
  const validationError = validateNewPolicy(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const policy = await addPolicy({
    ...input,
    drug: input.drug.trim(),
    payer: input.payer.trim(),
    lineOfBusiness: input.lineOfBusiness.trim(),
    policyType: input.policyType?.trim() || "Prior Authorization",
  });
  revalidatePath("/documents");
  revalidatePath("/");
  return policy;
}

export async function deletePolicyDocument(id: string) {
  if (!id?.trim()) {
    throw new Error("A document id is required.");
  }
  await deletePolicy(id);
  revalidatePath("/documents");
  revalidatePath("/");
}

/** Typeahead search backing the drug/policy combobox — safe to call
 *  frequently as the user types, since it's FTS-indexed rather than a
 *  full-table scan. */
export async function searchPolicies(query: string): Promise<PolicySummary[]> {
  return searchPolicySummaries(query, 10);
}

/** AI-assisted extraction of a policy draft from pasted document text —
 *  only ever prefills the "Add document" form for manual review. */
export async function extractPolicy(rawText: string): Promise<ExtractResult> {
  return extractPolicyFromText(rawText);
}
