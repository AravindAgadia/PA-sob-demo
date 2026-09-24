"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconChip } from "@/components/icon-chip";
import { log } from "@/lib/log";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Client component — this only ever reaches the browser console, not a
  // server log. Wiring it to a real error-tracking service (Sentry, etc.)
  // is the natural next step once this stops being a demo.
  useEffect(() => {
    log.error("Unhandled render error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center sm:px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2.5">
            <IconChip icon={AlertTriangle} color="orange" />
            Something went wrong
          </CardTitle>
          <CardDescription>
            This request hit an unexpected error. Try again, or start over if the problem
            persists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}
