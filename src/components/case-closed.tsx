import { Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/icon-chip";
import type { PolicyDocument } from "@/lib/policy/types";

export function CaseClosed({
  policy,
  reason,
  closedAt,
}: {
  policy: PolicyDocument;
  reason?: string;
  closedAt: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <IconChip icon={Ban} color="orange" />
          Case closed
        </CardTitle>
        <CardDescription>Not submitted for prior authorization.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Badge variant="outline" className="border-transparent bg-accent-orange/15 text-accent-orange">
          Declined at Summary of Benefits
        </Badge>
        <p>
          The requesting office reviewed the Summary of Benefits for {policy.drug} (
          {policy.payer}) and chose not to proceed. No questions were sent to the provider, and
          this request was not submitted for prior authorization.
        </p>
        {reason && (
          <p>
            <span className="text-muted-foreground">Reason noted:</span> {reason}
          </p>
        )}
        <p className="text-xs text-muted-foreground">Closed {new Date(closedAt).toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
