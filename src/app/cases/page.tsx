import { listCases } from "@/app/cases/actions";
import { CaseList } from "@/components/cases/case-list";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const cases = await listCases();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-4 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Case Status</h1>
        <p className="text-sm text-muted-foreground">Monitor and manage all active patient cases.</p>
      </header>
      <CaseList cases={cases} />
    </div>
  );
}
