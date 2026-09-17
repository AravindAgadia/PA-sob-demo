import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentForm } from "@/components/document-form";

export default function NewDocumentPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/documents" />}>
          <ArrowLeft /> Back to library
        </Button>
      </div>
      <header className="mb-8 space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">Document Library</p>
        <h1 className="text-2xl font-semibold tracking-tight">Add a coverage policy</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Fill in the policy metadata and criteria manually for now — every ingested document
          uses the same structure, so this same form works for any drug or payer.
        </p>
      </header>
      <DocumentForm />
    </div>
  );
}
