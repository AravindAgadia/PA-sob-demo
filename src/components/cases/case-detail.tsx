"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { answerCase, declineCase, proceedCase } from "@/app/cases/actions";
import { MatchedBenefitSummary } from "@/components/matched-benefit-summary";
import { Button } from "@/components/ui/button";
import { SobResult } from "@/components/sob-result";
import { Stepper, type StepperStep } from "@/components/stepper";
import { evaluatePolicy } from "@/lib/policy/evaluator";
import type { CaseRecord } from "@/lib/case-store";
import type { CaseDecision, FollowUpAnswers } from "@/lib/policy/types";

/**
 * Adapts a persisted CaseRecord into the same props shape useIntakeRun
 * used to derive in-memory — `results` is still always recomputed from
 * the frozen policy snapshot + live answers, never stored — but every
 * mutation now persists via the case-mutation server actions instead of
 * local-only setState. Reuses SobResult completely unchanged.
 */
export function CaseDetail({ initialCase }: { initialCase: CaseRecord }) {
  const router = useRouter();
  const [caseRecord, setCaseRecord] = useState(initialCase);
  const [answers, setAnswers] = useState<FollowUpAnswers>(initialCase.answers);
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

  function handleAnswersChange(next: FollowUpAnswers) {
    setAnswers(next);
    void answerCase(caseRecord.caseNumber, next);
  }

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

  const allResolved = results.length > 0 && results.every((r) => r.status !== "needs-info");
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
      status: decision === "pending" ? "upcoming" : allResolved ? "complete" : "current",
      color: "green",
    });
    steps.push({
      label: "Complete",
      status: decision === "proceeded" && allResolved ? "current" : "upcoming",
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

      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold">Drug Policy Reference</h2>
        <MatchedBenefitSummary payer={runData.intake.payer} drug={runData.intake.drug} />
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
        onAnswersChange={handleAnswersChange}
        decision={decision}
        onProceed={handleProceed}
        onDecline={handleDecline}
        declineReason={caseRecord.declineReason ?? undefined}
        closedAt={caseRecord.closedAt}
        onReset={handleBack}
        resetLabel="Back to case list"
      />
    </div>
  );
}
