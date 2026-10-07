import type { ReactNode } from "react";
import { Separator } from "@/components/ui/separator";

/** Section divider matching the sectioned layout of each wizard step. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 sm:col-span-full mt-1 first:mt-0">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {children}
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
