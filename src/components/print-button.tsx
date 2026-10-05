"use client";

import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** `autoPrint` opens the print dialog on arrival — used by the Document
 *  Library's "Download" button so clicking it feels like a direct
 *  download rather than a second click once the page loads. A browser
 *  can't write a file to disk with zero interaction (true of every
 *  browser, not something any code here can route around), so "Save as
 *  PDF" in that dialog is still the one unavoidable manual step. */
export function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (autoPrint && !firedRef.current) {
      firedRef.current = true;
      window.print();
    }
  }, [autoPrint]);

  return (
    <Button variant="outline" size="sm" className="sob-no-print" onClick={() => window.print()}>
      <Printer /> Print / Save as PDF
    </Button>
  );
}
