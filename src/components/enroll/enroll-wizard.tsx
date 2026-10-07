"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { SobResult } from "@/components/sob-result";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper, type StepperStep } from "@/components/stepper";
import { useIntakeRun } from "@/hooks/use-intake-run";
import {
  BLANK_ENROLLMENT,
  ENROLL_STEPS,
  mapEnrollmentToIntake,
  type EnrollStepId,
  type EnrollmentData,
} from "./types";
import { StepPayerPatient, getPayerPatientIssues } from "./step-payer-patient";
import { StepPrescriber, getPrescriberIssues } from "./step-prescriber";
import { StepDrugDetails, getDrugDetailsIssues } from "./step-drug-details";
import { StepServicingProvider, getServicingProviderIssues } from "./step-servicing-provider";

export function EnrollWizard() {
  const [data, setData] = useState<EnrollmentData>(BLANK_ENROLLMENT);
  const [step, setStep] = useState<EnrollStepId>("payer-patient");
  const [attemptedNext, setAttemptedNext] = useState<Record<EnrollStepId, boolean>>(
    {} as Record<EnrollStepId, boolean>
  );

  const {
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
  } = useIntakeRun();

  const currentIssues = useMemo(() => {
    switch (step) {
      case "payer-patient":
        return getPayerPatientIssues(data.payerPatient);
      case "prescriber":
        return getPrescriberIssues(data.prescriber);
      case "drug":
        return getDrugDetailsIssues(data.drug);
      case "servicing-provider":
        return getServicingProviderIssues(data.servicingProvider);
      default:
        return [];
    }
  }, [step, data]);

  const stepIndex = ENROLL_STEPS.findIndex((s) => s.id === step);
  const isLastStep = stepIndex === ENROLL_STEPS.length - 1;

  const wizardSteps: StepperStep[] = ENROLL_STEPS.map((s, i) => ({
    label: s.label,
    status: i === stepIndex ? "current" : i < stepIndex ? "complete" : "upcoming",
    color: "blue",
  }));

  function handleNext() {
    if (currentIssues.length > 0) {
      setAttemptedNext((prev) => ({ ...prev, [step]: true }));
      return;
    }
    if (isLastStep) {
      handleSubmit(mapEnrollmentToIntake(data));
      return;
    }
    const next = ENROLL_STEPS[stepIndex + 1];
    if (next) setStep(next.id);
  }

  function handleBack() {
    const prev = ENROLL_STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }

  function handleFullReset() {
    handleReset();
    setData(BLANK_ENROLLMENT);
    setStep(ENROLL_STEPS[0].id);
    setAttemptedNext({} as Record<EnrollStepId, boolean>);
  }

  const postSubmitSteps: StepperStep[] = [
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
    postSubmitSteps.push({ label: "Closed", status: "complete", color: "orange" });
  } else {
    postSubmitSteps.push({
      label: "Questions",
      status: !run || decision === "pending" ? "upcoming" : allResolved ? "complete" : "current",
      color: "green",
    });
    postSubmitSteps.push({
      label: "Complete",
      status: run && decision === "proceeded" && allResolved ? "current" : "upcoming",
      color: "green",
    });
  }

  if (run) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-8 overflow-x-auto rounded-lg border bg-card px-4 py-3">
          <Stepper steps={postSubmitSteps} />
        </div>
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
          onReset={handleFullReset}
        />
      </main>
    );
  }

  const showErrors = !!attemptedNext[step];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">
          Prior Authorization &middot; Enrollment
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">New enrollment</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          A richer, 4-step intake covering payer, patient, prescriber, drug, and servicing-provider
          detail. Submitting the final step runs eligibility, policy match, and prescriber lookup.
        </p>
      </header>

      <div className="mb-8 overflow-x-auto rounded-lg border bg-card px-4 py-3">
        <Stepper steps={wizardSteps} />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{ENROLL_STEPS[stepIndex]?.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "payer-patient" && (
            <StepPayerPatient
              value={data.payerPatient}
              onChange={(v) => setData((d) => ({ ...d, payerPatient: v }))}
              showErrors={showErrors}
            />
          )}
          {step === "prescriber" && (
            <StepPrescriber
              value={data.prescriber}
              onChange={(v) => setData((d) => ({ ...d, prescriber: v }))}
              showErrors={showErrors}
            />
          )}
          {step === "drug" && (
            <StepDrugDetails
              value={data.drug}
              onChange={(v) => setData((d) => ({ ...d, drug: v }))}
              showErrors={showErrors}
            />
          )}
          {step === "servicing-provider" && (
            <StepServicingProvider
              value={data.servicingProvider}
              onChange={(v) => setData((d) => ({ ...d, servicingProvider: v }))}
              prescriber={data.prescriber}
              showErrors={showErrors}
            />
          )}
        </CardContent>
        <CardFooter className="flex-col items-start gap-3">
          {showErrors && currentIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>Missing required fields</AlertTitle>
              <AlertDescription>Fill in: {currentIssues.join(", ")}.</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={stepIndex === 0 || loading}
            >
              Back
            </Button>
            <Button type="button" onClick={handleNext} disabled={loading}>
              {isLastStep && loading && <Loader2 className="animate-spin" />}
              {isLastStep
                ? loading
                  ? "Running eligibility, policy match, and NPI lookup…"
                  : "Submit PA request"
                : "Next"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
