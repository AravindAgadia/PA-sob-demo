"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseSummary } from "@/lib/case-store";

const DECISION_VARIANT: Record<CaseSummary["decision"], "outline" | "secondary" | "destructive"> = {
  pending: "outline",
  proceeded: "secondary",
  declined: "destructive",
};

export function CaseList({
  cases,
  onOpen,
}: {
  cases: CaseSummary[];
  onOpen: (caseNumber: string) => void;
}) {
  if (cases.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No cases yet — submitting an enrollment creates one.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {cases.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onOpen(c.caseNumber)}
          className="flex w-full flex-wrap items-center gap-2 rounded-lg border p-3 text-left text-sm hover:bg-muted"
        >
          <span className="font-mono text-xs text-muted-foreground">{c.caseNumber}</span>
          <span className="font-medium">{c.patientName || "Unnamed patient"}</span>
          {c.payer && <Badge variant="secondary">{c.payer}</Badge>}
          {c.drugLabel && <span className="text-muted-foreground">{c.drugLabel}</span>}
          <Badge variant={DECISION_VARIANT[c.decision]} className="text-[10px]">
            {c.decision}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(c.createdAt).toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  );
}
