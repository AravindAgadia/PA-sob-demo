import Link from "next/link";
import { Button } from "@/components/ui/button";

function hrefFor(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/documents?${qs}` : "/documents";
}

export function PaginationControls({
  page,
  totalPages,
  query,
}: {
  page: number;
  totalPages: number;
  query: string;
}) {
  if (totalPages <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="mt-6 flex items-center justify-between">
      <Button
        variant="outline"
        size="sm"
        disabled={!hasPrevious}
        nativeButton={!hasPrevious}
        render={hasPrevious ? <Link href={hrefFor(query, page - 1)} /> : undefined}
      >
        Previous
      </Button>
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasNext}
        nativeButton={!hasNext}
        render={hasNext ? <Link href={hrefFor(query, page + 1)} /> : undefined}
      >
        Next
      </Button>
    </div>
  );
}
