import type { LucideIcon } from "lucide-react";
import { Building2, ClipboardList, Pill, Stethoscope, User } from "lucide-react";
import type { ReactNode } from "react";
import { IconChip, type IconChipColor } from "@/components/icon-chip";
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

function Section({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: LucideIcon;
  color: IconChipColor;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2.5 border-b bg-muted/30 px-3 py-2.5">
        <IconChip icon={icon} color={color} />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="divide-y px-3">{children}</div>
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
        <CardTitle className="flex items-center gap-2.5">
          <IconChip icon={ClipboardList} color="blue" />
          Case Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Section title="Patient & Payer" icon={User} color="blue">
          <LabeledRow
            label="Patient"
            value={`${payerPatient.patientFirstName} ${payerPatient.patientLastName} · DOB ${payerPatient.patientDob || "—"}${payerPatient.patientGender ? ` · ${payerPatient.patientGender}` : ""}`}
          />
          <LabeledRow label="Member ID" value={payerPatient.memberId || "—"} />
          <LabeledRow label="Payer" value={payerPatient.payer || "—"} />
          <LabeledRow label="Urgency" value={payerPatient.urgency || "Routine"} />
          <LabeledRow label="Patient address" value={formatAddress(payerPatient.patientAddress)} />
        </Section>

        <Section title="Drug & Diagnosis" icon={Pill} color="purple">
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

        <Section title="Prescriber" icon={Stethoscope} color="green">
          <LabeledRow label="Name" value={`${prescriber.firstName} ${prescriber.lastName}`.trim() || "—"} />
          <LabeledRow label="NPI" value={prescriber.npi || "—"} />
          <LabeledRow
            label="License"
            value={`${prescriber.licenseNumber || "—"}${prescriber.licenseState ? ` (${prescriber.licenseState})` : ""}`}
          />
          <LabeledRow label="Contact" value={`${prescriber.phone || "—"} · ${prescriber.email || "—"}`} />
          <LabeledRow label="Address" value={formatAddress(prescriber.address)} />
        </Section>

        <Section title="Servicing Provider" icon={Building2} color="teal">
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
