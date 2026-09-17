import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentList } from "@/components/document-list";
import { DocumentSearch } from "@/components/document-search";
import { IconChip } from "@/components/icon-chip";
import { PaginationControls } from "@/components/pagination-controls";
import { listPolicies } from "@/lib/policy/store";

const PAGE_SIZE = 10;

// Always reflects live catalog state from Postgres — never baked as a
// static snapshot at build/deploy time.
export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const page = Math.max(1, Number(params.page) || 1);

  const { items: policies, total } = await listPolicies({ page, pageSize: PAGE_SIZE, query });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-1.5">
          <div className="flex items-center gap-2.5">
            <IconChip icon={FileText} color="teal" />
            <p className="text-sm font-medium text-muted-foreground">Document Library</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Ingested coverage policies</h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} polic{total === 1 ? "y" : "ies"} ingested. Search is
            full-text indexed, so it scales to a large catalog — the same index backs the New
            Request drug picker.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/documents/new" />}>
          <Plus /> Add document
        </Button>
      </header>

      <DocumentSearch defaultQuery={query} />

      {policies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-teal/20 to-accent-blue/20">
              <FileText className="size-6 text-accent-teal" />
            </span>
            {query ? `No policies match "${query}".` : "No policy documents yet. Add one to get started."}
          </CardContent>
        </Card>
      ) : (
        <>
          <DocumentList policies={policies} />
          <PaginationControls page={page} totalPages={totalPages} query={query} />
        </>
      )}
    </div>
  );
}
