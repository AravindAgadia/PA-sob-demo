import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { IconChip } from "@/components/icon-chip";
import { ExtractWorkspace } from "@/components/extract-workspace";
import { listExtractionDrafts } from "./actions";

export const dynamic = "force-dynamic";
/** A full extraction run (PDF transcription + a header pass + one pass per
 *  condition) can genuinely take several minutes for a large policy —
 *  this raises Vercel's function-duration limit for Server Actions
 *  invoked from this page well above the platform default (10s), which
 *  would otherwise kill a long run outright rather than just make it
 *  feel slow. (A route-segment config value like this can't live in the
 *  "use server" actions file itself — that directive only allows async
 *  function exports, and silently strips every export, including
 *  unrelated ones, if anything else is exported alongside them.) Caps
 *  lower than requested depending on plan: Hobby hard-caps at 60s
 *  regardless of this value, Pro defaults to 300s (up to 800s with Fluid
 *  Compute) — if this app is on Hobby, a 19-condition policy like Botox
 *  will still time out, since that plan ceiling isn't something code can
 *  raise. */
export const maxDuration = 300;

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
          criterion carries the exact quote and page it came from, checked against the source text.
        </p>
      </header>
      <ExtractWorkspace initialDrafts={drafts} />
    </div>
  );
}
