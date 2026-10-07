"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { EnrollmentSummary } from "@/lib/enrollment-store";

export function EnrollmentList({
  enrollments,
  onResume,
  onViewCase,
}: {
  enrollments: EnrollmentSummary[];
  onResume: (id: string) => void;
  onViewCase: (caseNumber: string) => void;
}) {
  if (enrollments.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No drafts yet — start one from the New Enrollment tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {enrollments.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="font-mono text-xs text-muted-foreground">{e.draftNumber}</span>
          <span className="font-medium">{e.patientName || "Unnamed patient"}</span>
          {e.payer && <Badge variant="secondary">{e.payer}</Badge>}
          {e.drugLabel && <span className="text-muted-foreground">{e.drugLabel}</span>}
          <Badge variant={e.status === "draft" ? "outline" : "secondary"} className="text-[10px]">
            {e.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(e.updatedAt).toLocaleString()}
          </span>
          <div className="ml-auto flex gap-2">
            {e.status === "draft" ? (
              <Button variant="outline" size="sm" onClick={() => onResume(e.id)}>
                Resume
              </Button>
            ) : (
              e.caseNumber && (
                <Button variant="outline" size="sm" onClick={() => onViewCase(e.caseNumber!)}>
                  View {e.caseNumber}
                </Button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
