"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { lookupPrescriberNpi } from "@/app/enroll/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import type { EnrollmentPrescriber } from "./types";

const PHONE_TYPES = ["Mobile", "Office", "Home"];
const FAX_TYPES = ["Office", "Mobile", "Home"];
const SAMPLE_NPIS = ["1234567890", "1922334455", "1015049598"];

export const PRESCRIBER_REQUIRED: { key: keyof EnrollmentPrescriber; label: string }[] = [
  { key: "npi", label: "NPI #" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "taxId", label: "Tax ID" },
  { key: "email", label: "Email" },
  { key: "confirmEmail", label: "Confirm email" },
];

export function getPrescriberIssues(v: EnrollmentPrescriber): string[] {
  const issues = PRESCRIBER_REQUIRED.filter((f) => !String(v[f.key]).trim()).map((f) => f.label);
  if (!v.phone.trim() && !v.fax.trim()) issues.push("Phone # or Fax # (at least one)");
  if (v.email.trim() && v.confirmEmail.trim() && v.email.trim() !== v.confirmEmail.trim()) {
    issues.push("Confirm email must match email");
  }
  return issues;
}

export function StepPrescriber({
  value,
  onChange,
  showErrors,
}: {
  value: EnrollmentPrescriber;
  onChange: (next: EnrollmentPrescriber) => void;
  showErrors: boolean;
}) {
  const [isLookingUp, startLookup] = useTransition();
  const [lookupError, setLookupError] = useState<string | null>(null);

  function update<K extends keyof EnrollmentPrescriber>(key: K, v: EnrollmentPrescriber[K]) {
    onChange({ ...value, [key]: v });
  }
  function updateAddress<K extends keyof EnrollmentPrescriber["address"]>(key: K, v: string) {
    onChange({ ...value, address: { ...value.address, [key]: v } });
  }
  function isEmpty(key: keyof EnrollmentPrescriber) {
    return showErrors && !String(value[key]).trim();
  }

  function runLookup(npiValue: string) {
    setLookupError(null);
    const npi = npiValue.trim();
    if (!/^\d{10}$/.test(npi)) {
      setLookupError("NPIs are 10 digits — this won't resolve to a provider as typed.");
      return;
    }
    startLookup(async () => {
      let result;
      try {
        result = await lookupPrescriberNpi(npi);
      } catch (err) {
        setLookupError(err instanceof Error ? err.message : "Lookup failed — try again.");
        return;
      }
      if (!result.found) {
        setLookupError(
          result.status === "lookup-failed"
            ? "Couldn't reach the NPI registry right now — check your connection and try again."
            : "No provider found for that NPI."
        );
        return;
      }
      onChange({
        ...value,
        npi,
        firstName: result.firstName ?? value.firstName,
        lastName: result.lastName ?? value.lastName,
        licenseState: result.licenseState ?? value.licenseState,
        licenseNumber: result.licenseNumber ?? value.licenseNumber,
        taxId: result.taxId ?? value.taxId,
        phone: result.phone ?? value.phone,
        email: result.email ?? value.email,
        confirmEmail: result.email ?? value.confirmEmail,
        address: {
          line1: result.addressLine1 ?? value.address.line1,
          line2: result.addressLine2 ?? value.address.line2,
          city: result.city ?? value.address.city,
          state: result.state ?? value.address.state,
          zip: result.zip ?? value.address.zip,
        },
      });
    });
  }

  function handleLookup() {
    runLookup(value.npi);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-full">
        <Label htmlFor="prescriberNpi">
          NPI # <span className="text-destructive">*</span>
        </Label>
        <div className="flex gap-2">
          <Input
            id="prescriberNpi"
            value={value.npi}
            onChange={(e) => update("npi", e.target.value)}
            placeholder="10 digits"
            aria-invalid={isEmpty("npi")}
          />
          <Button type="button" variant="outline" disabled={isLookingUp} onClick={handleLookup}>
            {isLookingUp && <Loader2 className="animate-spin" />}
            Lookup
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Try:</span>
          {SAMPLE_NPIS.map((sample) => (
            <button
              key={sample}
              type="button"
              disabled={isLookingUp}
              onClick={() => runLookup(sample)}
              className="rounded-full border border-input px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              {sample}
            </button>
          ))}
          <span>— lookup prepopulates name and address below.</span>
        </div>
        {lookupError && (
          <Alert variant="destructive">
            <AlertTitle>Lookup failed</AlertTitle>
            <AlertDescription>{lookupError}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prescriberFirstName">
          First name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="prescriberFirstName"
          value={value.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          aria-invalid={isEmpty("firstName")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prescriberLastName">
          Last name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="prescriberLastName"
          value={value.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          aria-invalid={isEmpty("lastName")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prescriberLicenseState">License State</Label>
        <Select
          value={value.licenseState || undefined}
          onValueChange={(v) => update("licenseState", v as string)}
        >
          <SelectTrigger id="prescriberLicenseState" className="w-full">
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
        <Label htmlFor="prescriberLicenseNumber">License Number</Label>
        <Input
          id="prescriberLicenseNumber"
          value={value.licenseNumber}
          onChange={(e) => update("licenseNumber", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prescriberTaxId">
          Tax ID / TIN <span className="text-destructive">*</span>
        </Label>
        <Input
          id="prescriberTaxId"
          value={value.taxId}
          onChange={(e) => update("taxId", e.target.value)}
          placeholder="XX-XXXXXXX"
          aria-invalid={isEmpty("taxId")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prescriberEmail">
          Email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="prescriberEmail"
          type="email"
          value={value.email}
          onChange={(e) => update("email", e.target.value)}
          aria-invalid={isEmpty("email")}
        />
      </div>

      <p className="text-xs text-muted-foreground sm:col-span-full -mb-1.5">
        At least one of Phone # or Fax # is required — neither is mandatory on its own.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="prescriberConfirmEmail">
          Confirm email <span className="text-destructive">*</span>
        </Label>
        <Input
          id="prescriberConfirmEmail"
          type="email"
          value={value.confirmEmail}
          onChange={(e) => update("confirmEmail", e.target.value)}
          aria-invalid={isEmpty("confirmEmail")}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Phone #</Label>
        <div className="flex gap-2">
          <Select value={value.phoneType} onValueChange={(v) => update("phoneType", v as string)}>
            <SelectTrigger className="w-24 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHONE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={value.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="(555) 431-9020"
            className="flex-1"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Fax #</Label>
        <div className="flex gap-2">
          <Select value={value.faxType} onValueChange={(v) => update("faxType", v as string)}>
            <SelectTrigger className="w-24 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FAX_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={value.fax}
            onChange={(e) => update("fax", e.target.value)}
            placeholder="(555) 431-9020"
            className="flex-1"
          />
        </div>
      </div>

      <SectionHeading>Address</SectionHeading>
      <div className="space-y-1.5 sm:col-span-full">
        <Label htmlFor="prescriberAddressLine1">Street address</Label>
        <Input
          id="prescriberAddressLine1"
          value={value.address.line1}
          onChange={(e) => updateAddress("line1", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prescriberAddressCity">City</Label>
        <Input
          id="prescriberAddressCity"
          value={value.address.city}
          onChange={(e) => updateAddress("city", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="prescriberAddressState">State</Label>
        <Select
          value={value.address.state || undefined}
          onValueChange={(v) => updateAddress("state", v as string)}
        >
          <SelectTrigger id="prescriberAddressState" className="w-full">
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
        <Label htmlFor="prescriberAddressZip">ZIP</Label>
        <Input
          id="prescriberAddressZip"
          value={value.address.zip}
          onChange={(e) => updateAddress("zip", e.target.value)}
        />
      </div>
    </div>
  );
}
