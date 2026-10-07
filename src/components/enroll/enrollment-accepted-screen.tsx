"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EnrollmentAcceptedScreen({
  caseNumber,
  onBack,
  onEdit,
}: {
  caseNumber: string;
  onBack: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-green/15">
        <CheckCircle2 className="size-6 text-accent-green" />
      </span>
      <p className="text-base font-semibold text-accent-green">
        Enrollment Accepted &mdash; Case {caseNumber} Created
      </p>
      <p className="text-sm text-muted-foreground">Please check the Case Status tab for progress.</p>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={onEdit}>
          Edit this enrollment
        </Button>
        <Button onClick={onBack}>Back to Enrollment List</Button>
      </div>
    </div>
  );
}
