"use client";

import { useMemo, useState } from "react";
import { runIntake, type IntakeRunResult } from "@/app/actions";
import { IntakeForm } from "@/components/intake-form";
import { SobResult } from "@/components/sob-result";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Stepper, type StepperStep } from "@/components/stepper";
import { evaluatePolicy } from "@/lib/policy/evaluator";
import type { CaseDecision, FollowUpAnswers, IntakeData, PolicySummary } from "@/lib/policy/types";

const DEFAULT_INTAKE: IntakeData = {
  patientName: "Maria Alvarez",
  patientDob: "1985-03-14",
  insuranceId: "HUM-IN-88213045",
  payer: "Humana",
  drug: "Tepezza (teprotumumab)",
  diagnosis: "Thyroid eye disease (E0500)",
  buyAndBill: true,
  orderingProviderNpi: "1871588442",
  dispensingLocation: "Physician office",
};

export function IntakeFlow({
  initialOptions,
  totalIngested,
}: {
  initialOptions: PolicySummary[];
  totalIngested: number;
}) {
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

  const steps: StepperStep[] = [
    { label: "Submit", status: !run ? "current" : "complete", color: "orange" },
    { label: "Eligibility", status: !run ? "upcoming" : "complete", color: "blue" },
    { label: "Policy match", status: !run ? "upcoming" : "complete", color: "purple" },
    { label: "Prescriber", status: !run ? "upcoming" : "complete", color: "pink" },
    {
      label: "Benefits",
      status: !run ? "upcoming" : decision === "pending" ? "current" : "complete",
      color: "green",
    },
  ];
  if (decision === "declined") {
    steps.push({ label: "Closed", status: "complete", color: "orange" });
  } else {
    steps.push({
      label: "Questions",
      status: !run || decision === "pending" ? "upcoming" : allResolved ? "complete" : "current",
      color: "green",
    });
    steps.push({
      label: "Complete",
      status: run && decision === "proceeded" && allResolved ? "current" : "upcoming",
      color: "green",
    });
  }

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">
          Prior Authorization &middot; Summary of Benefits
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">New PA request</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Traces one prior-authorization request end to end: intake, a simulated 271
          eligibility check, policy matching against every ingested document, and a live
          NPPES prescriber-specialty lookup. It surfaces what the policy requires and what is
          known so far &mdash; it does not predict approval or denial.
        </p>
      </header>

      <div className="mb-8 overflow-x-auto rounded-lg border bg-card px-4 py-3">
        <Stepper steps={steps} />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!run ? (
        <IntakeForm
          defaultValues={DEFAULT_INTAKE}
          initialOptions={initialOptions}
          totalIngested={totalIngested}
          loading={loading}
          onSubmit={handleSubmit}
        />
      ) : (
        <SobResult
          run={run}
          results={results}
          answers={answers}
          onAnswersChange={setAnswers}
          decision={decision}
          onProceed={handleProceed}
          onDecline={handleDecline}
          declineReason={declineReason}
          closedAt={closedAt}
          onReset={handleReset}
        />
      )}
    </main>
  );
}
