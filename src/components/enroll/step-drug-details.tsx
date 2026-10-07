"use client";

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
import { SectionHeading } from "./section-heading";
import type { EnrollmentDrugDetails } from "./types";

/** Diagnosis and ICD-10 aren't mandatory intake fields today (the matching
 *  engine doesn't check either), so they're kept optional here. Dispensing
 *  location IS consulted by the matching engine, so it's required. */
export const DRUG_DETAILS_REQUIRED: { key: keyof EnrollmentDrugDetails; label: string }[] = [
  { key: "drugDescription", label: "Drug description" },
  { key: "ndc", label: "NDC" },
  { key: "hcpcsCode", label: "HCPCS/CPT code" },
  { key: "routeOfAdministration", label: "Route of administration" },
  { key: "startDateOfService", label: "Start date of service" },
  { key: "daysSupply", label: "Days supply" },
  { key: "quantity", label: "Quantity" },
  { key: "billUnder", label: "Bill this drug under" },
  { key: "dispensingLocation", label: "Dispensing location" },
];

export function getDrugDetailsIssues(v: EnrollmentDrugDetails): string[] {
  return DRUG_DETAILS_REQUIRED.filter((f) => !String(v[f.key]).trim()).map((f) => f.label);
}

function SearchInput(props: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input {...props} className={`pl-8 ${props.className ?? ""}`} />
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

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="drugDescription">
          Drug Description <span className="text-destructive">*</span>
        </Label>
        <SearchInput
          id="drugDescription"
          value={value.drugDescription}
          onChange={(e) => update("drugDescription", e.target.value)}
          placeholder="e.g. Botox 100 UNIT Injection"
          aria-invalid={isEmpty("drugDescription")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="diagnosis">Diagnosis</Label>
        <Input
          id="diagnosis"
          value={value.diagnosis}
          onChange={(e) => update("diagnosis", e.target.value)}
          placeholder="e.g. Chronic migraine"
        />
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
          matching like today&apos;s intake form.
        </p>
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
      <div className="space-y-1.5">
        <Label htmlFor="startDateOfService">
          Start Date of Service <span className="text-destructive">*</span>
        </Label>
        <Input
          id="startDateOfService"
          type="date"
          value={value.startDateOfService}
          onChange={(e) => update("startDateOfService", e.target.value)}
          aria-invalid={isEmpty("startDateOfService")}
        />
      </div>

      <SectionHeading>Directions</SectionHeading>
      <div className="space-y-1.5 sm:col-span-2">
        <Textarea
          value={value.directions}
          onChange={(e) => update("directions", e.target.value)}
          placeholder="Inject 100 units intramuscularly once every 12 weeks"
          rows={3}
        />
        <p className="text-xs text-muted-foreground">
          Free text — not yet connected to a data feed for FDB SIG codes/directions.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="daysSupply">
          Days Supply <span className="text-destructive">*</span>
        </Label>
        <Input
          id="daysSupply"
          value={value.daysSupply}
          onChange={(e) => update("daysSupply", e.target.value)}
          placeholder="90"
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
          placeholder="1"
          aria-invalid={isEmpty("quantity")}
        />
      </div>
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
      <div className="space-y-1.5">
        <Label htmlFor="dispensingLocation">
          Dispensing Location / Site of Care <span className="text-destructive">*</span>
        </Label>
        <Input
          id="dispensingLocation"
          value={value.dispensingLocation}
          onChange={(e) => update("dispensingLocation", e.target.value)}
          aria-invalid={isEmpty("dispensingLocation")}
        />
      </div>
    </div>
  );
}
