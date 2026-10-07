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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { US_STATES } from "./us-states";
import type { EnrollmentPrescriber, EnrollmentServicingProvider } from "./types";

const SERVICING_REQUIRED: { key: keyof EnrollmentServicingProvider; label: string }[] = [
  { key: "npi", label: "NPI #" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "taxId", label: "Tax ID" },
];

export function getServicingProviderIssues(v: EnrollmentServicingProvider): string[] {
  if (v.sameAsPrescriber) return [];
  return SERVICING_REQUIRED.filter((f) => !String(v[f.key]).trim()).map((f) => f.label);
}

export function StepServicingProvider({
  value,
  onChange,
  prescriber,
  showErrors,
}: {
  value: EnrollmentServicingProvider;
  onChange: (next: EnrollmentServicingProvider) => void;
  prescriber: EnrollmentPrescriber;
  showErrors: boolean;
}) {
  const [isLookingUp, startLookup] = useTransition();
  const [lookupError, setLookupError] = useState<string | null>(null);

  function update<K extends keyof EnrollmentServicingProvider>(
    key: K,
    v: EnrollmentServicingProvider[K]
  ) {
    onChange({ ...value, [key]: v });
  }
  function isEmpty(key: keyof EnrollmentServicingProvider) {
    return showErrors && !String(value[key]).trim();
  }

  function handleToggle(selected: readonly string[]) {
    const sameAsPrescriber = selected[0] !== "different";
    // Only flips the flag — doesn't wipe the "Different" fields, since
    // that destroyed manually-entered data on an accidental toggle back
    // to "Same" with no way to recover it (those fields simply aren't
    // shown while sameAsPrescriber is true, so leaving them is harmless).
    onChange({ ...value, sameAsPrescriber });
  }

  function handleLookup() {
    setLookupError(null);
    const npi = value.npi.trim();
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
        firstName: result.firstName ?? value.firstName,
        lastName: result.lastName ?? value.lastName,
        licenseState: result.licenseState ?? value.licenseState,
        licenseNumber: result.licenseNumber ?? value.licenseNumber,
        taxId: result.taxId ?? value.taxId,
        phone: result.phone ?? value.phone,
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Is the Servicing Provider the same as the Prescriber?</Label>
        <ToggleGroup
          value={[value.sameAsPrescriber ? "same" : "different"]}
          onValueChange={handleToggle}
        >
          <ToggleGroupItem value="same">Same as Prescriber</ToggleGroupItem>
          <ToggleGroupItem value="different">Different</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {value.sameAsPrescriber ? (
        <>
          <Alert variant="info">
            <AlertTitle>Pulled from the Prescriber tab — view only.</AlertTitle>
            <AlertDescription>
              Choose &ldquo;Different&rdquo; above to enter a different Servicing Provider.
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="NPI #" value={prescriber.npi} />
            <ReadOnlyField label="First name" value={prescriber.firstName} />
            <ReadOnlyField label="Last name" value={prescriber.lastName} />
            <ReadOnlyField label="Tax ID (TIN)" value={prescriber.taxId} />
            <ReadOnlyField label="License State" value={prescriber.licenseState} />
            <ReadOnlyField label="License Number" value={prescriber.licenseNumber} />
            <ReadOnlyField label={`${prescriber.phoneType} Phone #`} value={prescriber.phone} />
            <ReadOnlyField label={`${prescriber.faxType} Fax #`} value={prescriber.fax} />
          </div>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="servicingNpi">
              NPI # <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="servicingNpi"
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
            {lookupError && (
              <Alert variant="destructive">
                <AlertTitle>Lookup failed</AlertTitle>
                <AlertDescription>{lookupError}</AlertDescription>
              </Alert>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="servicingFirstName">
              First name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="servicingFirstName"
              value={value.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              aria-invalid={isEmpty("firstName")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="servicingLastName">
              Last name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="servicingLastName"
              value={value.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              aria-invalid={isEmpty("lastName")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="servicingTaxId">
              Tax ID (TIN) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="servicingTaxId"
              value={value.taxId}
              onChange={(e) => update("taxId", e.target.value)}
              placeholder="XX-XXXXXXX"
              aria-invalid={isEmpty("taxId")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="servicingLicenseState">License State</Label>
            <Select
              value={value.licenseState || undefined}
              onValueChange={(v) => update("licenseState", v as string)}
            >
              <SelectTrigger id="servicingLicenseState" className="w-full">
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
            <Label htmlFor="servicingLicenseNumber">License Number</Label>
            <Input
              id="servicingLicenseNumber"
              value={value.licenseNumber}
              onChange={(e) => update("licenseNumber", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="servicingPhone">Mobile Phone #</Label>
            <Input
              id="servicingPhone"
              value={value.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="(555) 431-9020"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="servicingFax">Office Fax #</Label>
            <Input
              id="servicingFax"
              value={value.fax}
              onChange={(e) => update("fax", e.target.value)}
              placeholder="(555) 431-9020"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value} readOnly disabled />
    </div>
  );
}
