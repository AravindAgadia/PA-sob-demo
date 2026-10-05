import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { IconChip } from "@/components/icon-chip";
import { ExtractWorkspace } from "@/components/extract-workspace";
import { listExtractionDrafts } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExtractPage() {
  const drafts = await listExtractionDrafts();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/documents"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Document Library
      </Link>
      <header className="mb-8 space-y-1.5">
        <div className="flex items-center gap-2.5">
          <IconChip icon={Sparkles} color="purple" />
          <p className="text-sm font-medium text-muted-foreground">AI policy extraction</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Extract a policy into a structured draft</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Turns a payer&apos;s coverage-policy PDF into a cited, condition-by-condition draft — each
          criterion carries the exact quote and page it came from, checked against the source text. This
          is a separate, newer pipeline from the Document Library&apos;s manual &ldquo;Add
          document&rdquo; form; saved drafts here aren&apos;t yet wired into live request matching.
        </p>
      </header>
      <ExtractWorkspace initialDrafts={drafts} />
    </div>
  );
}
