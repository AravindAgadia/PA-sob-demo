"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function buildUrl(pathname: string, query: string): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Debounced search box that drives the Document Library's URL — the page
 *  itself (a Server Component) re-reads `?q=` and re-queries FTS. */
export function DocumentSearch({ defaultQuery }: { defaultQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultQuery);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      router.push(buildUrl(pathname, value));
    }, 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // Only re-run when the typed value changes — router/pathname are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative mb-6">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by drug, payer, or criteria text…"
        className="pl-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => setValue("")}
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}
