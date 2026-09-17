"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DrugCombobox } from "@/components/drug-combobox";
import { IconChip } from "@/components/icon-chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { IntakeData, PolicySummary } from "@/lib/policy/types";

const SAMPLE_NPIS = {
  matching: {
    value: "1871588442",
    label: "Use sample ophthalmologist NPI (Indianapolis, IN)",
  },
  nonMatching: {
    value: "1376714063",
    label: "Use sample family-medicine NPI (should fail)",
  },
};

export function IntakeForm({
  defaultValues,
  initialOptions,
  totalIngested,
  loading,
  onSubmit,
}: {
  defaultValues: IntakeData;
  initialOptions: PolicySummary[];
  totalIngested: number;
  loading: boolean;
  onSubmit: (intake: IntakeData) => void;
}) {
  const [values, setValues] = useState<IntakeData>(defaultValues);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicySummary | null>(
    () => initialOptions.find((d) => d.drug === defaultValues.drug) ?? null
  );

  function update<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handlePolicySelect(policy: PolicySummary | null) {
    setSelectedPolicy(policy);
    if (policy) {
      setValues((v) => ({ ...v, drug: policy.drug, payer: policy.payer }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <IconChip icon={ClipboardList} color="orange" />
          Step 1 &middot; Provider office submits the PA request
        </CardTitle>
        <CardDescription>
          Diagnosis isn&apos;t a mandatory intake field today &mdash; shown here as present
          for this demo scenario.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="patientName">Patient name</Label>
          <Input
            id="patientName"
            value={values.patientName}
            onChange={(e) => update("patientName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="patientDob">Date of birth</Label>
          <Input
            id="patientDob"
            type="date"
            value={values.patientDob}
            onChange={(e) => update("patientDob", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="insuranceId">Insurance ID</Label>
          <Input
            id="insuranceId"
            value={values.insuranceId}
            onChange={(e) => update("insuranceId", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payer">Payer</Label>
          <Input
            id="payer"
            value={values.payer}
            onChange={(e) => update("payer", e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="drug">Drug requested</Label>
          <DrugCombobox selected={selectedPolicy} onSelect={handlePolicySelect} initialOptions={initialOptions} />
          <p className="text-xs text-muted-foreground">
            {totalIngested.toLocaleString()} polic{totalIngested === 1 ? "y" : "ies"} ingested
            &mdash;{" "}
            <Link href="/documents" className="underline underline-offset-2 hover:text-foreground">
              manage in the Document Library
            </Link>
            .
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="diagnosis">Diagnosis</Label>
          <Input
            id="diagnosis"
            value={values.diagnosis}
            onChange={(e) => update("diagnosis", e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor="buyAndBill" className="flex-col items-start gap-0.5">
            Buy-and-bill
            <span className="text-xs font-normal text-muted-foreground">
              {values.buyAndBill ? "Routes to medical flow" : "Not buy-and-bill"}
            </span>
          </Label>
          <Switch
            id="buyAndBill"
            checked={values.buyAndBill}
            onCheckedChange={(checked) => update("buyAndBill", checked)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dispensingLocation">Dispensing location</Label>
          <Input
            id="dispensingLocation"
            value={values.dispensingLocation}
            onChange={(e) => update("dispensingLocation", e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="npi">Ordering/rendering provider NPI</Label>
          <Input
            id="npi"
            value={values.orderingProviderNpi}
            onChange={(e) => update("orderingProviderNpi", e.target.value)}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update("orderingProviderNpi", SAMPLE_NPIS.matching.value)}
            >
              {SAMPLE_NPIS.matching.label}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update("orderingProviderNpi", SAMPLE_NPIS.nonMatching.value)}
            >
              {SAMPLE_NPIS.nonMatching.label}
            </Button>
          </div>
          <p
            className={`text-xs ${
              values.orderingProviderNpi.trim() && !/^\d{10}$/.test(values.orderingProviderNpi.trim())
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            }`}
          >
            {values.orderingProviderNpi.trim() && !/^\d{10}$/.test(values.orderingProviderNpi.trim())
              ? "NPIs are 10 digits — this won't resolve to a provider as typed."
              : "Looked up live against the NPPES NPI Registry when you submit."}
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button disabled={loading} onClick={() => onSubmit(values)}>
          {loading
            ? "Running eligibility, policy match, and NPI lookup…"
            : "Submit PA request"}
        </Button>
      </CardFooter>
    </Card>
  );
}
