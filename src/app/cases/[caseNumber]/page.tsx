import { notFound } from "next/navigation";
import { getCase } from "@/app/cases/actions";
import { CaseDetail } from "@/components/cases/case-detail";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ caseNumber: string }>;
}) {
  const { caseNumber } = await params;
  const caseRecord = await getCase(caseNumber);
  if (!caseRecord) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <CaseDetail initialCase={caseRecord} />
    </div>
  );
}
