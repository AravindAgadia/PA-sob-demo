import { Check } from "lucide-react";
import { cn } from "cn";

export type StepStatus = "complete" | "current" | "upcoming";

/** Matches IconChipColor — a step is colored the same as the card it leads
 *  to, so the progress bar and the content underneath read as one system. */
export type StepColor = "blue" | "purple" | "pink" | "green" | "orange" | "teal";

export interface StepperStep {
  label: string;
  status: StepStatus;
  /** Defaults to blue when omitted. */
  color?: StepColor;
}

const COLOR_CLASSES: Record<StepColor, { solid: string; outline: string; connector: string }> = {
  blue: {
    solid: "bg-accent-blue text-white",
    outline: "border-accent-blue text-accent-blue",
    connector: "bg-accent-blue",
  },
  purple: {
    solid: "bg-accent-purple text-white",
    outline: "border-accent-purple text-accent-purple",
    connector: "bg-accent-purple",
  },
  pink: {
    solid: "bg-accent-pink text-white",
    outline: "border-accent-pink text-accent-pink",
    connector: "bg-accent-pink",
  },
  green: {
    solid: "bg-accent-green text-white",
    outline: "border-accent-green text-accent-green",
    connector: "bg-accent-green",
  },
  orange: {
    solid: "bg-accent-orange text-white",
    outline: "border-accent-orange text-accent-orange",
    connector: "bg-accent-orange",
  },
  teal: {
    solid: "bg-accent-teal text-white",
    outline: "border-accent-teal text-accent-teal",
    connector: "bg-accent-teal",
  },
};

export function Stepper({ steps }: { steps: StepperStep[] }) {
  return (
    <ol className="flex flex-nowrap items-center" aria-label="Progress">
      {steps.map((step, index) => {
        const c = COLOR_CLASSES[step.color ?? "blue"];
        return (
          <li key={step.label} className="flex shrink-0 items-center">
            <div className="flex items-center gap-1">
              <span
                aria-hidden
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors sm:size-6 sm:text-[11px]",
                  step.status === "complete" && c.solid,
                  step.status === "current" && cn("border-2", c.outline),
                  step.status === "upcoming" && "border border-border text-muted-foreground"
                )}
              >
                {step.status === "complete" ? <Check className="size-3 sm:size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] font-medium whitespace-nowrap sm:text-xs",
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
                  "mx-1.5 h-px w-3 shrink-0 sm:w-6",
                  step.status === "complete" ? c.connector : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
