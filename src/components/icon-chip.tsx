import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

const COLOR_CLASSES = {
  blue: "bg-gradient-to-br from-accent-blue to-accent-blue/70",
  purple: "bg-gradient-to-br from-accent-purple to-accent-purple/70",
  pink: "bg-gradient-to-br from-accent-pink to-accent-pink/70",
  green: "bg-gradient-to-br from-accent-green to-accent-green/70",
  orange: "bg-gradient-to-br from-accent-orange to-accent-orange/70",
  teal: "bg-gradient-to-br from-accent-teal to-accent-teal/70",
} as const;

export type IconChipColor = keyof typeof COLOR_CLASSES;

export function IconChip({
  icon: Icon,
  color = "blue",
  className,
}: {
  icon: LucideIcon;
  color?: IconChipColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
        COLOR_CLASSES[color],
        className
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}
