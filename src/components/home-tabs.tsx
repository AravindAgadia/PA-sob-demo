"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { deleteEnrollmentDraft, getEnrollmentById } from "@/app/enroll/actions";
import { getCase } from "@/app/cases/actions";
import { CaseDetail } from "@/components/cases/case-detail";
import { CaseList } from "@/components/cases/case-list";
import { EnrollWizard } from "@/components/enroll/enroll-wizard";
import { EnrollmentList } from "@/components/enroll/enrollment-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CaseRecord, CaseSummary } from "@/lib/case-store";
import type { EnrollmentRecord, EnrollmentSummary } from "@/lib/enrollment-store";

type TabValue = "enrollments" | "cases" | "new-enrollment";

export function HomeTabs({
  initialEnrollments,
  initialCases,
}: {
  initialEnrollments: EnrollmentSummary[];
  initialCases: CaseSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabValue>("enrollments");
  const [wizardKey, setWizardKey] = useState(0);
  const [resumeEnrollment, setResumeEnrollment] = useState<EnrollmentRecord | undefined>();
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [isLoading, startLoading] = useTransition();

  function handleResume(id: string) {
    startLoading(async () => {
      const record = await getEnrollmentById(id);
      if (record) {
        setResumeEnrollment(record);
        setWizardKey((k) => k + 1);
        setTab("new-enrollment");
      }
    });
  }

  function openCase(caseNumber: string) {
    startLoading(async () => {
      const record = await getCase(caseNumber);
      if (record) {
        setSelectedCase(record);
        setTab("cases");
      }
    });
  }

  function handleSubmitted() {
    setResumeEnrollment(undefined);
    setWizardKey((k) => k + 1);
    setSelectedCase(null);
    setTab("enrollments");
    router.refresh();
  }

  function handleDraftSaved() {
    setResumeEnrollment(undefined);
    setWizardKey((k) => k + 1);
    setTab("enrollments");
    router.refresh();
  }

  function handleStartFresh() {
    setResumeEnrollment(undefined);
    setWizardKey((k) => k + 1);
    setTab("new-enrollment");
  }

  function handleDeleteDraft(id: string) {
    startLoading(async () => {
      await deleteEnrollmentDraft(id);
      router.refresh();
    });
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as TabValue)}
      orientation="vertical"
      className="flex items-start gap-6"
    >
      <div className="w-48 shrink-0 space-y-2">
        <TabsList>
          <TabsTrigger value="enrollments">Drafts</TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="new-enrollment">New Enrollment</TabsTrigger>
        </TabsList>
        {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="min-w-0 flex-1">
        <TabsContent value="enrollments">
          <div className="mb-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={handleStartFresh}>
              <Plus /> New enrollment
            </Button>
          </div>
          <EnrollmentList
            enrollments={initialEnrollments}
            onResume={handleResume}
            onViewCase={openCase}
            onDelete={handleDeleteDraft}
          />
        </TabsContent>

        <TabsContent value="cases">
          {selectedCase ? (
            <CaseDetail initialCase={selectedCase} onBack={() => setSelectedCase(null)} />
          ) : (
            <CaseList cases={initialCases} onOpen={openCase} />
          )}
        </TabsContent>

        <TabsContent value="new-enrollment">
          <EnrollWizard
            key={wizardKey}
            initialEnrollment={resumeEnrollment}
            onSubmitted={handleSubmitted}
            onDraftSaved={handleDraftSaved}
          />
        </TabsContent>
      </div>
    </Tabs>
  );
}
