import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import type { CriterionStatus } from "@/lib/policy/types";

const STATUS_CONFIG: Record<CriterionStatus, { label: string; className: string }> = {
  confirmed: {
    label: "Confirmed",
    className:
      "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  "not-met": {
    label: "Not met",
    className: "bg-red-600/10 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  },
  "needs-info": {
    label: "Needs information",
    className:
      "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
};

export function StatusBadge({ status }: { status: CriterionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("border-transparent", config.className)}>
      {config.label}
    </Badge>
  );
}
