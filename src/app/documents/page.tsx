import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExtractedDraftList } from "@/components/extracted-draft-list";
import { IconChip } from "@/components/icon-chip";
import { listExtractionDrafts } from "./extract/actions";

// Always reflects live draft state from Postgres — never baked as a
// static snapshot at build/deploy time.
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const extractedDrafts = await listExtractionDrafts();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-1.5">
          <div className="flex items-center gap-2.5">
            <IconChip icon={FileText} color="teal" />
            <p className="text-sm font-medium text-muted-foreground">Document Library</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Extracted policies</h1>
          <p className="text-sm text-muted-foreground">
            Upload a payer coverage-policy PDF to get a cited, condition-by-condition draft —
            each criterion carries the exact quote and page it came from, checked against the
            source text.
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/documents/extract" />}>
          <Sparkles /> Extract from PDF
        </Button>
      </header>

      {extractedDrafts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-teal/20 to-accent-blue/20">
              <FileText className="size-6 text-accent-teal" />
            </span>
            No extracted policies yet — click &ldquo;Extract from PDF&rdquo; to get started.
          </CardContent>
        </Card>
      ) : (
        <ExtractedDraftList drafts={extractedDrafts} />
      )}
    </div>
  );
}
