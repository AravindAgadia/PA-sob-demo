"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, FileText, Trash2 } from "lucide-react";
import { IconChip } from "@/components/icon-chip";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deletePolicyDocument } from "@/app/documents/actions";
import type { PolicyDocument } from "@/lib/policy/types";

function CriterionSummary({ criterion }: { criterion: PolicyDocument["criteria"][number] }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <p className="text-sm font-medium">
          #{criterion.number} &middot; {criterion.label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{criterion.description}</p>
      </div>
      <Badge variant={criterion.systemVerifiable ? "outline" : "secondary"} className="shrink-0 text-[10px]">
        {criterion.systemVerifiable ? "System-checked" : "Attestation"}
      </Badge>
    </div>
  );
}

function DocumentCard({ policy }: { policy: PolicyDocument }) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deletePolicyDocument(policy.id);
      } catch {
        setError("Couldn't remove this document. Try again.");
        setDialogOpen(true);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2.5">
          <IconChip icon={FileText} color="teal" />
          {policy.drug}
          <Badge variant="secondary">{policy.payer}</Badge>
          <Badge variant="outline">{policy.lineOfBusiness}</Badge>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-1.5">
          <span>
            {policy.policyType} &middot; effective {policy.effectiveDate || "—"} &middot;{" "}
            {policy.criteria.length} criteria
          </span>
          {policy.hasEmbedding && (
            <Badge variant="outline" className="border-accent-purple/30 text-[10px] text-accent-purple">
              AI-searchable
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="divide-y">
          {policy.criteria.map((criterion) => (
            <CriterionSummary key={criterion.id} criterion={criterion} />
          ))}
        </CardContent>
      )}
      {error && (
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      )}
      <CardFooter className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp /> : <ChevronDown />}
          {expanded ? "Hide criteria" : "View criteria"}
        </Button>
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger render={<Button variant="destructive" size="sm" disabled={pending} />}>
            <Trash2 />
            {pending ? "Removing…" : "Remove"}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Remove this policy document?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes &ldquo;{policy.drug}&rdquo; ({policy.payer} / {policy.lineOfBusiness})
              from the Document Library. New requests won&apos;t be able to match against it
              anymore. This can&apos;t be undone.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" size="sm" />}>
                Cancel
              </AlertDialogClose>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>
                {pending ? "Removing…" : "Remove"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

export function DocumentList({ policies }: { policies: PolicyDocument[] }) {
  return (
    <div className="space-y-4">
      {policies.map((policy) => (
        <DocumentCard key={policy.id} policy={policy} />
      ))}
    </div>
  );
}
