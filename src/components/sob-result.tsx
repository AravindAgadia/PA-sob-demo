"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  ListChecks,
  type LucideIcon,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChip, type IconChipColor } from "@/components/icon-chip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { SobGate } from "@/components/sob-gate";
import { CaseClosed } from "@/components/case-closed";
import type { IntakeRunResult } from "@/app/actions";
import type {
  CaseDecision,
  CriterionOption,
  CriterionResult,
  FollowUpAnswers,
  PolicyMatchMethod,
} from "@/lib/policy/types";

function MatchMethodBadge({ method, confidence }: { method: PolicyMatchMethod; confidence?: number }) {
  if (method === "none") return null;
  const label =
    method === "exact"
      ? "Exact match"
      : method === "partial"
        ? "Partial match (different line of business)"
        : method === "keyword"
          ? "Keyword match"
          : `AI match · ${Math.round((confidence ?? 0) * 100)}% similar`;
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent text-[10px]",
        method === "exact" ? "bg-accent-green/15 text-accent-green" : "bg-accent-orange/15 text-accent-orange"
      )}
    >
      {label}
    </Badge>
  );
}

function CardIconTitle({
  icon,
  color,
  children,
}: {
  icon: LucideIcon;
  color: IconChipColor;
  children: ReactNode;
}) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <IconChip icon={icon} color={color} />
      {children}
    </CardTitle>
  );
}

function AttestationSingleInput({
  options,
  value,
  onChange,
}: {
  options: CriterionOption[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value ?? null}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
    >
      <SelectTrigger className="w-full max-w-sm">
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AttestationMultiInput({
  options,
  onChange,
}: {
  options: CriterionOption[];
  onChange: (value: string[]) => void;
}) {
  // Local draft state only — this component unmounts the instant the parent
  // records an answer (CriterionRow stops rendering it once the criterion
  // leaves "needs-info"), so checkboxes must NOT call onChange on every
  // click: that would commit after the first check and hide the rest of
  // the group before a second finding could be selected.
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(optionValue: string) {
    setSelected((prev) =>
      prev.includes(optionValue) ? prev.filter((v) => v !== optionValue) : [...prev, optionValue]
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange(selected)}>
        Confirm selections
      </Button>
    </div>
  );
}

function CriterionRow({
  result,
  answers,
  onAnswersChange,
}: {
  result: CriterionResult;
  answers: FollowUpAnswers;
  onAnswersChange: (next: FollowUpAnswers) => void;
}) {
  const spec = result.evaluator;

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            Criteria #{result.number} &middot; {result.label}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{result.detail}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={result.status} />
          {!result.systemVerifiable && (
            <Badge variant="secondary" className="text-[10px]">
              Attestation / manual
            </Badge>
          )}
        </div>
      </div>

      {result.status === "needs-info" && spec.kind === "attestation-single" && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">{spec.question}</p>
          <AttestationSingleInput
            options={spec.options}
            value={answers[result.id] as string | undefined}
            onChange={(v) => onAnswersChange({ ...answers, [result.id]: v })}
          />
        </div>
      )}

      {result.status === "needs-info" && spec.kind === "attestation-multi" && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">{spec.question}</p>
          <AttestationMultiInput
            options={spec.options}
            onChange={(v) => onAnswersChange({ ...answers, [result.id]: v })}
          />
        </div>
      )}
    </div>
  );
}

/** Highest screen index reachable given how far this request has actually
 *  progressed — navigation can never jump past what the workflow has
 *  resolved yet. */
function getMaxStep(hasPolicy: boolean, decision: CaseDecision): number {
  if (!hasPolicy) return 2; // eligibility, policy match, prescriber — nothing to gate on
  if (decision === "pending") return 3; // ...through the SOB decision gate
  if (decision === "declined") return 4; // ...through the case-closed screen
  return 5; // proceeded: ...through the final complete-picture screen
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
}) {
  const { eligibility, npiLookup, policyMatch } = run;
  const policy = policyMatch.policy;
  const allResolved = results.length > 0 && results.every((r) => r.status !== "needs-info");
  const anyNotMet = results.some((r) => r.status === "not-met");

  const [viewStep, setViewStep] = useState(0);
  const maxStep = getMaxStep(!!policy, decision);
  const atGateAwaitingDecision = viewStep === 3 && decision === "pending" && !!policy;

  function handleProceed() {
    onProceed();
    setViewStep(4);
  }

  function handleDecline(reason: string) {
    onDecline(reason);
    setViewStep(4);
  }

  return (
    <div className="space-y-6">
      {viewStep === 0 && (
        <Card>
          <CardHeader>
            <CardIconTitle icon={ShieldCheck} color="blue">
              271 eligibility check
            </CardIconTitle>
            <CardDescription>Simulated eligibility response (mock adapter).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Coverage:</span>{" "}
              {eligibility.active ? "Active" : "Inactive"}
            </p>
            <p>
              <span className="text-muted-foreground">Payer:</span> {eligibility.payer}
            </p>
            <p>
              <span className="text-muted-foreground">Line of business:</span>{" "}
              {eligibility.lineOfBusiness}
            </p>
            <p>
              <span className="text-muted-foreground">Plan type:</span> {eligibility.planType}
            </p>
          </CardContent>
        </Card>
      )}

      {viewStep === 1 && (
        <Card>
          <CardHeader>
            <CardIconTitle icon={FileSearch} color="purple">
              Policy match
            </CardIconTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              Matched on: {policyMatch.matchedOn}
              <MatchMethodBadge method={policyMatch.matchMethod} confidence={policyMatch.matchConfidence} />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {policyMatch.mismatchWarning && (
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
                <AlertDescription>{policyMatch.mismatchWarning}</AlertDescription>
              </Alert>
            )}
            {policy && (
              <>
                <p>
                  <span className="text-muted-foreground">Source:</span> {policy.payer}{" "}
                  &ldquo;{policy.drug} &mdash; Pharmacy Coverage Policy&rdquo; ({policy.lineOfBusiness})
                </p>
                <p>
                  <span className="text-muted-foreground">Effective / review date:</span>{" "}
                  {policy.effectiveDate} / {policy.reviewDate}
                </p>
                <p>
                  <span className="text-muted-foreground">Approval duration:</span>{" "}
                  Initial: {policy.approvalDuration.initial} &middot; Renewal:{" "}
                  {policy.approvalDuration.renewal}
                </p>
                {policy.sourceNote && (
                  <Alert>
                    <AlertTitle>Ingestion note</AlertTitle>
                    <AlertDescription>{policy.sourceNote}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {viewStep === 2 && (
        <Card>
          <CardHeader>
            <CardIconTitle icon={Stethoscope} color="pink">
              Prescriber verification
            </CardIconTitle>
            <CardDescription>NPPES NPI Registry &mdash; called live, not mocked.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {npiLookup.status === "resolved" ? (
              <>
                <p>
                  <span className="text-muted-foreground">NPI:</span> {npiLookup.npi}
                </p>
                <p>
                  <span className="text-muted-foreground">Provider:</span>{" "}
                  {npiLookup.providerName ?? "—"}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Taxonomy:</span>{" "}
                  {npiLookup.taxonomyDescription} ({npiLookup.taxonomyCode})
                </p>
              </>
            ) : (
              <p className="text-muted-foreground sm:col-span-2">
                {npiLookup.status === "invalid-format" &&
                  "NPI must be 10 digits — nothing was looked up."}
                {npiLookup.status === "not-found" &&
                  `No NPPES record found for NPI ${npiLookup.npi}.`}
                {npiLookup.status === "lookup-failed" &&
                  "Couldn't reach the NPPES registry just now. Try submitting again."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {viewStep === 3 && policy && (
        <SobGate
          policy={policy}
          eligibility={eligibility}
          results={results}
          decision={decision}
          onProceed={handleProceed}
          onDecline={handleDecline}
        />
      )}

      {viewStep === 4 && policy && decision === "declined" && (
        <CaseClosed policy={policy} reason={declineReason} closedAt={closedAt ?? new Date().toISOString()} />
      )}

      {viewStep === 4 && policy && decision === "proceeded" && (
        <Card>
          <CardHeader>
            <CardIconTitle icon={ListChecks} color="green">
              Provider questions
            </CardIconTitle>
            <CardDescription>
              Unresolved criteria, kicked back to the requesting provider for a response.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {results.map((result) => (
              <CriterionRow
                key={result.id}
                result={result}
                answers={answers}
                onAnswersChange={onAnswersChange}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {viewStep === 5 && policy && decision === "proceeded" && (
        <Alert className="border-accent-green/30 bg-accent-green/10 *:[svg]:text-accent-green">
          <CheckCircle2 />
          <AlertTitle>Complete picture</AlertTitle>
          <AlertDescription>
            {allResolved ? (
              <>
                All {results.length} criteria have a status. This is <strong>not</strong> an
                approval decision &mdash; it is a surfaced view of what {policy?.payer} requires
                for {policy?.drug} under this plan, and what is known so far.{" "}
                {anyNotMet
                  ? "At least one criterion was not met based on the information captured."
                  : "All checkable criteria are satisfied; the requesting office can decide whether to proceed with submission."}
              </>
            ) : (
              "Available once every criterion on the Provider questions screen has a status."
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setViewStep((s) => Math.max(0, s - 1))}
          disabled={viewStep === 0}
        >
          <ArrowLeft /> Back
        </Button>
        {!atGateAwaitingDecision && (
          <Button
            type="button"
            onClick={() => setViewStep((s) => Math.min(maxStep, s + 1))}
            disabled={viewStep >= maxStep}
          >
            Next <ArrowRight />
          </Button>
        )}
      </div>

      <Separator />

      <Button variant="outline" onClick={onReset}>
        Start a new request
      </Button>
    </div>
  );
}
