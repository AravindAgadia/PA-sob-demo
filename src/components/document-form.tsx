"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { IconChip } from "@/components/icon-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stepper, type StepperStep } from "@/components/stepper";
import { Textarea } from "@/components/ui/textarea";
import { createPolicyDocument, extractPolicy, extractPolicyFromUpload } from "@/app/documents/actions";
import type { ExtractedCriterion } from "@/lib/policy/extract";
import type {
  CriterionDefinition,
  CriterionEvaluatorSpec,
  CriterionOption,
  IntakeData,
} from "@/lib/policy/types";

type EvaluatorKind = CriterionEvaluatorSpec["kind"];

const STEP_LABELS = ["Policy details", "Source document", "Criteria"];
const STEP_COLORS: StepperStep["color"][] = ["teal", "purple", "blue"];

const INTAKE_FIELDS: { value: keyof IntakeData; label: string }[] = [
  { value: "diagnosis", label: "Diagnosis" },
  { value: "drug", label: "Drug requested" },
  { value: "dispensingLocation", label: "Dispensing location" },
  { value: "payer", label: "Payer" },
];

const EVALUATOR_KINDS: { value: EvaluatorKind; label: string }[] = [
  { value: "intake-text-match", label: "Match against an intake field (system-checked)" },
  { value: "npi-specialty-match", label: "Prescriber specialty via live NPI lookup (system-checked)" },
  { value: "attestation-single", label: "Single-choice attestation" },
  { value: "attestation-multi", label: "Multi-select attestation (any selected = met)" },
];

/** Mirrors the server-side cap in documents/actions.ts — checked here too
 *  so an oversized file fails fast instead of after a round trip. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

let draftKeySeq = 0;
function nextDraftKey() {
  draftKeySeq += 1;
  return `draft-${draftKeySeq}`;
}

interface CriterionDraft {
  key: string;
  label: string;
  description: string;
  kind: EvaluatorKind;
  intakeField: keyof IntakeData;
  matchAnyRaw: string;
  specialtyKeywordsRaw: string;
  question: string;
  optionsRaw: string;
  satisfyingLabels: string[];
}

function newCriterionDraft(): CriterionDraft {
  return {
    key: nextDraftKey(),
    label: "",
    description: "",
    kind: "attestation-single",
    intakeField: "diagnosis",
    matchAnyRaw: "",
    specialtyKeywordsRaw: "",
    question: "",
    optionsRaw: "",
    satisfyingLabels: [],
  };
}

function extractedToDraft(ec: ExtractedCriterion): CriterionDraft {
  return {
    key: nextDraftKey(),
    label: ec.label,
    description: ec.description,
    kind: ec.kind,
    intakeField: ec.intakeField ?? "diagnosis",
    matchAnyRaw: (ec.matchAny ?? []).join(", "),
    specialtyKeywordsRaw: (ec.specialtyKeywords ?? []).join(", "),
    question: ec.question ?? "",
    optionsRaw: (ec.options ?? []).join("\n"),
    satisfyingLabels: ec.satisfyingOptions ?? [],
  };
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || fallback;
}

/** Slugifies, then disambiguates against `used` (e.g. "foo", "foo-2", "foo-3"). */
function uniqueSlug(value: string, fallback: string, used: Set<string>): string {
  const base = slugify(value, fallback);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCommaList(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildOptions(optionsRaw: string): CriterionOption[] {
  const usedValues = new Set<string>();
  return parseLines(optionsRaw).map((optLabel) => ({
    value: uniqueSlug(optLabel, optLabel, usedValues),
    label: optLabel,
  }));
}

/**
 * Builds the final criteria in one pass over all drafts so ids are unique
 * across the whole document, not just within a single row — two criteria
 * with the same (or same-normalizing) label would otherwise collide.
 */
function buildCriteriaDefinitions(drafts: CriterionDraft[]): CriterionDefinition[] {
  const usedIds = new Set<string>();
  const definitions: CriterionDefinition[] = [];

  for (const draft of drafts) {
    const label = draft.label.trim();
    if (!label) continue;
    const number = definitions.length + 1;
    const id = uniqueSlug(label, `criterion-${number}`, usedIds);
    const base = { id, number, label, description: draft.description.trim() || label };

    switch (draft.kind) {
      case "intake-text-match":
        definitions.push({
          ...base,
          systemVerifiable: true,
          evaluator: {
            kind: "intake-text-match",
            field: draft.intakeField,
            matchAny: parseCommaList(draft.matchAnyRaw),
          },
        });
        break;
      case "npi-specialty-match":
        definitions.push({
          ...base,
          systemVerifiable: true,
          evaluator: {
            kind: "npi-specialty-match",
            specialtyKeywords: parseCommaList(draft.specialtyKeywordsRaw),
          },
        });
        break;
      case "attestation-single": {
        const options = buildOptions(draft.optionsRaw);
        const satisfyingValues = options
          .filter((opt) => draft.satisfyingLabels.includes(opt.label))
          .map((opt) => opt.value);
        definitions.push({
          ...base,
          systemVerifiable: false,
          evaluator: {
            kind: "attestation-single",
            question: draft.question.trim() || label,
            options,
            satisfyingValues,
          },
        });
        break;
      }
      case "attestation-multi": {
        definitions.push({
          ...base,
          systemVerifiable: false,
          evaluator: {
            kind: "attestation-multi",
            question: draft.question.trim() || label,
            options: buildOptions(draft.optionsRaw),
          },
        });
        break;
      }
    }
  }

  return definitions;
}

export function DocumentForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<"forward" | "backward">("forward");

  const [isExtracting, startExtractTransition] = useTransition();
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [drug, setDrug] = useState("");
  const [payer, setPayer] = useState("");
  const [lineOfBusiness, setLineOfBusiness] = useState("");
  const [policyType, setPolicyType] = useState("Prior Authorization");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [approvalInitial, setApprovalInitial] = useState("Plan year");
  const [approvalRenewal, setApprovalRenewal] = useState("Plan year");
  const [sourceNote, setSourceNote] = useState("");
  const [notApplicableRaw, setNotApplicableRaw] = useState("");
  const [rawText, setRawText] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>([newCriterionDraft()]);

  const stepperSteps: StepperStep[] = STEP_LABELS.map((label, i) => ({
    label,
    color: STEP_COLORS[i],
    status: i < step ? "complete" : i === step ? "current" : "upcoming",
  }));

  function updateCriterion(key: string, patch: Partial<CriterionDraft>) {
    setCriteria((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeCriterion(key: string) {
    setCriteria((rows) => rows.filter((row) => row.key !== key));
  }

  function toggleSatisfying(key: string, optionLabel: string) {
    setCriteria((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        const has = row.satisfyingLabels.includes(optionLabel);
        return {
          ...row,
          satisfyingLabels: has
            ? row.satisfyingLabels.filter((l) => l !== optionLabel)
            : [...row.satisfyingLabels, optionLabel],
        };
      })
    );
  }

  function goNext() {
    setError(null);
    if (step === 0 && (!drug.trim() || !payer.trim() || !lineOfBusiness.trim())) {
      setError("Drug, payer, and line of business are required before continuing.");
      return;
    }
    setStepDirection("forward");
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setError(null);
    setStepDirection("backward");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleFileSelect(file: File) {
    setExtractError(null);
    setExtractNotice(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      if (file.size > MAX_UPLOAD_BYTES) {
        setExtractError(
          `"${file.name}" is too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB). Try a smaller file, or paste the text instead.`
        );
        return;
      }
      setUploadedFile(file);
      setRawText("");
      return;
    }
    // Anything else we treat as plain text and read it straight into the
    // paste box — only PDFs need the server round trip, since text files
    // are already what extractPolicyFromText expects.
    setUploadedFile(null);
    setRawText(await file.text());
  }

  function clearUploadedFile() {
    setUploadedFile(null);
    setExtractError(null);
    setExtractNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleExtract() {
    setExtractError(null);
    setExtractNotice(null);
    startExtractTransition(async () => {
      let result;
      if (uploadedFile) {
        const formData = new FormData();
        formData.set("file", uploadedFile);
        result = await extractPolicyFromUpload(formData);
      } else {
        result = await extractPolicy(rawText);
      }
      if (!result.ok) {
        setExtractError(result.error);
        return;
      }
      const p = result.policy;
      if (p.drug) setDrug(p.drug);
      if (p.payer) setPayer(p.payer);
      if (p.lineOfBusiness) setLineOfBusiness(p.lineOfBusiness);
      if (p.policyType) setPolicyType(p.policyType);
      if (p.effectiveDate) setEffectiveDate(p.effectiveDate);
      if (p.reviewDate) setReviewDate(p.reviewDate);
      if (p.sourceNote) setSourceNote(p.sourceNote);
      if (p.approvalInitial) setApprovalInitial(p.approvalInitial);
      if (p.approvalRenewal) setApprovalRenewal(p.approvalRenewal);
      if (p.notApplicable.length > 0) setNotApplicableRaw(p.notApplicable.join("\n"));
      setCriteria(p.criteria.map(extractedToDraft));
      const noun = p.criteria.length === 1 ? "criterion" : "criteria";
      setExtractNotice(
        `Extracted ${p.criteria.length} ${noun} — review the Policy details and Criteria steps before saving.`
      );
    });
  }

  function handleSubmit() {
    setError(null);
    const definitions = buildCriteriaDefinitions(criteria);
    if (definitions.length === 0) {
      setError("Add at least one criterion with a label.");
      return;
    }

    startTransition(async () => {
      try {
        await createPolicyDocument({
          drug: drug.trim(),
          payer: payer.trim(),
          lineOfBusiness: lineOfBusiness.trim(),
          policyType: policyType.trim() || "Prior Authorization",
          effectiveDate,
          reviewDate,
          sourceNote: sourceNote.trim(),
          approvalDuration: { initial: approvalInitial.trim(), renewal: approvalRenewal.trim() },
          notApplicable: parseLines(notApplicableRaw),
          criteria: definitions,
          rawText: rawText.trim() || undefined,
        });
        router.push("/documents");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save this document. Try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-lg border bg-card px-4 py-3">
        <Stepper steps={stepperSteps} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Can&apos;t continue yet</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div
        key={step}
        className={cn(
          "animate-in fade-in-0 duration-300 ease-out",
          stepDirection === "forward" ? "slide-in-from-right-2" : "slide-in-from-left-2"
        )}
      >
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconChip icon={FileText} color="teal" />
              Policy details
            </CardTitle>
            <CardDescription>
              Metadata the matching engine uses to find this policy for a request (drug +
              payer + line of business).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="doc-drug">Drug</Label>
              <Input
                id="doc-drug"
                value={drug}
                onChange={(e) => setDrug(e.target.value)}
                placeholder="e.g. Xolair (omalizumab)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-payer">Payer</Label>
              <Input
                id="doc-payer"
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                placeholder="e.g. Anthem"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-lob">Line of business</Label>
              <Input
                id="doc-lob"
                value={lineOfBusiness}
                onChange={(e) => setLineOfBusiness(e.target.value)}
                placeholder="e.g. Commercial"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-type">Policy type</Label>
              <Input id="doc-type" value={policyType} onChange={(e) => setPolicyType(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-effective">Effective date</Label>
              <Input
                id="doc-effective"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-review">Review date</Label>
              <Input
                id="doc-review"
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-approval-initial">Approval duration — initial</Label>
              <Input
                id="doc-approval-initial"
                value={approvalInitial}
                onChange={(e) => setApprovalInitial(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-approval-renewal">Approval duration — renewal</Label>
              <Input
                id="doc-approval-renewal"
                value={approvalRenewal}
                onChange={(e) => setApprovalRenewal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="doc-source-note">Ingestion note</Label>
              <Textarea
                id="doc-source-note"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                placeholder="Where this came from, freshness caveats, anything a reviewer should know."
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="doc-not-applicable">Also checked, not applicable here (one per line)</Label>
              <Textarea
                id="doc-not-applicable"
                value={notApplicableRaw}
                onChange={(e) => setNotApplicableRaw(e.target.value)}
                placeholder={"No age gate specified\nNo step therapy requirement"}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconChip icon={Sparkles} color="purple" />
              Source document
            </CardTitle>
            <CardDescription>
              Upload the policy PDF, or paste its text below, then auto-extract to fill in the
              Policy details and Criteria steps from it — review and edit the result before
              saving. This step is optional; you can still enter everything by hand.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExtracting}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload /> Upload PDF or text file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf,.txt,text/plain,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleFileSelect(file);
                }}
              />
              {uploadedFile && (
                <Badge variant="secondary" className="gap-1.5 py-1 pr-1">
                  <FileText className="size-3" />
                  {uploadedFile.name}
                  <button
                    type="button"
                    onClick={clearUploadedFile}
                    aria-label={`Remove ${uploadedFile.name}`}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
            </div>

            {uploadedFile ? (
              <Alert>
                <AlertTitle>Ready to extract from {uploadedFile.name}</AlertTitle>
                <AlertDescription>
                  The PDF is sent directly to the extraction model — nothing is parsed locally.
                  Remove it above to paste text instead.
                </AlertDescription>
              </Alert>
            ) : (
              <Textarea
                className="min-h-48"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="…or paste the coverage policy document text here"
              />
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExtracting || (!rawText.trim() && !uploadedFile)}
              onClick={handleExtract}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="animate-spin" /> Extracting…
                </>
              ) : (
                <>
                  <Sparkles /> Auto-extract with AI
                </>
              )}
            </Button>
            {extractError && (
              <Alert variant="destructive">
                <AlertTitle>Couldn&apos;t extract this document</AlertTitle>
                <AlertDescription>{extractError}</AlertDescription>
              </Alert>
            )}
            {extractNotice && <p className="text-xs text-accent-green">{extractNotice}</p>}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <IconChip icon={ListChecks} color="blue" />
              Criteria
            </CardTitle>
            <CardDescription>
              Each row becomes one checklist item on the Summary of Benefits, evaluated the same
              way as any other ingested policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {criteria.map((draft, index) => (
              <div key={draft.key} className="rounded-lg border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Badge variant="secondary">Criterion #{index + 1}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeCriterion(draft.key)}
                    disabled={criteria.length === 1}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Label</Label>
                    <Input
                      value={draft.label}
                      onChange={(e) => updateCriterion(draft.key, { label: e.target.value })}
                      placeholder="e.g. Diagnosis of thyroid eye disease"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={draft.description}
                      onChange={(e) => updateCriterion(draft.key, { description: e.target.value })}
                      placeholder="Full requirement text from the policy"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>How is this checked?</Label>
                    <Select
                      value={draft.kind}
                      onValueChange={(v) => updateCriterion(draft.key, { kind: v as EvaluatorKind })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVALUATOR_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {draft.kind === "intake-text-match" && (
                    <>
                      <div className="space-y-1.5">
                        <Label>Intake field</Label>
                        <Select
                          value={draft.intakeField}
                          onValueChange={(v) =>
                            updateCriterion(draft.key, { intakeField: v as keyof IntakeData })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INTAKE_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Match if it contains any of (comma-separated)</Label>
                        <Input
                          value={draft.matchAnyRaw}
                          onChange={(e) => updateCriterion(draft.key, { matchAnyRaw: e.target.value })}
                          placeholder="thyroid eye disease, ted"
                        />
                      </div>
                    </>
                  )}

                  {draft.kind === "npi-specialty-match" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Required specialty keywords (comma-separated)</Label>
                      <Input
                        value={draft.specialtyKeywordsRaw}
                        onChange={(e) => updateCriterion(draft.key, { specialtyKeywordsRaw: e.target.value })}
                        placeholder="ophthalmol, endocrin, thyroid"
                      />
                      <p className="text-xs text-muted-foreground">
                        Matched against the taxonomy description NPPES returns for the
                        prescriber&apos;s NPI.
                      </p>
                    </div>
                  )}

                  {(draft.kind === "attestation-single" || draft.kind === "attestation-multi") && (
                    <>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Question shown to the requesting provider</Label>
                        <Input
                          value={draft.question}
                          onChange={(e) => updateCriterion(draft.key, { question: e.target.value })}
                          placeholder="e.g. What is the member's thyroid status?"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Options (one per line)</Label>
                        <Textarea
                          value={draft.optionsRaw}
                          onChange={(e) => updateCriterion(draft.key, { optionsRaw: e.target.value })}
                          placeholder={"Euthyroid\nCurrently receiving treatment\nNeither confirmed"}
                        />
                      </div>
                      {draft.kind === "attestation-single" && (
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>Which option(s) satisfy this criterion?</Label>
                          {parseLines(draft.optionsRaw).length === 0 ? (
                            <p className="text-xs text-muted-foreground">Add options above first.</p>
                          ) : (
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {parseLines(draft.optionsRaw).map((optLabel) => (
                                <label key={optLabel} className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={draft.satisfyingLabels.includes(optLabel)}
                                    onCheckedChange={() => toggleSatisfying(draft.key, optLabel)}
                                  />
                                  {optLabel}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {draft.kind === "attestation-multi" && (
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          Satisfied when the provider selects at least one option.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCriteria((rows) => [...rows, newCriterionDraft()])}
            >
              <Plus /> Add criterion
            </Button>
          </CardContent>
        </Card>
      )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={goBack} disabled={step === 0 || pending}>
          <ArrowLeft /> Back
        </Button>
        {step < STEP_LABELS.length - 1 ? (
          <Button type="button" onClick={goNext}>
            Next <ArrowRight />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Saving…" : "Save document"}
          </Button>
        )}
      </div>
    </div>
  );
}
