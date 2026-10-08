import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildSampleCostShare } from "@/lib/policy/cost-share-sample";
import type { EligibilityResult, IntakeData } from "@/lib/policy/types";

function formatMoney(n: number): string {
  return `$${n.toLocaleString()}`;
}

function Row({ label, value, tag }: { label: string; value: ReactNode; tag: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="w-36 shrink-0 text-sm font-semibold text-primary">{label}</span>
        <span className="text-sm text-foreground">{value}</span>
      </div>
      <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
        {tag}
      </Badge>
    </div>
  );
}

/**
 * Patient identity (real, from intake) plus cost-share figures (sample —
 * the mock 271 check always returns zeros, so these numbers are for
 * layout only). A standalone card rather than part of the printable
 * Summary of Benefits document, so it's visible immediately above it
 * instead of requiring a scroll into that document's own Section 1.
 */
export function PatientEligibilityCard({
  intake,
  eligibility,
}: {
  intake: IntakeData;
  eligibility?: EligibilityResult | null;
}) {
  const cost = buildSampleCostShare(intake.insuranceId || `${intake.patientFirstName}${intake.patientLastName}`);
  const year = new Date().getFullYear();
  const lineOfBusiness = eligibility?.lineOfBusiness || "Commercial";
  const planType = eligibility?.planType || "employer group";
  const benefitType = intake.buyAndBill
    ? "Medical benefit · specialty drug (buy-and-bill)"
    : "Pharmacy benefit · specialty drug";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-sm font-semibold tracking-wide uppercase">
          1 &middot; Patient Eligibility &amp; Cost Share
        </CardTitle>
        <span className="text-xs text-muted-foreground">Sample 271 response &middot; dummy data for layout only</span>
      </CardHeader>
      <CardContent className="divide-y">
        <Row
          label="Member"
          tag="Patient · 271"
          value={`${intake.patientFirstName} ${intake.patientLastName} · DOB ${intake.patientDob || "—"} · Member ID ${intake.insuranceId || "—"}`}
        />
        <Row
          label="Eligibility"
          tag="Sample · 271"
          value={`${eligibility?.active === false ? "Inactive" : "Active"} · coverage 01/01/${year} – 12/31/${year}`}
        />
        <Row
          label="Plan / LOB"
          tag="Sample · 271"
          value={`${intake.payer} · ${lineOfBusiness}, ${planType} · Group ${cost.groupNumber}`}
        />
        <Row label="Benefit type" tag="Patient · 271" value={benefitType} />
        <Row label="Network" tag="Sample · 271" value="Prescriber and site of care in network" />
        <Row
          label="Deductible"
          tag="Sample · 271"
          value={`In network ${formatMoney(cost.deductibleLimit)} individual - ${formatMoney(cost.deductibleMet)} met - ${formatMoney(cost.deductibleRemaining)} remaining. Out of network ${formatMoney(cost.oonDeductibleLimit)}`}
        />
        <Row
          label="Coinsurance · copay"
          tag="Sample · 271"
          value={`${cost.coinsurancePercent}% after deductible in network (${cost.oonCoinsurancePercent}% out of network) - ${formatMoney(cost.copay)} specialist visit copay`}
        />
        <Row
          label="Out-of-pocket max"
          tag="Sample · 271"
          value={`In network ${formatMoney(cost.oopMaxLimit)} individual - ${formatMoney(cost.oopMaxMet)} met - ${formatMoney(cost.oopMaxRemaining)} remaining. Out of network ${formatMoney(cost.oonOopMaxLimit)}`}
        />
      </CardContent>
    </Card>
  );
}
