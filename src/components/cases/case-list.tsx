"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Flag, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PatientAvatar } from "@/components/patient-avatar";
import { cn } from "cn";
import type { CaseStatusLabel, CaseSummary } from "@/lib/case-store";

const STATUS_DOT: Record<CaseStatusLabel, string> = {
  "Awaiting Response": "bg-accent-orange",
  Denied: "bg-destructive",
  "Awaiting Questionnaire": "bg-muted-foreground",
  "Coverage Determination Failed": "bg-destructive",
  Approved: "bg-accent-green",
};

const STATUS_TEXT: Record<CaseStatusLabel, string> = {
  "Awaiting Response": "text-accent-orange",
  Denied: "text-destructive",
  "Awaiting Questionnaire": "text-muted-foreground",
  "Coverage Determination Failed": "text-destructive",
  Approved: "text-accent-green",
};

function StatusBadge({ status }: { status: CaseStatusLabel }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", STATUS_TEXT[status])}>
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {status}
    </span>
  );
}

export function CaseList({ cases }: { cases: CaseSummary[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      const matchesQuery =
        !q || c.patientName.toLowerCase().includes(q) || c.caseNumber.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [cases, query, statusFilter]);

  if (cases.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No cases yet — submitting an enrollment creates one.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patient or case ID"
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v as string)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_DOT).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No cases match that search.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground uppercase">
                <th className="px-3 py-2 font-medium">Patient</th>
                <th className="px-3 py-2 font-medium">Case ID</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Urgency</th>
                <th className="px-3 py-2 font-medium">SLA Due</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr key={c.id} className="align-middle">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <PatientAvatar name={c.patientName || "Unnamed patient"} />
                      <span className="font-medium whitespace-nowrap">
                        {c.patientName || "Unnamed patient"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="font-mono">
                      {c.caseNumber}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{c.stage}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-accent-blue">
                      <Flag /> {c.urgency || "Not Urgent"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <span>{new Date(c.slaDueDate).toLocaleDateString()}</span>
                      {c.overdue && (
                        <Badge variant="destructive" className="w-fit text-[10px]">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/cases/${c.caseNumber}`}
                      aria-label={`View ${c.caseNumber}`}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Eye className="size-4" />
                    </Link>
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
