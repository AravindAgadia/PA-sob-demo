import { Check } from "lucide-react";
import { cn } from "cn";

export type StepStatus = "complete" | "current" | "upcoming";

export interface StepperStep {
  label: string;
  status: StepStatus;
}

export function Stepper({ steps }: { steps: StepperStep[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-3" aria-label="Progress">
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors sm:size-6 sm:text-xs",
                step.status === "complete" && "bg-primary text-primary-foreground",
                step.status === "current" && "border-2 border-primary text-primary",
                step.status === "upcoming" && "border border-border text-muted-foreground"
              )}
            >
              {step.status === "complete" ? <Check className="size-3 sm:size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium whitespace-nowrap sm:text-sm",
                step.status === "upcoming" ? "text-muted-foreground" : "text-foreground"
              )}
              aria-current={step.status === "current" ? "step" : undefined}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                "mx-2 h-px w-4 shrink-0 sm:w-8",
                step.status === "complete" ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
