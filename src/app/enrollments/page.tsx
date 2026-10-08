import Link from "next/link";
import { Plus } from "lucide-react";
import { listEnrollmentSummaries } from "@/app/enroll/actions";
import { EnrollmentList } from "@/components/enroll/enrollment-list";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EnrollmentsPage() {
  const enrollments = await listEnrollmentSummaries();
  const drafts = enrollments.filter((e) => e.status === "draft");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Enrollment</h1>
          <p className="text-sm text-muted-foreground">
            Enrollments still in progress — accepted enrollments become Cases, tracked under Case
            Status.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/enrollments/new" />}>
          <Plus /> New Enrollment
        </Button>
      </header>
      <EnrollmentList enrollments={drafts} />
    </div>
  );
}
