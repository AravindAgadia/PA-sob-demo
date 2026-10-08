import type { ReactNode } from "react";
import { LabeledRow } from "@/components/labeled-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnrollmentData, PostalAddress } from "@/components/enroll/types";

function formatAddress(address: PostalAddress): string {
  const street = [address.line1, address.line2].filter(Boolean).join(" ");
  const cityStateZip = [address.city, [address.state, address.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [street, cityStateZip].filter(Boolean).join(", ") || "—";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      <div className="divide-y rounded-lg border px-3">{children}</div>
    </div>
  );
}

/**
 * Read-only recap of everything collected on the enrollment wizard — not
 * just the narrower IntakeData a case stores for policy matching. Shown
 * on the Complete screen so the requesting office can see exactly what
 * was submitted while the payer's decision is pending.
 */
export function CaseSummaryCard({ data }: { data: EnrollmentData }) {
  const { payerPatient, prescriber, drug, servicingProvider } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold tracking-wide uppercase">Case Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Section title="Patient & Payer">
          <LabeledRow
            label="Patient"
            value={`${payerPatient.patientFirstName} ${payerPatient.patientLastName} · DOB ${payerPatient.patientDob || "—"}${payerPatient.patientGender ? ` · ${payerPatient.patientGender}` : ""}`}
          />
          <LabeledRow label="Member ID" value={payerPatient.memberId || "—"} />
          <LabeledRow label="Payer" value={payerPatient.payer || "—"} />
          <LabeledRow label="Urgency" value={payerPatient.urgency || "Routine"} />
          <LabeledRow label="Patient address" value={formatAddress(payerPatient.patientAddress)} />
        </Section>

        <Section title="Drug & Diagnosis">
          <LabeledRow label="Drug" value={drug.drugDescription || "—"} />
          <LabeledRow label="NDC · HCPCS" value={`${drug.ndc || "—"} · ${drug.hcpcsCode || "—"}`} />
          <LabeledRow label="Route" value={drug.routeOfAdministration || "—"} />
          <LabeledRow label="Directions" value={drug.directions || "—"} />
          <LabeledRow label="Days supply · Qty" value={`${drug.daysSupply || "—"} · ${drug.quantity || "—"}`} />
          <LabeledRow label="Bill under" value={drug.billUnder} />
          <LabeledRow
            label="Diagnosis"
            value={`${drug.diagnosis || "—"}${drug.icd10Code ? ` (${drug.icd10Code})` : ""}`}
          />
          <LabeledRow label="Start of service" value={drug.startDateOfService || "—"} />
          <LabeledRow label="Dispensing location" value={drug.dispensingLocation || "—"} />
        </Section>

        <Section title="Prescriber">
          <LabeledRow label="Name" value={`${prescriber.firstName} ${prescriber.lastName}`.trim() || "—"} />
          <LabeledRow label="NPI" value={prescriber.npi || "—"} />
          <LabeledRow
            label="License"
            value={`${prescriber.licenseNumber || "—"}${prescriber.licenseState ? ` (${prescriber.licenseState})` : ""}`}
          />
          <LabeledRow label="Contact" value={`${prescriber.phone || "—"} · ${prescriber.email || "—"}`} />
          <LabeledRow label="Address" value={formatAddress(prescriber.address)} />
        </Section>

        <Section title="Servicing Provider">
          {servicingProvider.sameAsPrescriber ? (
            <LabeledRow label="Servicing provider" value="Same as prescriber" />
          ) : (
            <>
              <LabeledRow
                label="Name"
                value={`${servicingProvider.firstName} ${servicingProvider.lastName}`.trim() || "—"}
              />
              <LabeledRow label="NPI" value={servicingProvider.npi || "—"} />
              <LabeledRow label="Contact" value={`${servicingProvider.phone || "—"} · ${servicingProvider.fax || "—"}`} />
            </>
          )}
        </Section>
      </CardContent>
    </Card>
  );
}
