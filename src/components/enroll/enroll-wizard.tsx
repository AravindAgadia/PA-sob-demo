"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { saveDraftEnrollment, submitEnrollment } from "@/app/enroll/actions";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchedBenefitSummary } from "@/components/matched-benefit-summary";
import { Stepper, type StepperStep } from "@/components/stepper";
import type { EnrollmentRecord } from "@/lib/enrollment-store";
import {
  ENROLL_STEPS,
  createInitialEnrollment,
  type EnrollStepId,
  type EnrollmentData,
} from "./types";
import { DraftSavedScreen } from "./draft-saved-screen";
import { EnrollmentAcceptedScreen } from "./enrollment-accepted-screen";
import { StepPayerPatient, getPayerPatientIssues } from "./step-payer-patient";
import { StepPrescriber, getPrescriberIssues } from "./step-prescriber";
import { StepDrugDetails, getDrugDetailsIssues } from "./step-drug-details";
import { StepServicingProvider, getServicingProviderIssues } from "./step-servicing-provider";

export function EnrollWizard({ initialEnrollment }: { initialEnrollment?: EnrollmentRecord }) {
  const router = useRouter();
  const [data, setData] = useState<EnrollmentData>(() => initialEnrollment?.data ?? createInitialEnrollment());
  const [step, setStep] = useState<EnrollStepId>(() => initialEnrollment?.step ?? ENROLL_STEPS[0].id);
  const [enrollmentId, setEnrollmentId] = useState<string | undefined>(initialEnrollment?.id);
  const [draftNumber, setDraftNumber] = useState<string | undefined>(initialEnrollment?.draftNumber);
  const [attemptedNext, setAttemptedNext] = useState<Record<EnrollStepId, boolean>>(
    {} as Record<EnrollStepId, boolean>
  );
  const [isSubmitting, startSubmit] = useTransition();
  const [isSavingDraft, startSavingDraft] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submittedCaseNumber, setSubmittedCaseNumber] = useState<string | null>(null);
  const [savedDraftNumber, setSavedDraftNumber] = useState<string | null>(null);

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

  /** Fire-and-forget draft save on step advance — not on every keystroke.
   *  Captures the returned id/draft number so later saves UPDATE the same
   *  row instead of creating a new one, and returns them directly (rather
   *  than relying on state) since a caller awaiting this needs the fresh
   *  value immediately, before the state update has taken effect. */
  async function persistDraft(targetStep: EnrollStepId): Promise<{ id: string; draftNumber: string }> {
    const saved = await saveDraftEnrollment({ id: enrollmentId, data, step: targetStep });
    setEnrollmentId(saved.id);
    setDraftNumber(saved.draftNumber);
    router.refresh();
    return { id: saved.id, draftNumber: saved.draftNumber };
  }

  function handleNext() {
    if (currentIssues.length > 0) {
      setAttemptedNext((prev) => ({ ...prev, [step]: true }));
      return;
    }
    if (isLastStep) {
      setError(null);
      startSubmit(async () => {
        try {
          const { id } = await persistDraft(step);
          const { caseNumber } = await submitEnrollment(id, data);
          setSubmittedCaseNumber(caseNumber);
        } catch (err) {
          setError(
            err instanceof Error && err.message
              ? err.message
              : "Couldn't submit this enrollment — the eligibility check, NPI lookup, or policy match failed. Try again."
          );
        }
      });
      return;
    }
    const next = ENROLL_STEPS[stepIndex + 1];
    if (next) {
      setStep(next.id);
      void persistDraft(next.id);
    }
  }

  function handleBack() {
    const prev = ENROLL_STEPS[stepIndex - 1];
    if (prev) setStep(prev.id);
  }

  function handleSaveAsDraft() {
    setError(null);
    startSavingDraft(async () => {
      try {
        const { draftNumber: saved } = await persistDraft(step);
        setSavedDraftNumber(saved);
      } catch {
        setError("Couldn't save this draft. Try again.");
      }
    });
  }

  function handleClearForm() {
    setData(createInitialEnrollment());
    setStep(ENROLL_STEPS[0].id);
    setEnrollmentId(undefined);
    setDraftNumber(undefined);
    setAttemptedNext({} as Record<EnrollStepId, boolean>);
    setError(null);
    router.replace("/enrollments/new");
  }

  if (submittedCaseNumber) {
    return (
      <div className="mx-auto max-w-4xl">
        <EnrollmentAcceptedScreen
          caseNumber={submittedCaseNumber}
          onBack={() => router.push("/enrollments")}
        />
      </div>
    );
  }

  if (savedDraftNumber) {
    return (
      <div className="mx-auto max-w-4xl">
        <DraftSavedScreen draftNumber={savedDraftNumber} onBack={() => router.push("/enrollments")} />
      </div>
    );
  }

  const showErrors = !!attemptedNext[step];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          {draftNumber ? draftNumber : "Not saved yet"}
        </span>
        <AlertDialog>
          <AlertDialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
            <RotateCcw /> Clear form
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Clear this enrollment?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything entered on this form will be lost. This can&apos;t be undone.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" size="sm" />}>Cancel</AlertDialogClose>
              <AlertDialogClose
                render={<Button variant="destructive" size="sm" onClick={handleClearForm} />}
              >
                Clear form
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="mb-4 overflow-x-auto rounded-lg border bg-card px-4 py-2.5">
        <Stepper steps={wizardSteps} />
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card size="sm">
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
          {step === "benefit-summary" && (
            <MatchedBenefitSummary payer={data.payerPatient.payer} drug={data.drug.drugDescription} />
          )}
        </CardContent>
        <CardFooter className="flex-col items-start gap-3">
          {showErrors && currentIssues.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>Missing required fields</AlertTitle>
              <AlertDescription>Fill in: {currentIssues.join(", ")}.</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={stepIndex === 0 || isSubmitting || isSavingDraft}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAsDraft}
              disabled={isSubmitting || isSavingDraft}
            >
              {isSavingDraft && <Loader2 className="animate-spin" />}
              Save as Draft
            </Button>
            <Button type="button" onClick={handleNext} disabled={isSubmitting || isSavingDraft}>
              {isLastStep && isSubmitting && <Loader2 className="animate-spin" />}
              {isLastStep ? (isSubmitting ? "Running eligibility, policy match, and NPI lookup…" : "Proceed to PA") : "Next"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
