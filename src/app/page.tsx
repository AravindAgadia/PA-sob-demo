import Link from "next/link";
import { FolderOpen, UserPlus } from "lucide-react";
import { listCases } from "@/app/cases/actions";
import { CaseList } from "@/components/cases/case-list";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: typeof UserPlus;
  title: string;
  subtitle: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center gap-3 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-medium">{title}</span>
            <span className="block text-xs text-muted-foreground">{subtitle}</span>
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

export default async function Home() {
  const cases = await listCases();
  const closed = cases.filter((c) => c.decision === "declined").length;
  const ongoing = cases.length - closed;
  const recent = cases.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total Cases" value={cases.length} hint="Overall caseload" />
        <StatCard label="Ongoing Cases" value={ongoing} hint="Open" />
        <StatCard label="Closed Cases" value={closed} hint="Closed" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <QuickAction href="/enrollments/new" icon={UserPlus} title="New Enrollment" subtitle="Create patient" />
        <QuickAction href="/enrollments" icon={FolderOpen} title="View Drafts" subtitle="In progress" />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Recent Cases</h2>
          <Link href="/cases" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        <CaseList cases={recent} />
      </div>
    </div>
  );
}
