"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck2, Loader2 } from "lucide-react";
import { findMatchingExtractedDraft } from "@/app/enroll/actions";
import { SobDocument } from "@/components/sob-document";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ExtractedDraft } from "@/lib/policy/extraction-store";
import { buildSobViewModel } from "@/lib/policy/sob-view-model";

/**
 * Final wizard step — checks the Document Library for an extracted policy
 * draft covering the same payer + drug and, when found, shows its full
 * six-section Benefit Summary (the same one /documents/extract renders)
 * right here. Purely informational: there's nothing to fill in, so this
 * step never blocks "Submit PA request" whether a match is found or not.
 */
export function StepBenefitSummary({ payer, drug }: { payer: string; drug: string }) {
  const [state, setState] = useState<"loading" | "found" | "not-found">("loading");
  const [draft, setDraft] = useState<ExtractedDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    findMatchingExtractedDraft(payer, drug).then((result) => {
      if (cancelled) return;
      setDraft(result);
      setState(result ? "found" : "not-found");
    });
    return () => {
      cancelled = true;
    };
  }, [payer, drug]);

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Checking the Document Library for a matching extracted policy…
      </div>
    );
  }

  if (state === "not-found" || !draft) {
    return (
      <Alert variant="info">
        <AlertTitle>No extracted policy on file yet</AlertTitle>
        <AlertDescription>
          Nothing in the Document Library matches &ldquo;{drug || "this drug"}&rdquo; for{" "}
          {payer || "this payer"} yet. You can still submit — or{" "}
          <Link href="/documents/extract" className="underline underline-offset-2">
            extract one from a policy PDF
          </Link>{" "}
          first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Alert variant="info">
        <AlertTitle className="flex items-center gap-1.5">
          <FileCheck2 className="size-4" /> Matched an extracted policy
        </AlertTitle>
        <AlertDescription>
          Found a Document Library draft for {draft.payer} / {draft.drugLabel} —{" "}
          <Link href={`/documents/extract/${draft.id}/summary`} className="underline underline-offset-2">
            open the full page
          </Link>
          .
        </AlertDescription>
      </Alert>
      <div className="max-h-[32rem] overflow-y-auto rounded-lg border bg-white">
        <SobDocument model={buildSobViewModel(draft.data)} />
      </div>
    </div>
  );
}
