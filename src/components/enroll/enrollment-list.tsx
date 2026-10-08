"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Flag, Search, SquarePen, Trash2 } from "lucide-react";
import { deleteEnrollmentDraft } from "@/app/enroll/actions";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PatientAvatar } from "@/components/patient-avatar";
import type { EnrollmentSummary } from "@/lib/enrollment-store";

export function EnrollmentList({ enrollments }: { enrollments: EnrollmentSummary[] }) {
  const router = useRouter();
  const [, startDeleting] = useTransition();
  const [query, setQuery] = useState("");

  function handleDelete(id: string) {
    startDeleting(async () => {
      await deleteEnrollmentDraft(id);
      router.refresh();
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter(
      (e) => e.patientName.toLowerCase().includes(q) || e.draftNumber.toLowerCase().includes(q)
    );
  }, [enrollments, query]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patient or enrollment ID"
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {enrollments.length === 0
              ? "No drafts yet — start one with New Enrollment."
              : "No drafts match that search."}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Enrollment ID</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Urgency</th>
                <th className="px-3 py-2 font-medium">Created At</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((e) => (
                <tr key={e.id} className="align-middle">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <PatientAvatar name={e.patientName || "Unnamed patient"} />
                      <span className="font-medium whitespace-nowrap">
                        {e.patientName || "Unnamed patient"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="border-accent-green/40 font-mono text-accent-green">
                      {e.draftNumber}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="secondary">
                      <FileText /> Draft
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-accent-blue">
                      <Flag /> {e.urgency || "Not Urgent"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                    {new Date(e.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/enrollments/new?resume=${e.id}`} />}
                      >
                        <SquarePen /> Continue Editing
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete draft ${e.draftNumber}`} />
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {e.draftNumber} for {e.patientName || "this patient"} will be permanently
                            deleted. This can&apos;t be undone.
                          </AlertDialogDescription>
                          <AlertDialogFooter>
                            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
                              Cancel
                            </AlertDialogClose>
                            <AlertDialogClose
                              render={<Button variant="destructive" size="sm" onClick={() => handleDelete(e.id)} />}
                            >
                              Delete
                            </AlertDialogClose>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
