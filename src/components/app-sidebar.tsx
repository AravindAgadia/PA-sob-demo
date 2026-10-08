"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, LayoutGrid, ShieldCheck, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/enrollments", label: "Enrollment", icon: UserPlus },
  { href: "/cases", label: "Case Status", icon: ClipboardList },
  { href: "/documents", label: "Documents", icon: FileText },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-background">
      <Link href="/" className="flex items-center gap-2 border-b px-4 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple text-white shadow-sm">
          <ShieldCheck className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold tracking-tight">Policy Matrix</span>
            <Badge variant="secondary" className="text-[10px]">
              Demo
            </Badge>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            Prior Authorization Platform
          </span>
        </span>
      </Link>

      <nav className="flex flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-l-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
