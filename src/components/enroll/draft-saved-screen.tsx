"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DraftSavedScreen({
  draftNumber,
  onBack,
}: {
  draftNumber: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-blue/15">
        <Save className="size-6 text-accent-blue" />
      </span>
      <p className="text-base font-semibold text-accent-blue">Draft Saved &mdash; {draftNumber}</p>
      <p className="text-sm text-muted-foreground">
        Pick up where you left off any time from the Drafts tab.
      </p>
      <Button onClick={onBack} className="mt-2">
        Back to Drafts
      </Button>
    </div>
  );
}
