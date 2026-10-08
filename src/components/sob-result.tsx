"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Ban, Clock } from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CaseSummaryCard } from "@/components/cases/case-summary-card";
import { MatchedBenefitSummary } from "@/components/matched-benefit-summary";
import { PaQuestionnaire } from "@/components/questionnaire/pa-questionnaire";
import { SobGate } from "@/components/sob-gate";
import { CaseClosed } from "@/components/case-closed";
import type { IntakeRunResult } from "@/app/actions";
import type { EnrollmentData } from "@/components/enroll/types";
import type { CaseDecision, CriterionResult, FollowUpAnswers } from "@/lib/policy/types";

/** The decision point without the seeded-policy cost-share/criteria card
 *  — used in place of `SobGate` when the real, extracted Benefit Summary
 *  ("Drug Policy Reference", rendered just above this) already covers
 *  that ground, so the two don't show redundant/conflicting coverage
 *  detail side by side. Same Proceed/Decline behavior as SobGate's own
 *  footer, just without the card body above it. */
function CompactDecisionBar({
  decision,
  onProceed,
  onDecline,
}: {
  decision: CaseDecision;
  onProceed: () => void;
  onDecline: (reason: string) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");

  function confirmDecline() {
    onDecline(reason.trim());
    setDialogOpen(false);
  }

  if (decision !== "pending") {
    return (
      <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
        {decision === "proceeded" ? "Decision: proceeded to provider questions" : "Decision: declined — case closed"}
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Review the matched policy above, then decide whether to send the remaining questions to the
        requesting provider.
      </p>
      <div className="flex gap-2">
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
            <Ban />
            Decline &mdash; don&apos;t proceed
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Close this case without proceeding?</AlertDialogTitle>
            <AlertDialogDescription>
              The requesting provider won&apos;t be sent any follow-up questions, and this request
              won&apos;t move forward. You can note why below, or leave it blank.
            </AlertDialogDescription>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="min-h-16"
            />
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" size="sm" />}>Cancel</AlertDialogClose>
              <Button variant="destructive" size="sm" onClick={confirmDecline}>
                Close case
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button size="sm" onClick={onProceed}>
          Proceed to provider questions
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

/** Highest screen index reachable given how far this request has actually
 *  progressed — navigation can never jump past what the workflow has
 *  resolved yet. Goes straight to the Benefit Summary (no separate
 *  eligibility/policy-match/prescriber click-through screens); that data
 *  still feeds the evaluator, it's just not shown as its own stop. */
function getMaxStep(flowAvailable: boolean, decision: CaseDecision): number {
  if (!flowAvailable) return 0; // nothing to show — stuck on that message
  if (decision === "pending") return 0; // stuck on the Benefit Summary gate
  if (decision === "declined") return 1; // ...through the case-closed screen
  return 2; // proceeded: ...through provider questions and the completion screen
}

export function SobResult({
  run,
  results,
  answers,
  onAnswersChange,
  decision,
  onProceed,
  onDecline,
  declineReason,
  closedAt,
  onReset,
  resetLabel = "Start a new request",
  hideBenefitsSummary = false,
  enrollmentData = null,
}: {
  run: IntakeRunResult;
  results: CriterionResult[];
  answers: FollowUpAnswers;
  onAnswersChange: (next: FollowUpAnswers) => void;
  decision: CaseDecision;
  onProceed: () => void;
  onDecline: (reason: string) => void;
  declineReason: string | undefined;
  closedAt: string | null;
  onReset: () => void;
  resetLabel?: string;
  /** Full enrollment wizard data for the Complete screen's Case Summary —
   *  richer than `run.intake`, which only carries the fields the matching
   *  engine needs. Null when the originating enrollment can't be found. */
  enrollmentData?: EnrollmentData | null;
  /** Skips the seeded-policy cost-share/criteria card at the decision
   *  step, showing just a compact Proceed/Decline bar instead — for
   *  contexts (CaseDetail) that already show a real extracted Benefit
   *  Summary elsewhere on the page. */
  hideBenefitsSummary?: boolean;
}) {
  const { intake, eligibility, policyMatch } = run;
  const policy = policyMatch.policy;
  // The old seeded-policy match (`policy`) only ever covers the one
  // seeded Tepezza policy — every other drug legitimately has no match
  // there. In hideBenefitsSummary mode the real reference is the
  // Document Library match inside MatchedBenefitSummary instead (which
  // handles its own "not found" case), so the flow must not dead-end
  // just because the legacy seeded policy didn't match.
  const flowAvailable = hideBenefitsSummary || !!policy;

  // Opens wherever this case already stood when it was last left — a
  // proceeded case (which can never go back to Questions, see the Back
  // button below) reopens straight on the Complete screen rather than
  // resetting to the Benefits gate every visit.
  const [viewStep, setViewStep] = useState(() => getMaxStep(flowAvailable, decision));
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const maxStep = getMaxStep(flowAvailable, decision);
  const atGateAwaitingDecision = viewStep === 0 && decision === "pending" && flowAvailable;

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setDirection("backward");
    setViewStep((s) => Math.max(0, s - 1));
    scrollToTop();
  }

  function goNext() {
    setDirection("forward");
    setViewStep((s) => Math.min(maxStep, s + 1));
    scrollToTop();
  }

  function handleProceed() {
    onProceed();
    setDirection("forward");
    setViewStep(1);
    scrollToTop();
  }

  function handleDecline(reason: string) {
    onDecline(reason);
    setDirection("forward");
    setViewStep(1);
    scrollToTop();
  }

  function handleQuestionnaireSubmit() {
    setDirection("forward");
    setViewStep(2);
    scrollToTop();
  }

  return (
    <div className="space-y-6">
      <div
        key={viewStep}
        className={cn(
          "animate-in fade-in-0 duration-300 ease-out",
          direction === "forward" ? "slide-in-from-right-2" : "slide-in-from-left-2"
        )}
      >
      {viewStep === 0 && flowAvailable && hideBenefitsSummary && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">Drug Policy Reference</h2>
            <MatchedBenefitSummary payer={intake.payer} drug={intake.drug} intake={intake} eligibility={eligibility} />
          </div>
          <CompactDecisionBar decision={decision} onProceed={handleProceed} onDecline={handleDecline} />
        </div>
      )}

      {viewStep === 0 && policy && !hideBenefitsSummary && (
        <SobGate
          policy={policy}
          eligibility={eligibility}
          results={results}
          decision={decision}
          onProceed={handleProceed}
          onDecline={handleDecline}
        />
      )}

      {viewStep === 0 && !flowAvailable && (
        <Alert
          variant={policyMatch.matchMethod === "none" ? "destructive" : "default"}
          className={
            policyMatch.matchMethod === "keyword" || policyMatch.matchMethod === "semantic"
              ? "border-accent-orange/30 bg-accent-orange/10 *:[svg]:text-accent-orange"
              : undefined
          }
        >
          <AlertTitle>
            {policyMatch.matchMethod === "none"
              ? "No policy document found"
              : policyMatch.matchMethod === "semantic"
                ? "AI-suggested match — verify before relying on it"
                : policyMatch.matchMethod === "keyword"
                  ? "Keyword-suggested match — verify before relying on it"
                  : "Line-of-business mismatch"}
          </AlertTitle>
          <AlertDescription>
            {policyMatch.mismatchWarning ?? `Nothing matched "${policyMatch.matchedOn}".`}
          </AlertDescription>
        </Alert>
      )}

      {viewStep === 1 && flowAvailable && decision === "declined" && (
        <CaseClosed
          drug={intake.drug}
          payer={intake.payer}
          reason={declineReason}
          closedAt={closedAt ?? new Date().toISOString()}
        />
      )}

      {viewStep === 1 && flowAvailable && decision === "proceeded" && (
        <PaQuestionnaire answers={answers} onAnswersChange={onAnswersChange} onSubmit={handleQuestionnaireSubmit} />
      )}

      {viewStep === 2 && flowAvailable && decision === "proceeded" && (
        <div className="space-y-4">
          <div className="shadow-soft overflow-hidden rounded-2xl border bg-gradient-to-br from-accent-orange/10 via-card to-card">
            <div className="flex flex-wrap items-center gap-4 p-5">
              <span className="shadow-soft flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-orange to-accent-orange/70 text-white">
                <Clock className="size-6" />
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-semibold tracking-wide text-accent-orange uppercase">
                  Decision pending
                </p>
                <h3 className="text-lg font-semibold">Awaiting review from {intake.payer}</h3>
                <p className="text-sm text-muted-foreground">
                  The request and provider questionnaire have been submitted. This is{" "}
                  <strong>not</strong> an approval decision.
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 border-accent-orange/40 text-accent-orange">
                Review pending with payer
              </Badge>
            </div>
          </div>
          {enrollmentData ? (
            <CaseSummaryCard data={enrollmentData} />
          ) : (
            <Alert variant="info">
              <AlertTitle>Case summary unavailable</AlertTitle>
              <AlertDescription>
                The originating enrollment record couldn&apos;t be found, so the full submission
                details can&apos;t be recapped here.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* Disabled at viewStep 2 (Complete) too — once the questionnaire is
            submitted there's no going back to re-answer it; demo-only
            restriction, not backed by any persisted "locked" state. */}
        <Button type="button" variant="outline" onClick={goBack} disabled={viewStep === 0 || viewStep === 2}>
          <ArrowLeft /> Back
        </Button>
        {!atGateAwaitingDecision && (
          <Button type="button" onClick={goNext} disabled={viewStep >= maxStep}>
            Next <ArrowRight />
          </Button>
        )}
      </div>

      <Separator />

      <Button variant="outline" onClick={onReset}>
        {resetLabel}
      </Button>
    </div>
  );
}
