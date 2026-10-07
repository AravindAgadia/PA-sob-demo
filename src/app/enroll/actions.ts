"use server";

import { revalidatePath } from "next/cache";
import { runIntake } from "@/app/actions";
import { createCaseForEnrollment } from "@/lib/case-store";
import {
  deleteEnrollment,
  getEnrollment,
  listEnrollments,
  saveDraftEnrollment as saveDraftEnrollmentToStore,
  type EnrollmentRecord,
  type EnrollmentSummary,
} from "@/lib/enrollment-store";
import { lookupNpiForEnrollment } from "@/lib/npi/nppes";
import { getDraft, listDrafts, type ExtractedDraft } from "@/lib/policy/extraction-store";
import { assertRateLimit } from "@/lib/rate-limit";
import { mapEnrollmentToIntake, type EnrollmentData, type EnrollStepId } from "@/components/enroll/types";

export async function lookupPrescriberNpi(npi: string) {
  await assertRateLimit("enroll-npi-lookup", 20, 5 * 60 * 1000);
  return lookupNpiForEnrollment(npi);
}

export async function saveDraftEnrollment(input: {
  id?: string;
  data: EnrollmentData;
  step: EnrollStepId;
}): Promise<EnrollmentRecord> {
  const saved = await saveDraftEnrollmentToStore(input);
  revalidatePath("/");
  return saved;
}

export async function listEnrollmentSummaries(): Promise<EnrollmentSummary[]> {
  return listEnrollments();
}

export async function getEnrollmentById(id: string): Promise<EnrollmentRecord | undefined> {
  return getEnrollment(id);
}

export async function deleteEnrollmentDraft(id: string): Promise<void> {
  await deleteEnrollment(id);
  revalidatePath("/");
}

/** Maps to IntakeData, runs the existing eligibility/policy-match/NPI
 *  pipeline unchanged, and persists the result as a new case — the
 *  enrollment wizard no longer renders that result inline. */
export async function submitEnrollment(
  enrollmentId: string,
  data: EnrollmentData
): Promise<{ caseNumber: string }> {
  const intake = mapEnrollmentToIntake(data);
  const run = await runIntake(intake);
  const { caseNumber } = await createCaseForEnrollment(enrollmentId, {
    intake: run.intake,
    eligibility: run.eligibility,
    npiLookup: run.npiLookup,
    policyMatch: run.policyMatch,
  });
  revalidatePath("/");
  return { caseNumber };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/** The leading brand word, stripped of trademark symbols/dosage/route
 *  text — a wizard's free-text Drug Description ("Botox (onabotulinumt...)
 *  100 UNIT Injection") very rarely matches a saved draft's short
 *  drug_label ("Botox") verbatim, but the brand name alone usually does. */
function brandNameOf(text: string): string {
  return normalize(text.replace(/[™®©]/g, "")).split(/[\s(]/)[0] ?? "";
}

function fuzzyMatches(a: string, b: string): boolean {
  const an = normalize(a);
  const bn = normalize(b);
  return an.length > 0 && bn.length > 0 && (an.includes(bn) || bn.includes(an));
}

/**
 * Looks for a Document Library extraction draft covering the same payer
 * and drug the enrollment wizard is requesting, so the Benefit Summary
 * step can show real PDF-sourced policy detail instead of a blank state.
 */
export async function findMatchingExtractedDraft(
  payer: string,
  drug: string
): Promise<ExtractedDraft | null> {
  if (!payer.trim() || !drug.trim()) return null;
  const drafts = await listDrafts();
  const drugBrand = brandNameOf(drug);
  const match = drafts.find((d) => brandNameOf(d.drugLabel) === drugBrand && fuzzyMatches(d.payer, payer));
  if (!match) return null;
  return (await getDraft(match.id)) ?? null;
}
