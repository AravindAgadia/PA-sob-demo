"use server";

import { searchPolicySummaries } from "@/lib/policy/store";
import type { PolicySummary } from "@/lib/policy/types";

/** Typeahead search backing the New PA Request drug combobox — safe to
 *  call frequently as the user types, since it's FTS-indexed rather than
 *  a full-table scan. The Document Library's own manual-entry/AI-extract
 *  flow (createPolicyDocument, deletePolicyDocument, extractPolicy*) has
 *  been retired in favor of the newer, structured extraction pipeline at
 *  /documents/extract — this is the one export from here that's still
 *  live, since it backs a separate, still-active screen. */
export async function searchPolicies(query: string): Promise<PolicySummary[]> {
  return searchPolicySummaries(query, 10);
}
