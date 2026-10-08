"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Ban, CheckCircle2 } from "lucide-react";
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
import { MatchedBenefitSummary } from "@/components/matched-benefit-summary";
import { PaQuestionnaire } from "@/components/questionnaire/pa-questionnaire";
import { SobGate } from "@/components/sob-gate";
import { CaseClosed } from "@/components/case-closed";
import type { IntakeRunResult } from "@/app/actions";
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
function getMaxStep(hasPolicy: boolean, decision: CaseDecision): number {
  if (!hasPolicy) return 0; // nothing matched — stuck on that message
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
  /** Skips the seeded-policy cost-share/criteria card at the decision
   *  step, showing just a compact Proceed/Decline bar instead — for
   *  contexts (CaseDetail) that already show a real extracted Benefit
   *  Summary elsewhere on the page. */
  hideBenefitsSummary?: boolean;
}) {
  const { intake, eligibility, policyMatch } = run;
  const policy = policyMatch.policy;

  const [viewStep, setViewStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const maxStep = getMaxStep(!!policy, decision);
  const atGateAwaitingDecision = viewStep === 0 && decision === "pending" && !!policy;

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

  return (
    <div className="space-y-6">
      <div
        key={viewStep}
        className={cn(
          "animate-in fade-in-0 duration-300 ease-out",
          direction === "forward" ? "slide-in-from-right-2" : "slide-in-from-left-2"
        )}
      >
      {viewStep === 0 && policy && hideBenefitsSummary && (
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

      {viewStep === 0 && !policy && (
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

      {viewStep === 1 && policy && decision === "declined" && (
        <CaseClosed policy={policy} reason={declineReason} closedAt={closedAt ?? new Date().toISOString()} />
      )}

      {viewStep === 1 && policy && decision === "proceeded" && (
        <PaQuestionnaire answers={answers} onAnswersChange={onAnswersChange} />
      )}

      {viewStep === 2 && policy && decision === "proceeded" && (
        <Alert className="border-accent-green/30 bg-accent-green/10 *:[svg]:text-accent-green">
          <CheckCircle2 />
          <AlertTitle>Proceeded</AlertTitle>
          <AlertDescription>
            This request has moved forward for {policy.drug} under {policy.payer}, and the provider
            questionnaire responses are on file. This is <strong>not</strong> an approval decision
            &mdash; it is a record that the requesting office chose to proceed after reviewing the
            benefit summary earlier in this flow.
          </AlertDescription>
        </Alert>
      )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goBack} disabled={viewStep === 0}>
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
