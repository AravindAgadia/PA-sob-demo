"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, ScrollText, Sparkles, Trash2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ExtractionReview } from "@/components/extraction-review";
import { IconChip } from "@/components/icon-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  deleteExtractionDraft,
  getExtractionDraft,
  runExtraction,
  saveExtractionDraft,
} from "@/app/documents/extract/actions";
import type {
  ExtractDocumentKind,
  ExtractSourceText,
  ExtractedPolicy,
  ValidationResult,
} from "@/lib/policy/extracted-schema";
import type { ExtractedDraftSummary } from "@/lib/policy/extraction-store";

const KIND_OPTIONS: { value: ExtractDocumentKind; label: string }[] = [
  { value: "governing-policy", label: "Governing policy" },
  { value: "pa-form", label: "PA form" },
  { value: "general-policy", label: "General policy (e.g. site of care)" },
  { value: "other", label: "Other" },
];

interface FileRow {
  key: string;
  file: File;
  kind: ExtractDocumentKind;
}

let rowKeySeq = 0;
function nextRowKey() {
  rowKeySeq += 1;
  return `row-${rowKeySeq}`;
}

export function ExtractWorkspace({ initialDrafts }: { initialDrafts: ExtractedDraftSummary[] }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<FileRow[]>([]);
  const [isExtracting, startExtractTransition] = useTransition();
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarning, setExtractWarning] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // A server action blocks until the whole run finishes — there's no
  // partial progress to report back mid-flight — so this ticking counter
  // is the cheapest honest signal that the page hasn't frozen during what
  // can genuinely be a multi-minute run (one call per condition, each a
  // real OpenAI round trip).
  useEffect(() => {
    if (!isExtracting) {
      setElapsedSeconds(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isExtracting]);

  const [draft, setDraft] = useState<ExtractedPolicy | null>(null);
  const [validation, setValidation] = useState<ValidationResult[]>([]);
  const [sourceDocs, setSourceDocs] = useState<ExtractSourceText[]>([]);

  const [payer, setPayer] = useState("");
  const [drugLabel, setDrugLabel] = useState("");
  const [isSaving, startSaveTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [isLoadingDraft, startLoadTransition] = useTransition();

  function addFiles(files: FileList) {
    const next: FileRow[] = Array.from(files).map((file) => ({
      key: nextRowKey(),
      file,
      kind: rows.length === 0 ? "governing-policy" : "other",
    }));
    setRows((prev) => [...prev, ...next]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function setRowKind(key: string, kind: ExtractDocumentKind) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, kind } : r)));
  }

  function handleExtract() {
    setExtractError(null);
    setExtractWarning(null);
    startExtractTransition(async () => {
      const formData = new FormData();
      for (const row of rows) {
        formData.append("file", row.file);
        formData.append("kind", row.kind);
      }
      const result = await runExtraction(formData);
      if (!result.ok) {
        setExtractError(result.error);
        return;
      }
      setDraft(result.draft);
      setValidation(result.validation);
      setSourceDocs(result.sourceDocs);
      setPayer(result.draft.payer || "");
      setDrugLabel(result.draft.drugs[0]?.brand || result.draft.title || "");
      if (result.warning) setExtractWarning(result.warning);
    });
  }

  function handleSave() {
    if (!draft) return;
    setSaveError(null);
    setSaveNotice(null);
    startSaveTransition(async () => {
      try {
        await saveExtractionDraft({ payer, drugLabel, data: draft, validation, sourceText: sourceDocs });
        setSaveNotice("Saved.");
        router.refresh();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Couldn't save this draft. Try again.");
      }
    });
  }

  function handleLoadDraft(id: string) {
    startLoadTransition(async () => {
      const loaded = await getExtractionDraft(id);
      if (!loaded) return;
      setDraft(loaded.data);
      setValidation(loaded.validation);
      setSourceDocs(loaded.sourceText);
      setPayer(loaded.payer);
      setDrugLabel(loaded.drugLabel);
      setExtractWarning(null);
    });
  }

  function handleDeleteDraft(id: string) {
    startLoadTransition(async () => {
      await deleteExtractionDraft(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <IconChip icon={Sparkles} color="purple" />
            Upload policy documents
          </CardTitle>
          <CardDescription>
            Upload the drug&apos;s governing coverage policy (required), plus its PA form and any
            applicable general policy (e.g. site of care). Each PDF is read page by page and extracted
            into a cited, structured draft — condition by condition, with every criterion&apos;s quote
            checked against the source text.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Plus /> Add PDF
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.key} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{row.file.name}</span>
                  <Select value={row.kind} onValueChange={(v) => v && setRowKind(row.key, v as ExtractDocumentKind)}>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KIND_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`Remove ${row.file.name}`}
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {extractError && (
            <Alert variant="destructive">
              <AlertTitle>Couldn&apos;t extract this policy</AlertTitle>
              <AlertDescription>{extractError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button disabled={isExtracting || rows.length === 0} onClick={handleExtract}>
            {isExtracting ? (
              <>
                <Loader2 className="animate-spin" /> Extracting&hellip; {elapsedSeconds}s elapsed &mdash; one
                pass per condition, so a large policy can take a few minutes
              </>
            ) : (
              <>
                <Sparkles /> Extract
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {draft && (
        <Card>
          <CardHeader>
            <CardTitle>Review extracted draft</CardTitle>
            <CardDescription>
              Edit any value inline. Changing the tree&apos;s shape (add/remove a criterion, change group
              logic) needs the raw-JSON field at the bottom.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {extractWarning && (
              <Alert className="border-accent-orange/30 bg-accent-orange/10 *:[svg]:text-accent-orange">
                <AlertTitle>Some conditions didn&apos;t extract</AlertTitle>
                <AlertDescription>{extractWarning}</AlertDescription>
              </Alert>
            )}
            <ExtractionReview draft={draft} validation={validation} onChange={setDraft} />
          </CardContent>
          <CardFooter className="flex-col items-start gap-3">
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Payer (for the saved draft list)</Label>
                <Input value={payer} onChange={(e) => setPayer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Drug label (for the saved draft list)</Label>
                <Input value={drugLabel} onChange={(e) => setDrugLabel(e.target.value)} />
              </div>
            </div>
            {saveError && (
              <Alert variant="destructive">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            {saveNotice && <p className="text-xs text-accent-green">{saveNotice}</p>}
            <Button disabled={isSaving} onClick={handleSave}>
              {isSaving ? "Saving…" : "Save draft"}
            </Button>
          </CardFooter>
        </Card>
      )}

      <Separator />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Saved drafts</h2>
        {initialDrafts.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <div className="space-y-2">
            {initialDrafts.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="font-medium">{d.drugLabel}</span>
                <Badge variant="secondary">{d.payer}</Badge>
                <Badge variant={d.status === "draft" ? "outline" : "destructive"} className="text-[10px]">
                  {d.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(d.createdAt).toLocaleString()}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/documents/extract/${d.id}/summary`} target="_blank" />}>
                    <ScrollText /> Benefit summary
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoadingDraft}
                    onClick={() => handleLoadDraft(d.id)}
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isLoadingDraft}
                    onClick={() => handleDeleteDraft(d.id)}
                    aria-label={`Delete draft for ${d.drugLabel}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
