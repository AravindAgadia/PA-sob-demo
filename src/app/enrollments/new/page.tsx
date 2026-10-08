import { getEnrollmentById } from "@/app/enroll/actions";
import { EnrollWizard } from "@/components/enroll/enroll-wizard";

export const dynamic = "force-dynamic";

export default async function NewEnrollmentPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const { resume } = await searchParams;
  const initialEnrollment = resume ? await getEnrollmentById(resume) : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">New Enrollment</h1>
      </header>
      <EnrollWizard initialEnrollment={initialEnrollment} />
    </div>
  );
}
