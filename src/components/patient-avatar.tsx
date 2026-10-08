import { cn } from "cn";
import type { IconChipColor } from "@/components/icon-chip";

const COLOR_CLASSES: Record<IconChipColor, string> = {
  blue: "bg-accent-blue",
  purple: "bg-accent-purple",
  pink: "bg-accent-pink",
  green: "bg-accent-green",
  orange: "bg-accent-orange",
  teal: "bg-accent-teal",
};

const COLORS = Object.keys(COLOR_CLASSES) as IconChipColor[];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Deterministic color from the name itself, so the same patient always
 *  gets the same avatar color across renders/lists without storing one. */
function colorOf(name: string): IconChipColor {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

export function PatientAvatar({ name, className }: { name: string; className?: string }) {
  const label = name.trim() || "Unknown";
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
        COLOR_CLASSES[colorOf(label)],
        className
      )}
    >
      {initialsOf(label)}
    </span>
  );
}
