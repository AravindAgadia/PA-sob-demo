"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { declineCase, proceedCase } from "@/app/cases/actions";
import type { EnrollmentData } from "@/components/enroll/types";
import { PA_QUESTIONS } from "@/components/questionnaire/pa-questions";
import { Button } from "@/components/ui/button";
import { SobResult } from "@/components/sob-result";
import { Stepper, type StepperStep } from "@/components/stepper";
import { evaluatePolicy } from "@/lib/policy/evaluator";
import type { CaseRecord } from "@/lib/case-store";
import type { CaseDecision, FollowUpAnswers } from "@/lib/policy/types";

/**
 * Adapts a persisted CaseRecord into the same props shape useIntakeRun
 * used to derive in-memory — `results` is still always recomputed from
 * the frozen policy snapshot + live answers. Questionnaire answers are
 * local-only (never persisted) until the questionnaire is submitted, at
 * which point the Complete screen recaps the case instead of saving
 * individual field answers anywhere.
 */
export function CaseDetail({
  initialCase,
  enrollmentData,
}: {
  initialCase: CaseRecord;
  enrollmentData: EnrollmentData | null;
}) {
  const router = useRouter();
  const [caseRecord, setCaseRecord] = useState(initialCase);
  // Always starts blank, ignoring initialCase.answers — questionnaire
  // answers are never persisted, so a stale DB value from before that
  // (or from a prior visit) must never pre-fill the form on open.
  const [answers, setAnswers] = useState<FollowUpAnswers>({});
  const [decision, setDecision] = useState<CaseDecision>(initialCase.decision);

  const { runData } = caseRecord;
  const policy = runData.policyMatch.policy;

  const results = useMemo(() => {
    if (!policy) return [];
    return evaluatePolicy(policy.criteria, {
      intake: runData.intake,
      eligibility: runData.eligibility,
      npiLookup: runData.npiLookup,
      answers,
    });
  }, [policy, runData, answers]);

  async function handleProceed() {
    setDecision("proceeded");
    const updated = await proceedCase(caseRecord.caseNumber);
    if (updated) setCaseRecord(updated);
    router.refresh();
  }

  async function handleDecline(reason: string) {
    setDecision("declined");
    const updated = await declineCase(caseRecord.caseNumber, reason);
    if (updated) setCaseRecord(updated);
    router.refresh();
  }

  function handleBack() {
    router.push("/cases");
  }

  const allAnswered = PA_QUESTIONS.every((q) => {
    const v = answers[q.id];
    return typeof v === "string" && v.trim().length > 0;
  });
  const steps: StepperStep[] = [
    { label: "Submit", status: "complete", color: "orange" },
    {
      label: "Benefits",
      status: decision === "pending" ? "current" : "complete",
      color: "green",
    },
  ];
  if (decision === "declined") {
    steps.push({ label: "Closed", status: "complete", color: "orange" });
  } else {
    steps.push({
      label: "Questions",
      status: decision === "pending" ? "upcoming" : allAnswered ? "complete" : "current",
      color: "green",
    });
    steps.push({
      label: "Complete",
      status: decision === "proceeded" && allAnswered ? "current" : "upcoming",
      color: "green",
    });
  }

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
        <ArrowLeft /> Back to case list
      </Button>
      <div className="overflow-x-auto rounded-lg border bg-card px-4 py-3">
        <Stepper steps={steps} />
      </div>

      <SobResult
        run={{
          intake: runData.intake,
          eligibility: runData.eligibility,
          npiLookup: runData.npiLookup,
          policyMatch: runData.policyMatch,
          results,
        }}
        results={results}
        answers={answers}
        onAnswersChange={setAnswers}
        decision={decision}
        onProceed={handleProceed}
        onDecline={handleDecline}
        declineReason={caseRecord.declineReason ?? undefined}
        closedAt={caseRecord.closedAt}
        onReset={handleBack}
        resetLabel="Back to case list"
        hideBenefitsSummary
        enrollmentData={enrollmentData}
      />
    </div>
  );
}
