import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { SobDocument } from "@/components/sob-document";
import { getExtractionDraft } from "../../actions";
import { buildSobViewModel } from "@/lib/policy/sob-view-model";

export const dynamic = "force-dynamic";

export default async function ExtractionSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;
  const draft = await getExtractionDraft(id);
  if (!draft) notFound();

  const model = buildSobViewModel(draft.data);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sob-no-print mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/documents/extract"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to extraction
        </Link>
        <PrintButton autoPrint={print === "1"} />
      </div>
      <div className="bg-white py-6 shadow-sm">
        <SobDocument model={model} />
      </div>
    </div>
  );
}
