"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import type { IntakeRunResult } from "@/app/actions";
import type { CriterionResult, FollowUpAnswers } from "@/lib/policy/types";

const selectClassName =
  "border-input flex h-9 w-full max-w-sm rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function ThyroidStatusInput({
  value,
  onChange,
}: {
  value: FollowUpAnswers["thyroidStatus"];
  onChange: (value: FollowUpAnswers["thyroidStatus"]) => void;
}) {
  return (
    <select
      className={selectClassName}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as typeof value)}
    >
      <option value="" disabled>
        Select thyroid status&hellip;
      </option>
      <option value="euthyroid">Euthyroid</option>
      <option value="being-treated">Currently receiving treatment to correct levels</option>
      <option value="not-controlled">Neither confirmed</option>
    </select>
  );
}

function PriorTherapyInput({
  value,
  onChange,
}: {
  value: FollowUpAnswers["priorTherapyAttested"];
  onChange: (value: FollowUpAnswers["priorTherapyAttested"]) => void;
}) {
  return (
    <select
      className={selectClassName}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as typeof value)}
    >
      <option value="" disabled>
        Select prescriber attestation&hellip;
      </option>
      <option value="attested-no-prior">
        Prescriber attests: no prior course of therapy
      </option>
      <option value="has-prior-therapy">Cannot attest / member has had prior therapy</option>
    </select>
  );
}

function SeverityFindingsInput({
  subFindings,
  value,
  onChange,
}: {
  subFindings: { id: string; label: string }[];
  value: string[] | undefined;
  onChange: (value: string[]) => void;
}) {
  const selected = value ?? [];
  const answered = value !== undefined;

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((f) => f !== id)
      : [...selected, id];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-2">
        {subFindings.map((finding) => (
          <label key={finding.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(finding.id)}
              onChange={() => toggle(finding.id)}
              className="size-4 rounded border-input"
            />
            {finding.label}
          </label>
        ))}
      </div>
      {!answered && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(selected)}>
          Confirm severity findings
        </Button>
      )}
    </div>
  );
}

function CriterionRow({
  result,
  subFindings,
  answers,
  onAnswersChange,
}: {
  result: CriterionResult;
  subFindings?: { id: string; label: string }[];
  answers: FollowUpAnswers;
  onAnswersChange: (next: FollowUpAnswers) => void;
}) {
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

      {result.status === "needs-info" && (
        <div className="mt-3">
          {result.id === "thyroid-status" && (
            <ThyroidStatusInput
              value={answers.thyroidStatus}
              onChange={(v) => onAnswersChange({ ...answers, thyroidStatus: v })}
            />
          )}
          {result.id === "prior-therapy" && (
            <PriorTherapyInput
              value={answers.priorTherapyAttested}
              onChange={(v) => onAnswersChange({ ...answers, priorTherapyAttested: v })}
            />
          )}
          {result.id === "disease-severity" && subFindings && (
            <SeverityFindingsInput
              subFindings={subFindings}
              value={answers.severityFindings}
              onChange={(v) => onAnswersChange({ ...answers, severityFindings: v })}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function SobResult({
  run,
  results,
  answers,
  onAnswersChange,
  onReset,
}: {
  run: IntakeRunResult;
  results: CriterionResult[];
  answers: FollowUpAnswers;
  onAnswersChange: (next: FollowUpAnswers) => void;
  onReset: () => void;
}) {
  const { eligibility, npiLookup, policyMatch } = run;
  const policy = policyMatch.policy;
  const allResolved = results.length > 0 && results.every((r) => r.status !== "needs-info");
  const anyNotMet = results.some((r) => r.status === "not-met");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Step 2 &middot; 271 eligibility check</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Step 3 &middot; Policy match</CardTitle>
          <CardDescription>Matched on: {policyMatch.matchedOn}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {policyMatch.mismatchWarning && (
            <Alert variant="destructive">
              <AlertTitle>Line-of-business mismatch</AlertTitle>
              <AlertDescription>{policyMatch.mismatchWarning}</AlertDescription>
            </Alert>
          )}
          {policy ? (
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
              <Alert>
                <AlertTitle>Ingestion note</AlertTitle>
                <AlertDescription>{policy.sourceNote}</AlertDescription>
              </Alert>
            </>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>No policy document found</AlertTitle>
              <AlertDescription>
                No ingested policy matches this drug/payer combination.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {npiLookup.found && (
        <Card>
          <CardHeader>
            <CardTitle>Live NPI lookup</CardTitle>
            <CardDescription>NPPES NPI Registry &mdash; called live, not mocked.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
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
          </CardContent>
        </Card>
      )}

      {policy && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4&ndash;6 &middot; Summary of Benefits</CardTitle>
            <CardDescription>
              Does the member meet all of the following criteria? Each item below is
              surfaced with what the system knows &mdash; this is not an approval or
              denial decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {results.map((result) => (
              <CriterionRow
                key={result.id}
                result={result}
                subFindings={policy.criteria.find((c) => c.id === result.id)?.subFindings}
                answers={answers}
                onAnswersChange={onAnswersChange}
              />
            ))}
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Also checked against this policy:
            </p>
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {policy.notApplicable.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </CardFooter>
        </Card>
      )}

      {allResolved && (
        <Alert>
          <AlertTitle>Step 7 &middot; Complete picture</AlertTitle>
          <AlertDescription>
            All 5 criteria have a status. This is <strong>not</strong> an approval
            decision &mdash; it is a surfaced view of what {policyMatch.policy?.payer}{" "}
            requires for {policyMatch.policy?.drug} under this plan, and what is known
            so far. {anyNotMet
              ? "At least one criterion was not met based on the information captured."
              : "All checkable criteria are satisfied; the requesting office can decide whether to proceed with submission."}
          </AlertDescription>
        </Alert>
      )}

      <Separator />

      <Button variant="outline" onClick={onReset}>
        Start a new request
      </Button>
    </div>
  );
}
