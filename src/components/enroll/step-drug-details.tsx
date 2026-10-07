"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DRUG_CATALOG, type DrugCatalogEntry } from "./drug-catalog";
import { ICD10_CATALOG } from "./icd10-catalog";
import { SectionHeading } from "./section-heading";
import { TextAutocomplete } from "./text-autocomplete";
import type { EnrollmentDrugDetails } from "./types";

const SAMPLE_ICD10_CODES = ["G43.709", "K50.90", "M05.79"];
const SAMPLE_ICD10_ENTRIES = SAMPLE_ICD10_CODES.map(
  (code) => ICD10_CATALOG.find((entry) => entry.code === code)!
);

/** Placeholder set, not a real AnvayaRx option list — flag to confirm the
 *  exact wording/options their drug-administration-location dropdown uses. */
const SITE_OF_CARE_OPTIONS = [
  "Physician's Office",
  "Hospital Outpatient",
  "Infusion Center",
  "Home Infusion",
  "Specialty Pharmacy (Patient Self-Administered)",
  "Ambulatory Surgery Center",
];

/** Site of Care stays optional regardless of billing type — it's shown
 *  for Medical and hidden for Pharmacy (a self-administered drug has no
 *  site-of-care concept), but never blocks the step either way. */
export const DRUG_DETAILS_REQUIRED: { key: keyof EnrollmentDrugDetails; label: string }[] = [
  { key: "drugDescription", label: "Drug description" },
  { key: "ndc", label: "NDC" },
  { key: "hcpcsCode", label: "HCPCS/CPT code" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "routeOfAdministration", label: "Route of administration" },
  { key: "startDateOfService", label: "Start date of service" },
  { key: "daysSupply", label: "Days supply" },
  { key: "quantity", label: "Quantity" },
  { key: "billUnder", label: "Bill this drug under" },
];

export function getDrugDetailsIssues(v: EnrollmentDrugDetails): string[] {
  return DRUG_DETAILS_REQUIRED.filter((f) => !String(v[f.key]).trim()).map((f) => f.label);
}

/** End Date of Service is derived, not user-entered — start date plus the
 *  days-supply window — so it can never drift out of sync with the two
 *  fields it depends on. */
function computeEndDate(startIso: string, daysSupply: string): string {
  const days = Number(daysSupply);
  if (!startIso || !Number.isFinite(days) || days <= 0) return "";
  const start = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return end.toISOString().slice(0, 10);
}

function SearchInput(props: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className={`pl-8 ${props.className ?? ""}`} />
    </div>
  );
}

/** Typing filters the small hardcoded DRUG_CATALOG; selecting a match
 *  fills Drug Description, NDC, and HCPCS/CPT together. Anything typed
 *  that doesn't match a catalog entry is kept as free text — there's no
 *  real drug database here, so this is a convenience, not a constraint. */
function DrugDescriptionField({
  value,
  isInvalid,
  onChangeText,
  onSelect,
}: {
  value: string;
  isInvalid: boolean;
  onChangeText: (text: string) => void;
  onSelect: (entry: DrugCatalogEntry) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    return DRUG_CATALOG.filter((entry) => entry.label.toLowerCase().includes(query)).slice(0, 6);
  }, [value]);

  return (
    <div className="relative">
      <SearchInput
        id="drugDescription"
        value={value}
        onChange={(e) => {
          onChangeText(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        placeholder="e.g. Botox 100 UNIT Injection"
        aria-invalid={isInvalid}
        autoComplete="off"
      />
      {isOpen && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md">
          {matches.map((entry) => (
            <button
              key={entry.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(entry);
                setIsOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="font-medium">{entry.label}</span>
              <span className="text-xs text-muted-foreground">
                NDC {entry.ndc} &middot; {entry.hcpcsCode}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StepDrugDetails({
  value,
  onChange,
  showErrors,
}: {
  value: EnrollmentDrugDetails;
  onChange: (next: EnrollmentDrugDetails) => void;
  showErrors: boolean;
}) {
  function update<K extends keyof EnrollmentDrugDetails>(key: K, v: EnrollmentDrugDetails[K]) {
    onChange({ ...value, [key]: v });
  }
  function isEmpty(key: keyof EnrollmentDrugDetails) {
    return showErrors && !String(value[key]).trim();
  }

  const isMedical = value.billUnder === "Medical";
  const endDate = useMemo(
    () => computeEndDate(value.startDateOfService, value.daysSupply),
    [value.startDateOfService, value.daysSupply]
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-full">
        <Label htmlFor="drugDescription">
          Drug Description <span className="text-destructive">*</span>
        </Label>
        <DrugDescriptionField
          value={value.drugDescription}
          isInvalid={isEmpty("drugDescription")}
          onChangeText={(text) => update("drugDescription", text)}
          onSelect={(entry) =>
            onChange({ ...value, drugDescription: entry.label, ndc: entry.ndc, hcpcsCode: entry.hcpcsCode })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ndc">
          NDC (Product Code) <span className="text-destructive">*</span>
        </Label>
        <SearchInput
          id="ndc"
          value={value.ndc}
          onChange={(e) => update("ndc", e.target.value)}
          placeholder="00023-1145-01"
          aria-invalid={isEmpty("ndc")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hcpcsCode">
          HCPCS/CPT Code <span className="text-destructive">*</span>
        </Label>
        <SearchInput
          id="hcpcsCode"
          value={value.hcpcsCode}
          onChange={(e) => update("hcpcsCode", e.target.value)}
          placeholder="J0585"
          aria-invalid={isEmpty("hcpcsCode")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="routeOfAdministration">
          Route of Administration <span className="text-destructive">*</span>
        </Label>
        <Input
          id="routeOfAdministration"
          value={value.routeOfAdministration}
          onChange={(e) => update("routeOfAdministration", e.target.value)}
          placeholder="Injectable"
          aria-invalid={isEmpty("routeOfAdministration")}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:col-span-full sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="diagnosis">
            Diagnosis <span className="text-destructive">*</span>
          </Label>
          <TextAutocomplete
            id="diagnosis"
            value={value.diagnosis}
            isInvalid={isEmpty("diagnosis")}
            placeholder='Type a name ("migraine") or code ("G43")'
            items={ICD10_CATALOG}
            filter={(item, query) =>
              item.description.toLowerCase().includes(query) || item.code.toLowerCase().includes(query)
            }
            renderItem={(item) => (
              <>
                <span className="font-medium">{item.description}</span>
                <span className="text-xs text-muted-foreground">{item.code}</span>
              </>
            )}
            onChangeText={(text) => update("diagnosis", text)}
            onSelect={(item) => onChange({ ...value, diagnosis: item.description, icd10Code: item.code })}
          />
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>Try:</span>
            {SAMPLE_ICD10_ENTRIES.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() =>
                  onChange({ ...value, diagnosis: entry.description, icd10Code: entry.code })
                }
                className="rounded-full border border-input px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-muted"
              >
                {entry.description}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="icd10Code">ICD-10 code</Label>
          <Input
            id="icd10Code"
            value={value.icd10Code}
            onChange={(e) => update("icd10Code", e.target.value)}
            placeholder="e.g. G43.709"
          />
          <p className="text-xs text-muted-foreground">
            Not shown in the reference screen — added so this wizard can run eligibility and policy
            matching.
          </p>
        </div>
      </div>

      <SectionHeading>Directions</SectionHeading>
      <div className="space-y-1.5 sm:col-span-full">
        <Textarea
          value={value.directions}
          onChange={(e) => update("directions", e.target.value)}
          placeholder="Inject 100 units intramuscularly once every 12 weeks"
          rows={2}
        />
        <p className="text-xs text-muted-foreground">
          Free text — not yet connected to a data feed for FDB SIG codes/directions.
        </p>
      </div>

      <SectionHeading>Supply &amp; Billing</SectionHeading>
      <div className="grid grid-cols-2 gap-3 sm:col-span-full sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="startDateOfService">
            Start Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="startDateOfService"
            type="date"
            value={value.startDateOfService}
            onChange={(e) => update("startDateOfService", e.target.value)}
            aria-invalid={isEmpty("startDateOfService")}
          />
          <p className="text-xs text-muted-foreground">Defaults to today — change if needed.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDateOfService">End Date</Label>
          <Input id="endDateOfService" type="date" value={endDate} readOnly disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="daysSupply">
            Days Supply <span className="text-destructive">*</span>
          </Label>
          <Input
            id="daysSupply"
            value={value.daysSupply}
            onChange={(e) => update("daysSupply", e.target.value)}
            placeholder="e.g. 90"
            aria-invalid={isEmpty("daysSupply")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quantity">
            Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quantity"
            value={value.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            placeholder="e.g. 1"
            aria-invalid={isEmpty("quantity")}
          />
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-3 sm:col-span-full ${isMedical ? "sm:grid-cols-2" : ""}`}>
        <div className="space-y-1.5">
          <Label htmlFor="billUnder">
            Bill This Drug Under <span className="text-destructive">*</span>
          </Label>
          <Select value={value.billUnder} onValueChange={(v) => update("billUnder", v as "Medical" | "Pharmacy")}>
            <SelectTrigger id="billUnder" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Medical">Medical</SelectItem>
              <SelectItem value="Pharmacy">Pharmacy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isMedical && (
          <div className="space-y-1.5">
            <Label htmlFor="dispensingLocation">Site of Care</Label>
            <Select
              value={value.dispensingLocation || undefined}
              onValueChange={(v) => update("dispensingLocation", v as string)}
            >
              <SelectTrigger id="dispensingLocation" className="w-full">
                <SelectValue placeholder="Select site of care" />
              </SelectTrigger>
              <SelectContent>
                {SITE_OF_CARE_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
