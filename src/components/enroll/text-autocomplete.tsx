"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Shared typeahead shell for the wizard's small hardcoded reference
 *  lists (payers, ICD-10 codes, drugs) — typing filters `items`,
 *  selecting one calls `onSelect`; anything typed that doesn't match is
 *  kept as free text, since none of these lists are a real database. */
export function TextAutocomplete<T>({
  id,
  value,
  isInvalid,
  placeholder,
  items,
  filter,
  renderItem,
  onChangeText,
  onSelect,
  maxResults = 6,
}: {
  id?: string;
  value: string;
  isInvalid?: boolean;
  placeholder?: string;
  items: T[];
  filter: (item: T, query: string) => boolean;
  renderItem: (item: T) => ReactNode;
  onChangeText: (text: string) => void;
  onSelect: (item: T) => void;
  maxResults?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    return items.filter((item) => filter(item, query)).slice(0, maxResults);
  }, [value, items, filter, maxResults]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChangeText(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          placeholder={placeholder}
          aria-invalid={isInvalid}
          autoComplete="off"
          className="pl-8"
        />
      </div>
      {isOpen && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          {matches.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
                setIsOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
