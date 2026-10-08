"use client";

import { ListChecks } from "lucide-react";
import { IconChip } from "@/components/icon-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { FollowUpAnswers } from "@/lib/policy/types";
import { PA_QUESTIONS, type PaQuestion } from "./pa-questions";

function PaQuestionField({
  question,
  value,
  onChange,
}: {
  question: PaQuestion;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  if (question.type === "free-text") {
    return (
      <Textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type a response…"
        className="min-h-16"
      />
    );
  }

  if (question.type === "yes-no") {
    return (
      <div className="flex gap-2">
        {["Yes", "No"].map((opt) => (
          <Button
            key={opt}
            type="button"
            size="sm"
            variant={value === opt ? "default" : "outline"}
            onClick={() => onChange(opt)}
          >
            {opt}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <Select
      value={value ?? null}
      onValueChange={(v) => {
        if (v) onChange(v);
      }}
    >
      <SelectTrigger className="w-full max-w-md">
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        {question.options?.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Standard provider questionnaire shown once a case proceeds — the same
 * fixed question set for every drug (see pa-questions.ts), not derived
 * from the matched policy's own criteria.
 */
export function PaQuestionnaire({
  answers,
  onAnswersChange,
}: {
  answers: FollowUpAnswers;
  onAnswersChange: (next: FollowUpAnswers) => void;
}) {
  const answeredCount = PA_QUESTIONS.filter((q) => {
    const v = answers[q.id];
    return typeof v === "string" && v.trim().length > 0;
  }).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <IconChip icon={ListChecks} color="green" />
          Provider questions
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          Standard questionnaire for this request.
          <Badge variant="outline">
            {answeredCount} of {PA_QUESTIONS.length} answered
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {PA_QUESTIONS.map((question, i) => (
          <div key={question.id} className="py-4 first:pt-0 last:pb-0">
            <p className="text-sm font-medium">
              Q{i + 1} &middot; {question.prompt}
            </p>
            {question.notes && <p className="mt-0.5 text-xs text-muted-foreground">{question.notes}</p>}
            <div className="mt-2.5">
              <PaQuestionField
                question={question}
                value={typeof answers[question.id] === "string" ? (answers[question.id] as string) : undefined}
                onChange={(v) => onAnswersChange({ ...answers, [question.id]: v })}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
