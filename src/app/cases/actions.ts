"use server";

import { revalidatePath } from "next/cache";
import {
  declineCase as declineCaseInStore,
  getCaseByNumber,
  listCases as listCasesFromStore,
  proceedCase as proceedCaseInStore,
  updateCaseAnswers,
  type CaseRecord,
  type CaseSummary,
} from "@/lib/case-store";
import type { FollowUpAnswers } from "@/lib/policy/types";

export async function listCases(): Promise<CaseSummary[]> {
  return listCasesFromStore();
}

export async function getCase(caseNumber: string): Promise<CaseRecord | undefined> {
  return getCaseByNumber(caseNumber);
}

export async function answerCase(
  caseNumber: string,
  answers: FollowUpAnswers
): Promise<CaseRecord | undefined> {
  const updated = await updateCaseAnswers(caseNumber, answers);
  revalidatePath("/");
  return updated;
}

export async function proceedCase(caseNumber: string): Promise<CaseRecord | undefined> {
  const updated = await proceedCaseInStore(caseNumber);
  revalidatePath("/");
  return updated;
}

export async function declineCase(
  caseNumber: string,
  reason: string
): Promise<CaseRecord | undefined> {
  const updated = await declineCaseInStore(caseNumber, reason);
  revalidatePath("/");
  return updated;
}
