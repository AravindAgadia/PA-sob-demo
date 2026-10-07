"use client";

import { useMemo, useState } from "react";
import { runIntake, type IntakeRunResult } from "@/app/actions";
import { evaluatePolicy } from "@/lib/policy/evaluator";
import type { CaseDecision, FollowUpAnswers, IntakeData } from "@/lib/policy/types";

/**
 * Owns the post-submit pipeline for an intake request: the
 * eligibility/policy-match/NPI-lookup run, the live re-evaluation against
 * follow-up answers, and the proceed/decline/reset case-decision state.
 */
export function useIntakeRun() {
  const [run, setRun] = useState<IntakeRunResult | null>(null);
  const [answers, setAnswers] = useState<FollowUpAnswers>({});
  const [decision, setDecision] = useState<CaseDecision>("pending");
  const [declineReason, setDeclineReason] = useState<string | undefined>();
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    if (!run) return [];
    if (!run.policyMatch.policy) return run.results;
    return evaluatePolicy(run.policyMatch.policy.criteria, {
      intake: run.intake,
      eligibility: run.eligibility,
      npiLookup: run.npiLookup,
      answers,
    });
  }, [run, answers]);

  const allResolved = results.length > 0 && results.every((r) => r.status !== "needs-info");

  async function handleSubmit(intake: IntakeData) {
    setLoading(true);
    setError(null);
    setAnswers({});
    setDecision("pending");
    setDeclineReason(undefined);
    setClosedAt(null);
    try {
      const result = await runIntake(intake);
      setRun(result);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't complete this request — the eligibility check, NPI lookup, or policy match failed. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleProceed() {
    setDecision("proceeded");
  }

  function handleDecline(reason: string) {
    setDecision("declined");
    setDeclineReason(reason || undefined);
    setClosedAt(new Date().toISOString());
  }

  function handleReset() {
    setRun(null);
    setAnswers({});
    setDecision("pending");
    setDeclineReason(undefined);
    setClosedAt(null);
    setError(null);
  }

  return {
    run,
    results,
    answers,
    setAnswers,
    decision,
    declineReason,
    closedAt,
    loading,
    error,
    allResolved,
    handleSubmit,
    handleProceed,
    handleDecline,
    handleReset,
  };
}
