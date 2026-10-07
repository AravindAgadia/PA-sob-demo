import { listEnrollmentSummaries } from "@/app/enroll/actions";
import { listCases } from "@/app/cases/actions";
import { HomeTabs } from "@/components/home-tabs";

// Enrollment/case lists are live Postgres state — never a static
// snapshot baked at build/deploy time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [enrollments, cases] = await Promise.all([listEnrollmentSummaries(), listCases()]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Prior Authorization</p>
        <h1 className="text-xl font-semibold tracking-tight">Enrollments &amp; Cases</h1>
      </header>
      <HomeTabs initialEnrollments={enrollments} initialCases={cases} />
    </main>
  );
}
