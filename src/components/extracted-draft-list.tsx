import Link from "next/link";
import { Download, Eye, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/icon-chip";
import type { ExtractedDraftSummary } from "@/lib/policy/extraction-store";

/**
 * Drafts from the AI extraction pipeline (/documents/extract) — a
 * separate table from the ingested-policy list below (store.ts's
 * `policies`), so this is a read-only, View/Download-only presentation of
 * that data, not something merged row-for-row into the other list.
 */
export function ExtractedDraftList({ drafts }: { drafts: ExtractedDraftSummary[] }) {
  if (drafts.length === 0) return null;

  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center gap-2.5">
        <IconChip icon={Sparkles} color="purple" />
        <p className="text-sm font-medium text-muted-foreground">
          Extracted drafts ({drafts.length})
        </p>
      </div>
      <div className="space-y-3">
        {drafts.map((draft) => (
          <Card key={draft.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2.5 text-base">
                {draft.drugLabel}
                <Badge variant="secondary">{draft.payer}</Badge>
                <Badge
                  variant={draft.status === "draft" ? "outline" : "destructive"}
                  className="text-[10px]"
                >
                  {draft.status}
                </Badge>
              </CardTitle>
              <CardDescription>
                Extracted {new Date(draft.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/documents/extract/${draft.id}/summary`} target="_blank" />}
              >
                <Eye /> View
              </Button>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/documents/extract/${draft.id}/summary?print=1`} target="_blank" />}
              >
                <Download /> Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
