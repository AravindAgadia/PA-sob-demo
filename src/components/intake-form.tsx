"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IntakeData } from "@/lib/policy/types";

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

const selectClassName =
  "border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function IntakeForm({
  defaultValues,
  loading,
  onSubmit,
}: {
  defaultValues: IntakeData;
  loading: boolean;
  onSubmit: (intake: IntakeData) => void;
}) {
  const [values, setValues] = useState<IntakeData>(defaultValues);

  function update<K extends keyof IntakeData>(key: K, value: IntakeData[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1 &middot; Provider office submits the PA request</CardTitle>
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
        <div className="space-y-1.5">
          <Label htmlFor="drug">Drug requested</Label>
          <Input id="drug" value={values.drug} readOnly className="bg-muted" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="diagnosis">Diagnosis</Label>
          <Input
            id="diagnosis"
            value={values.diagnosis}
            onChange={(e) => update("diagnosis", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="buyAndBill">Buy-and-bill</Label>
          <select
            id="buyAndBill"
            className={selectClassName}
            value={values.buyAndBill ? "yes" : "no"}
            onChange={(e) => update("buyAndBill", e.target.value === "yes")}
          >
            <option value="yes">Yes (routes to medical flow)</option>
            <option value="no">No</option>
          </select>
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
          <p className="text-xs text-muted-foreground">
            Looked up live against the NPPES NPI Registry when you submit.
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
