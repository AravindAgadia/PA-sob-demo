"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { searchPolicies } from "@/app/documents/actions";
import type { PolicySummary } from "@/lib/policy/types";

/**
 * Server-searched, single-select combobox for picking an ingested policy by
 * drug/payer — scales to a large catalog since it never loads the whole
 * list client-side, only the current query's top matches (FTS-indexed).
 */
export function DrugCombobox({
  selected,
  onSelect,
  initialOptions,
}: {
  selected: PolicySummary | null;
  onSelect: (item: PolicySummary | null) => void;
  initialOptions: PolicySummary[];
}) {
  const [searchResults, setSearchResults] = useState<PolicySummary[]>(initialOptions);
  const [searchValue, setSearchValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Keep the currently selected item visible in the list even if it falls
  // out of the latest search results.
  const items = useMemo(() => {
    if (!selected || searchResults.some((p) => p.id === selected.id)) return searchResults;
    return [...searchResults, selected];
  }, [searchResults, selected]);

  const trimmed = searchValue.trim();
  const status = isPending ? "Searching…" : error ? error : null;

  return (
    <Combobox.Root
      items={items}
      value={selected}
      itemToStringLabel={(item: PolicySummary) => `${item.drug} · ${item.payer} / ${item.lineOfBusiness}`}
      isItemEqualToValue={(item, value) => item.id === value.id}
      filter={null}
      onOpenChangeComplete={(open) => {
        if (!open && selected) setSearchResults([selected]);
      }}
      onValueChange={(next) => {
        onSelect(next);
        setSearchValue("");
        setError(null);
      }}
      onInputValueChange={(next, { reason }) => {
        setSearchValue(next);
        if (reason === "item-press") return;

        if (next.trim() === "") {
          setSearchResults(initialOptions);
          setError(null);
          return;
        }

        const controller = new AbortController();
        abortControllerRef.current?.abort();
        abortControllerRef.current = controller;

        startTransition(async () => {
          setError(null);
          try {
            const results = await searchPolicies(next);
            if (controller.signal.aborted) return;
            setSearchResults(results);
          } catch {
            if (!controller.signal.aborted) setError("Search failed. Try again.");
          }
        });
      }}
    >
      <Combobox.InputGroup className="relative flex h-9 w-full items-center rounded-md border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        <Search className="ml-2.5 size-3.5 shrink-0 text-muted-foreground" />
        <Combobox.Input
          placeholder="Search ingested policies by drug or payer…"
          className="h-full w-full min-w-0 border-0 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="mr-1 flex shrink-0 items-center gap-0.5">
          <Combobox.Clear
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </Combobox.Clear>
          <Combobox.Trigger
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
            aria-label="Toggle suggestions"
          >
            <ChevronDown className="size-3.5" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50" sideOffset={4}>
          <Combobox.Popup
            className="max-h-(--available-height) w-(--anchor-width) overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
            aria-busy={isPending || undefined}
          >
            {status && (
              <Combobox.Status className="px-2 py-1.5 text-xs text-muted-foreground">
                {status}
              </Combobox.Status>
            )}
            <Combobox.Empty className="px-2 py-1.5 text-xs text-muted-foreground">
              {trimmed ? `No policies match "${trimmed}".` : "No ingested policies yet."}
            </Combobox.Empty>
            <Combobox.List>
              {(item: PolicySummary) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  className="relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-sm outline-none select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <Combobox.ItemIndicator className="absolute left-2 flex size-4 items-center justify-center text-primary">
                    <Check className="size-3.5" />
                  </Combobox.ItemIndicator>
                  <span className="flex flex-col">
                    <span className="font-medium">{item.drug}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.payer} / {item.lineOfBusiness} &middot; {item.criteriaCount} criteria
                    </span>
                  </span>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
