"use server";

import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import { rateLimit, callerKey } from "@/lib/rate-limit";
import { extractPolicyFromDocuments, extractPolicyFromText } from "@/lib/policy/extract-structured";
import {
  deleteDraft,
  getDraft,
  listDrafts,
  saveDraft,
  type ExtractedDraft,
  type ExtractedDraftSummary,
} from "@/lib/policy/extraction-store";
import type {
  ExtractDocumentKind,
  ExtractResult,
  ExtractSourceText,
  ExtractedPolicy,
  ValidationResult,
} from "@/lib/policy/extracted-schema";

/** One click here can fan out into 1 + N OpenAI calls (N = conditions
 *  found) — materially more expensive per call than the Document Library's
 *  existing AI auto-extract, so this gets a lower, separate limit. */
const EXTRACT_LIMIT = 3;
const EXTRACT_WINDOW_MS = 10 * 60 * 1000;

const VALID_KINDS = new Set<ExtractDocumentKind>(["governing-policy", "pa-form", "general-policy", "other"]);

async function checkExtractRateLimit(): Promise<string | null> {
  const key = `extract-structured:${await callerKey()}`;
  const { allowed, retryAfterMs } = rateLimit(key, EXTRACT_LIMIT, EXTRACT_WINDOW_MS);
  if (!allowed) {
    return `Too many extraction runs — try again in ${Math.ceil(retryAfterMs / 1000)}s.`;
  }
  return null;
}

/**
 * Runs the upgraded extraction pipeline against one or more uploaded files
 * (`file`/`kind` pairs, appended to the FormData in matching order), or
 * against pasted text (`pastedText`) when no files are attached.
 */
export async function runExtraction(formData: FormData): Promise<ExtractResult> {
  const limitError = await checkExtractRateLimit();
  if (limitError) return { ok: false, error: limitError };

  const files = formData.getAll("file");
  const kinds = formData.getAll("kind");

  if (files.length === 0) {
    const pastedText = formData.get("pastedText");
    if (typeof pastedText === "string" && pastedText.trim()) {
      return extractPolicyFromText(pastedText);
    }
    return { ok: false, error: "Upload at least one document, or paste policy text." };
  }

  const docs: { kind: ExtractDocumentKind; filename: string; bytes: Buffer }[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const kindRaw = kinds[i];
    if (!(file instanceof File)) {
      return { ok: false, error: "One of the uploaded files wasn't received correctly." };
    }
    const kind = typeof kindRaw === "string" && VALID_KINDS.has(kindRaw as ExtractDocumentKind)
      ? (kindRaw as ExtractDocumentKind)
      : "other";
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return { ok: false, error: `"${file.name}" isn't a PDF — only PDF uploads are supported here.` };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    docs.push({ kind, filename: file.name, bytes: buffer });
  }

  if (!docs.some((d) => d.kind === "governing-policy")) {
    return { ok: false, error: "Tag at least one uploaded file as the governing policy." };
  }

  try {
    return await extractPolicyFromDocuments(docs);
  } catch (err) {
    log.error("Structured extraction threw", { message: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: "Extraction failed unexpectedly. Try again." };
  }
}

export async function saveExtractionDraft(input: {
  payer: string;
  drugLabel: string;
  data: ExtractedPolicy;
  validation: ValidationResult[];
  sourceText: ExtractSourceText[];
}): Promise<ExtractedDraft> {
  if (!input.payer?.trim() || !input.drugLabel?.trim()) {
    throw new Error("Payer and drug label are required to save a draft.");
  }
  const draft = await saveDraft(input);
  revalidatePath("/documents/extract");
  return draft;
}

export async function listExtractionDrafts(): Promise<ExtractedDraftSummary[]> {
  return listDrafts();
}

export async function getExtractionDraft(id: string): Promise<ExtractedDraft | undefined> {
  return getDraft(id);
}

export async function deleteExtractionDraft(id: string): Promise<void> {
  await deleteDraft(id);
  revalidatePath("/documents/extract");
}
