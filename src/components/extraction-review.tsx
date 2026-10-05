"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, CircleCheck, CircleX } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type {
  CriterionNode,
  ExtractedCondition,
  ExtractedPolicy,
  ValidationResult,
} from "@/lib/policy/extracted-schema";

const PROVENANCE_CLASS: Record<string, string> = {
  Policy: "bg-accent-green/15 text-accent-green",
  Inferred: "bg-accent-orange/15 text-accent-orange",
  Unverified: "bg-destructive/10 text-destructive",
};

function ProvenanceChip({ label }: { label: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent text-[10px]", PROVENANCE_CLASS[label])}>
      {label}
    </Badge>
  );
}

function ValidationIcon({ found }: { found: boolean | undefined }) {
  if (found === undefined) return null;
  return found ? (
    <CircleCheck className="size-3.5 text-accent-green" aria-label="Quote verified against source text" />
  ) : (
    <CircleX className="size-3.5 text-destructive" aria-label="Quote not found in source text" />
  );
}

/** Collapsible section matching document-list.tsx's existing expand/collapse
 *  pattern (local boolean state + chevron) rather than a new primitive. */
function Section({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="text-sm font-medium">{title}</span>
          {subtitle && <span className="ml-2 text-xs text-muted-foreground">{subtitle}</span>}
        </span>
        {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>
      {open && <div className="border-t px-4 py-3">{children}</div>}
    </div>
  );
}

function findValidation(
  validation: ValidationResult[],
  quote: string,
  page: string
): boolean | undefined {
  return validation.find((v) => v.quote === quote && v.page === page)?.found;
}

function CriterionTree({
  node,
  depth,
  validation,
}: {
  node: CriterionNode;
  depth: number;
  validation: ValidationResult[];
}) {
  if (node.type === "group") {
    return (
      <div
        className={cn("space-y-2 rounded-md border-l-2 pl-3", depth > 0 && "ml-2")}
        style={{ borderColor: depth % 2 === 0 ? "var(--accent-purple)" : "var(--accent-blue)" }}
      >
        <Badge variant="secondary" className="text-[10px]">
          {node.logic === "ONE" ? "ONE OF" : node.logic}
        </Badge>
        <div className="space-y-2">
          {node.items.map((item, i) => (
            <CriterionTree key={i} node={item} depth={depth + 1} validation={validation} />
          ))}
        </div>
      </div>
    );
  }

  const found = findValidation(validation, node.quote, node.page);
  return (
    <div className={cn("space-y-1 rounded-md border p-2.5 text-sm", depth > 0 && "ml-2")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">
          #{node.number} &middot; {node.label}
        </span>
        <ProvenanceChip label={node.provenance} />
        <Badge variant="outline" className="text-[10px]">
          {node.check.kind}
        </Badge>
        {node.documentationRequired && (
          <Badge variant="outline" className="border-accent-orange/30 text-[10px] text-accent-orange">
            documentation required
          </Badge>
        )}
        <ValidationIcon found={found} />
      </div>
      <p className="text-muted-foreground">{node.text}</p>
      <p className="text-xs text-muted-foreground italic">&ldquo;{node.quote}&rdquo; &mdash; {node.page}</p>
    </div>
  );
}

function ConditionReview({
  condition,
  validation,
}: {
  condition: ExtractedCondition;
  validation: ValidationResult[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <Badge variant="secondary">{condition.category}</Badge>
        {condition.icd10.map((code) => (
          <Badge key={code} variant="outline" className="text-[10px]">
            {code}
          </Badge>
        ))}
        <span className="text-xs text-muted-foreground">{condition.page}</span>
        {condition.cptCode && (
          <span className="text-xs text-muted-foreground">CPT {condition.cptCode}</span>
        )}
      </div>
      {condition.prescriber && condition.prescriber.specialties.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Prescriber ({condition.prescriber.appliesTo}): {condition.prescriber.specialties.join(", ")}
        </p>
      )}
      {condition.branches.map((branch, bi) => (
        <div key={bi} className="space-y-2">
          <div className="flex items-center gap-2">
            {branch.branch !== "single" && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {branch.branch}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Duration: {branch.duration}
              {branch.minTimeOnDrug && ` · min time on drug: ${branch.minTimeOnDrug}`}
            </span>
          </div>
          <CriterionTree node={branch.criteria} depth={0} validation={validation} />
        </div>
      ))}
      {condition.dosing.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase">Dosing</p>
          {condition.dosing.map((rule, i) => (
            <p key={i} className="text-xs text-muted-foreground">
              {rule.branch !== "both" && rule.branch !== "single" && (
                <span className="capitalize">{rule.branch}: </span>
              )}
              {rule.maxDose} {rule.unit} &middot; {rule.interval}
              {rule.qualifier && ` · ${rule.qualifier}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExtractionReview({
  draft,
  validation,
  onChange,
}: {
  draft: ExtractedPolicy;
  validation: ValidationResult[];
  onChange: (next: ExtractedPolicy) => void;
}) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(draft, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonApplied, setJsonApplied] = useState(false);

  const foundCount = useMemo(() => validation.filter((v) => v.found).length, [validation]);

  function update<K extends keyof ExtractedPolicy>(key: K, value: ExtractedPolicy[K]) {
    onChange({ ...draft, [key]: value });
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as ExtractedPolicy;
      onChange(parsed);
      setJsonError(null);
      setJsonApplied(true);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3">
        <p className="text-sm">
          <span className="font-medium">{foundCount}</span> / {validation.length} cited quotes verified
          against the source text.
        </p>
        {validation.length > foundCount && (
          <Badge variant="outline" className="border-destructive/30 text-destructive">
            {validation.length - foundCount} quote(s) need review
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Payer</Label>
          <Input value={draft.payer} onChange={(e) => update("payer", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Policy number</Label>
          <Input value={draft.policyNumber} onChange={(e) => update("policyNumber", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Title</Label>
          <Input value={draft.title} onChange={(e) => update("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Effective date</Label>
          <Input value={draft.effectiveDate} onChange={(e) => update("effectiveDate", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Review date</Label>
          <Input value={draft.reviewDate} onChange={(e) => update("reviewDate", e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Drugs</Label>
          <p className="text-sm">
            {draft.drugs.map((d) => `${d.brand} (${d.generic}) · ${d.hcpcs} per ${d.unit}`).join("; ") || "—"}
          </p>
        </div>
        {draft.changeSummary && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Change summary</Label>
            <p className="text-sm text-muted-foreground">{draft.changeSummary}</p>
          </div>
        )}
      </div>

      <Section title="Related documents" subtitle={`${draft.relatedDocuments.length}`}>
        <div className="space-y-2">
          {draft.relatedDocuments.map((doc, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{doc.number}</span>
              <Badge variant="outline" className="text-[10px]">
                {doc.type}
              </Badge>
              <Badge variant={doc.used ? "default" : "secondary"} className="text-[10px]">
                {doc.used ? "used" : "not used"}
              </Badge>
              {doc.label && <span className="text-xs text-muted-foreground">{doc.label}</span>}
            </div>
          ))}
          {draft.relatedDocuments.length === 0 && (
            <p className="text-sm text-muted-foreground">None found.</p>
          )}
        </div>
      </Section>

      <Section title="General rules" subtitle={`${draft.rules.length}`}>
        <div className="space-y-3">
          {draft.rules.map((rule, i) => (
            <div key={i} className="space-y-1 rounded-md border p-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {rule.kind}
                </Badge>
                <ProvenanceChip label={rule.label} />
                <span className="text-xs text-muted-foreground">{rule.page}</span>
                {rule.quote && <ValidationIcon found={findValidation(validation, rule.quote, rule.page)} />}
              </div>
              <p className="text-muted-foreground">{rule.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Conditions"
        subtitle={`${draft.conditions.length}`}
        defaultOpen={draft.conditions.length <= 3}
      >
        <div className="space-y-4 divide-y">
          {draft.conditions.map((condition) => (
            <div key={condition.number} className="pt-4 first:pt-0">
              <p className="mb-2 text-sm font-medium">
                #{condition.number} &middot; {condition.name}
              </p>
              <ConditionReview condition={condition} validation={validation} />
            </div>
          ))}
        </div>
      </Section>

      <Separator />

      <div className="space-y-1.5">
        <Label>Raw JSON (for shape-changing edits — add/remove a criterion, change group logic, etc.)</Label>
        <Textarea
          className="min-h-64 font-mono text-xs"
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setJsonApplied(false);
          }}
        />
        {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        <button
          type="button"
          onClick={applyJson}
          className="text-xs font-medium text-accent-blue underline underline-offset-2"
        >
          Apply JSON to the preview above
        </button>
        {jsonApplied && (
          <p className="text-xs text-accent-orange">
            Applied — note the quote-verification counts above still reflect the original extraction, not
            this edit (re-run extraction to re-verify).
          </p>
        )}
      </div>
    </div>
  );
}
