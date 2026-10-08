import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** A label/value row with an optional right-aligned source tag — shared
 *  by the Patient Eligibility & Case Summary cards. */
export function LabeledRow({ label, value, tag }: { label: string; value: ReactNode; tag?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="w-36 shrink-0 text-sm font-semibold text-primary">{label}</span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
      {tag && (
        <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
          {tag}
        </Badge>
      )}
    </div>
  );
}
