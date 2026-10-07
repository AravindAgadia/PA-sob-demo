"use client";

import { Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeading } from "./section-heading";
import { US_STATES } from "./us-states";
import type { EnrollmentPayerPatient } from "./types";

const URGENCY_OPTIONS = ["Not Urgent", "Urgent"];
const GENDER_OPTIONS = ["Female", "Male", "Unknown"];

export const PAYER_PATIENT_REQUIRED: { key: keyof EnrollmentPayerPatient; label: string }[] = [
  { key: "payer", label: "Payer" },
  { key: "urgency", label: "Urgency" },
  { key: "patientFirstName", label: "Patient first name" },
  { key: "patientLastName", label: "Patient last name" },
  { key: "patientDob", label: "Date of birth" },
  { key: "patientGender", label: "Gender" },
  { key: "memberId", label: "Member ID" },
];

export function getPayerPatientIssues(v: EnrollmentPayerPatient): string[] {
  return PAYER_PATIENT_REQUIRED.filter((f) => !String(v[f.key]).trim()).map((f) => f.label);
}

function SearchInput(props: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className={`pl-8 ${props.className ?? ""}`} />
    </div>
  );
}

export function StepPayerPatient({
  value,
  onChange,
  showErrors,
}: {
  value: EnrollmentPayerPatient;
  onChange: (next: EnrollmentPayerPatient) => void;
  showErrors: boolean;
}) {
  function update<K extends keyof EnrollmentPayerPatient>(key: K, v: EnrollmentPayerPatient[K]) {
    onChange({ ...value, [key]: v });
  }
  function updateAddress<K extends keyof EnrollmentPayerPatient["patientAddress"]>(
    key: K,
    v: string
  ) {
    onChange({ ...value, patientAddress: { ...value.patientAddress, [key]: v } });
  }
  function isEmpty(key: keyof EnrollmentPayerPatient) {
    return showErrors && !String(value[key]).trim();
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="payer">
          Payer (Insurance) <span className="text-destructive">*</span>
        </Label>
        <SearchInput
          id="payer"
          value={value.payer}
          onChange={(e) => update("payer", e.target.value)}
          placeholder="e.g. Anthem Inc"
          aria-invalid={isEmpty("payer")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="urgency">
          Urgency <span className="text-destructive">*</span>
        </Label>
        <Select
          value={value.urgency || undefined}
          onValueChange={(v) => update("urgency", v as string)}
        >
          <SelectTrigger id="urgency" className="w-full" aria-invalid={isEmpty("urgency")}>
            <SelectValue placeholder="Select urgency" />
          </SelectTrigger>
          <SelectContent>
            {URGENCY_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.payer.trim() && (
        <Alert variant="info" className="sm:col-span-full">
          <AlertDescription>This payer supports both Medical and Pharmacy PA.</AlertDescription>
        </Alert>
      )}

      <SectionHeading>Patient Information</SectionHeading>
      <div className="space-y-1.5">
        <Label htmlFor="patientFirstName">
          First name <span className="text-destructive">*</span>
        </Label>
        <SearchInput
          id="patientFirstName"
          value={value.patientFirstName}
          onChange={(e) => update("patientFirstName", e.target.value)}
          aria-invalid={isEmpty("patientFirstName")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="patientLastName">
          Last name <span className="text-destructive">*</span>
        </Label>
        <SearchInput
          id="patientLastName"
          value={value.patientLastName}
          onChange={(e) => update("patientLastName", e.target.value)}
          aria-invalid={isEmpty("patientLastName")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="patientDob">
          Date of birth <span className="text-destructive">*</span>
        </Label>
        <Input
          id="patientDob"
          type="date"
          value={value.patientDob}
          onChange={(e) => update("patientDob", e.target.value)}
          aria-invalid={isEmpty("patientDob")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="patientGender">
          Gender <span className="text-destructive">*</span>
        </Label>
        <Select
          value={value.patientGender || undefined}
          onValueChange={(v) => update("patientGender", v as string)}
        >
          <SelectTrigger id="patientGender" className="w-full" aria-invalid={isEmpty("patientGender")}>
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="memberId">
          Member ID <span className="text-destructive">*</span>
        </Label>
        <Input
          id="memberId"
          value={value.memberId}
          onChange={(e) => update("memberId", e.target.value)}
          placeholder="PBM Member ID / Cardholder ID"
          aria-invalid={isEmpty("memberId")}
        />
      </div>

      <SectionHeading>Patient Address</SectionHeading>
      <div className="space-y-1.5 sm:col-span-full">
        <Label htmlFor="patientAddressLine1">Street address</Label>
        <Input
          id="patientAddressLine1"
          value={value.patientAddress.line1}
          onChange={(e) => updateAddress("line1", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="patientAddressCity">City</Label>
        <Input
          id="patientAddressCity"
          value={value.patientAddress.city}
          onChange={(e) => updateAddress("city", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="patientAddressState">State</Label>
        <Select
          value={value.patientAddress.state || undefined}
          onValueChange={(v) => updateAddress("state", v as string)}
        >
          <SelectTrigger id="patientAddressState" className="w-full">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            {US_STATES.map((s) => (
              <SelectItem key={s.code} value={s.code}>
                {s.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="patientAddressZip">ZIP</Label>
        <Input
          id="patientAddressZip"
          value={value.patientAddress.zip}
          onChange={(e) => updateAddress("zip", e.target.value)}
        />
      </div>
    </div>
  );
}
