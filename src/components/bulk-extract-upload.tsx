"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Layers, Loader2, Play, X, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/icon-chip";
import { runExtraction, saveExtractionDraft } from "@/app/documents/extract/actions";

type RowStatus = "pending" | "running" | "saved" | "error";

interface BulkRow {
  key: string;
  file: File;
  status: RowStatus;
  error?: string;
  savedId?: string;
}

let rowKeySeq = 0;
function nextRowKey() {
  rowKeySeq += 1;
  return `bulk-row-${rowKeySeq}`;
}

function RowStatusIcon({ status }: { status: RowStatus }) {
  if (status === "running") return <Loader2 className="size-4 shrink-0 animate-spin text-accent-blue" />;
  if (status === "saved") return <CheckCircle2 className="size-4 shrink-0 text-accent-green" />;
  if (status === "error") return <XCircle className="size-4 shrink-0 text-destructive" />;
  return <FileText className="size-4 shrink-0 text-muted-foreground" />;
}

/**
 * A separate upload path from the single-extraction card above it: each
 * file here is its own drug/payer, tagged "governing-policy" and run (and
 * auto-saved) independently — no multi-file-per-drug pairing, no manual
 * review step per file. Processes one at a time, in order, so a large
 * batch doesn't fan out into dozens of concurrent OpenAI runs at once;
 * stops (rather than erroring every remaining file) the moment the shared
 * extraction rate limit is hit, leaving the rest "pending" to resume
 * later. A file that extracts with some conditions missing still
 * auto-saves — it lands with a "needs-review" status in the saved-drafts
 * list below, same as the single-extraction flow's own partial results.
 */
export function BulkExtractUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [isRunning, startRunning] = useTransition();
  const [rateLimited, setRateLimited] = useState(false);

  const doneCount = rows.filter((r) => r.status === "saved" || r.status === "error").length;

  function addFiles(files: FileList) {
    const next: BulkRow[] = Array.from(files).map((file) => ({
      key: nextRowKey(),
      file,
      status: "pending",
    }));
    setRows((prev) => [...prev, ...next]);
    setRateLimited(false);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function clearFinished() {
    setRows((prev) => prev.filter((r) => r.status === "pending" || r.status === "running"));
  }

  function updateRow(key: string, patch: Partial<BulkRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleStart() {
    setRateLimited(false);
    startRunning(async () => {
      // Snapshot the pending keys up front — rows added mid-run (the user
      // dropping in more files while an earlier batch is still going)
      // pick up on the next click instead of racing this pass.
      const pendingKeys = rows.filter((r) => r.status === "pending").map((r) => r.key);
      for (const key of pendingKeys) {
        const row = rows.find((r) => r.key === key);
        if (!row) continue;
        updateRow(key, { status: "running", error: undefined });

        const formData = new FormData();
        formData.append("file", row.file);
        formData.append("kind", "governing-policy");
        const result = await runExtraction(formData);

        if (!result.ok) {
          if (result.error.startsWith("Too many extraction runs")) {
            updateRow(key, { status: "pending" });
            setRateLimited(true);
            return;
          }
          updateRow(key, { status: "error", error: result.error });
          continue;
        }

        const payer = result.draft.payer || "";
        const drugLabel = result.draft.drugs[0]?.brand || result.draft.title || row.file.name;
        try {
          const saved = await saveExtractionDraft({
            payer,
            drugLabel,
            data: result.draft,
            validation: result.validation,
            sourceText: result.sourceDocs,
          });
          updateRow(key, { status: "saved", savedId: saved.id });
        } catch (err) {
          updateRow(key, {
            status: "error",
            error: `Extracted but couldn't save${err instanceof Error ? `: ${err.message}` : ""}.`,
          });
        }
      }
      router.refresh();
    });
  }

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <IconChip icon={Layers} color="teal" />
          Bulk upload
        </CardTitle>
        <CardDescription>
          Add many single-PDF governing policies at once — each one is extracted and saved as its
          own draft automatically, in order. For a drug that needs its PA form or a general policy
          paired with it, use the single upload above instead.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FileText /> Add PDFs
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
          {rows.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFinished} disabled={isRunning}>
              <X /> Clear finished
            </Button>
          )}
          {rows.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {doneCount} of {rows.length} done
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <div className="space-y-1.5">
            {rows.map((row) => (
              <div key={row.key} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
                <RowStatusIcon status={row.status} />
                <span className="min-w-0 flex-1 truncate">{row.file.name}</span>
                {row.status === "saved" && row.savedId && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/documents/extract/${row.savedId}/summary`} target="_blank" />}
                  >
                    View
                  </Button>
                )}
                {row.status === "error" && (
                  <span className="text-xs text-destructive">{row.error}</span>
                )}
                {row.status === "pending" && !isRunning && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`Remove ${row.file.name}`}
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {rateLimited && (
          <Alert className="border-accent-orange/30 bg-accent-orange/10 *:[svg]:text-accent-orange">
            <AlertTitle>Paused — extraction rate limit reached</AlertTitle>
            <AlertDescription>
              The remaining {pendingCount} file{pendingCount === 1 ? "" : "s"} are still queued. Wait a
              few minutes, then click Start again to continue.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button disabled={isRunning || pendingCount === 0} onClick={handleStart}>
          {isRunning ? (
            <>
              <Loader2 className="animate-spin" /> Processing…
            </>
          ) : (
            <>
              <Play /> Start bulk extraction ({pendingCount})
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
