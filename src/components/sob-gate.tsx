"use client";

import { useState } from "react";
import { ArrowRight, Ban, ClipboardCheck } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { IconChip } from "@/components/icon-chip";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import type { CaseDecision, CriterionResult, EligibilityResult, PolicyDocument } from "@/lib/policy/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function formatMoney(value: number | null) {
  return value === null ? "Not returned by 271" : currency.format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "Not returned by 271" : `${value}%`;
}

/** Read-only version of a criterion row — no answer inputs, since the SOB
 *  screen is a review gate that sits before any question is sent back to
 *  the requesting provider. */
function CriterionStatusRow({ result }: { result: CriterionResult }) {
  return (
    <div className="flex items-start justify-between gap-3 py-4 first:pt-0 last:pb-0">
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
  );
}

export function SobGate({
  policy,
  eligibility,
  results,
  decision,
  onProceed,
  onDecline,
}: {
  policy: PolicyDocument;
  eligibility: EligibilityResult;
  results: CriterionResult[];
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <IconChip icon={ClipboardCheck} color="green" />
          Summary of Benefits
        </CardTitle>
        <CardDescription>
          Cost and benefit data plus the full coverage-criteria list, together &mdash; the
          decision point where the requesting office can stop before any question goes back to
          the provider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <p>
            <span className="text-muted-foreground">Deductible remaining:</span>{" "}
            {formatMoney(eligibility.deductibleRemaining)}
          </p>
          <p>
            <span className="text-muted-foreground">Coinsurance:</span>{" "}
            {formatPercent(eligibility.coinsurancePercent)}
          </p>
          <p>
            <span className="text-muted-foreground">Out-of-pocket remaining:</span>{" "}
            {formatMoney(eligibility.oopRemaining)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {policy.drug} is covered under this {eligibility.lineOfBusiness} plan.
          </span>
          <Badge variant="outline" className="border-transparent bg-accent-blue/15 text-accent-blue">
            {policy.policyType} required
          </Badge>
        </div>

        <Separator />

        <div>
          <p className="text-sm font-medium">Does the member meet all of the following criteria?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            All {results.length} criteria below are required (joined by AND) unless noted
            otherwise.
          </p>
          <div className="mt-1 divide-y">
            {results.map((result) => (
              <CriterionStatusRow key={result.id} result={result} />
            ))}
          </div>
        </div>

        {policy.notApplicable.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Also checked against this policy:
              </p>
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {policy.notApplicable.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-3">
        {decision === "pending" ? (
          <>
            <p className="text-xs text-muted-foreground">
              Review the above, then decide whether to send the remaining questions to the
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
                    The requesting provider won&apos;t be sent any follow-up questions, and this
                    request won&apos;t move forward. You can note why below, or leave it blank.
                  </AlertDialogDescription>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="min-h-16"
                  />
                  <AlertDialogFooter>
                    <AlertDialogClose render={<Button variant="outline" size="sm" />}>
                      Cancel
                    </AlertDialogClose>
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
          </>
        ) : (
          <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
            {decision === "proceeded"
              ? "Decision: proceeded to provider questions"
              : "Decision: declined — case closed"}
          </Badge>
        )}
      </CardFooter>
    </Card>
  );
}
