"use client";

import { useMemo, useState } from "react";
import { runIntake, type IntakeRunResult } from "@/app/actions";
import { IntakeForm } from "@/components/intake-form";
import { SobResult } from "@/components/sob-result";
import { evaluatePolicy } from "@/lib/policy/evaluator";
import type { FollowUpAnswers, IntakeData } from "@/lib/policy/types";

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

export default function Home() {
  const [run, setRun] = useState<IntakeRunResult | null>(null);
  const [answers, setAnswers] = useState<FollowUpAnswers>({});
  const [loading, setLoading] = useState(false);

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

  async function handleSubmit(intake: IntakeData) {
    setLoading(true);
    setAnswers({});
    try {
      const result = await runIntake(intake);
      setRun(result);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setRun(null);
    setAnswers({});
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">
          Prior Authorization &middot; Summary of Benefits
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tepezza / Humana Medicaid&ndash;Indiana demo
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Traces one prior-authorization request end to end: intake, a simulated 271
          eligibility check, policy matching, and a live NPPES prescriber-specialty
          lookup. It surfaces what the policy requires and what is known so far &mdash;
          it does not predict approval or denial.
        </p>
      </header>

      {!run ? (
        <IntakeForm defaultValues={DEFAULT_INTAKE} loading={loading} onSubmit={handleSubmit} />
      ) : (
        <SobResult
          run={run}
          results={results}
          answers={answers}
          onAnswersChange={setAnswers}
          onReset={handleReset}
        />
      )}
    </main>
  );
}
