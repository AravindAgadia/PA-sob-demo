"use server";

import { revalidatePath } from "next/cache";
import { log } from "@/lib/log";
import { extractPolicyFromFile, extractPolicyFromText, type ExtractResult } from "@/lib/policy/extract";
import { rateLimit, callerKey } from "@/lib/rate-limit";
import {
  addPolicy,
  deletePolicy,
  searchPolicySummaries,
  type NewPolicyInput,
} from "@/lib/policy/store";
import type { PolicySummary } from "@/lib/policy/types";

/** Generous cap for a full policy document's pasted text (SQLite handles
 *  large TEXT columns fine) — this just guards against pathological input. */
const MAX_RAW_TEXT_LENGTH = 200_000;

/**
 * Server Actions are reachable via direct POST requests, not just through
 * this app's own form — never trust that client-side validation already ran.
 */
function validateNewPolicy(input: NewPolicyInput): string | null {
  if (!input.drug?.trim()) return "Drug is required.";
  if (!input.payer?.trim()) return "Payer is required.";
  if (!input.lineOfBusiness?.trim()) return "Line of business is required.";
  if (!Array.isArray(input.criteria) || input.criteria.length === 0) {
    return "At least one criterion is required.";
  }
  for (const criterion of input.criteria) {
    if (!criterion.id?.trim() || !criterion.label?.trim()) {
      return "Every criterion needs a label.";
    }
    const evaluator = criterion.evaluator;
    switch (evaluator.kind) {
      case "intake-text-match":
        if (!evaluator.matchAny || evaluator.matchAny.length === 0) {
          return `Criterion "${criterion.label}" needs at least one match keyword.`;
        }
        break;
      case "npi-specialty-match":
        if (!evaluator.specialtyKeywords || evaluator.specialtyKeywords.length === 0) {
          return `Criterion "${criterion.label}" needs at least one specialty keyword.`;
        }
        break;
      case "attestation-single":
        if (!evaluator.options || evaluator.options.length === 0) {
          return `Criterion "${criterion.label}" needs at least one option.`;
        }
        if (!evaluator.satisfyingValues || evaluator.satisfyingValues.length === 0) {
          return `Criterion "${criterion.label}" needs at least one option marked as satisfying it.`;
        }
        break;
      case "attestation-multi":
        if (!evaluator.options || evaluator.options.length === 0) {
          return `Criterion "${criterion.label}" needs at least one option.`;
        }
        break;
      default:
        return `Criterion "${criterion.label}" has an unrecognized evaluator type.`;
    }
  }
  if (input.rawText && input.rawText.length > MAX_RAW_TEXT_LENGTH) {
    return `Source document text is too long (max ${MAX_RAW_TEXT_LENGTH.toLocaleString()} characters).`;
  }
  return null;
}

export async function createPolicyDocument(input: NewPolicyInput) {
  const validationError = validateNewPolicy(input);
  if (validationError) {
    throw new Error(validationError);
  }

  try {
    const policy = await addPolicy({
      ...input,
      drug: input.drug.trim(),
      payer: input.payer.trim(),
      lineOfBusiness: input.lineOfBusiness.trim(),
      policyType: input.policyType?.trim() || "Prior Authorization",
    });
    revalidatePath("/documents");
    revalidatePath("/");
    return policy;
  } catch (err) {
    log.error("Failed to save policy document", {
      message: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Couldn't save this document right now. Try again in a moment.");
  }
}

export async function deletePolicyDocument(id: string) {
  if (!id?.trim()) {
    throw new Error("A document id is required.");
  }
  try {
    await deletePolicy(id);
    revalidatePath("/documents");
    revalidatePath("/");
  } catch (err) {
    log.error("Failed to delete policy document", {
      id,
      message: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Couldn't remove this document right now. Try again in a moment.");
  }
}

/** Typeahead search backing the drug/policy combobox — safe to call
 *  frequently as the user types, since it's FTS-indexed rather than a
 *  full-table scan. */
export async function searchPolicies(query: string): Promise<PolicySummary[]> {
  return searchPolicySummaries(query, 10);
}

/** Extraction hits a paid OpenAI endpoint per call — cap it independently
 *  of every other action so one caller can't run up the bill. */
const EXTRACT_LIMIT = 5;
const EXTRACT_WINDOW_MS = 5 * 60 * 1000;

async function checkExtractRateLimit(): Promise<string | null> {
  const key = `extract:${await callerKey()}`;
  const { allowed, retryAfterMs } = rateLimit(key, EXTRACT_LIMIT, EXTRACT_WINDOW_MS);
  if (!allowed) {
    return `Too many extraction requests — try again in ${Math.ceil(retryAfterMs / 1000)}s.`;
  }
  return null;
}

/** AI-assisted extraction of a policy draft from pasted document text —
 *  only ever prefills the "Add document" form for manual review. */
export async function extractPolicy(rawText: string): Promise<ExtractResult> {
  const limitError = await checkExtractRateLimit();
  if (limitError) return { ok: false, error: limitError };
  return extractPolicyFromText(rawText);
}

/** Generous cap for an uploaded PDF — well under OpenAI's request-size
 *  limits once base64-encoded, and no policy document should need more. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Same as {@link extractPolicy}, but from an uploaded PDF file rather than
 *  pasted text — takes FormData since a File can't cross the Server Action
 *  boundary as a plain argument. */
export async function extractPolicyFromUpload(formData: FormData): Promise<ExtractResult> {
  const limitError = await checkExtractRateLimit();
  if (limitError) return { ok: false, error: limitError };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file was received by the server." };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return {
      ok: false,
      error: "Only PDF files can be uploaded here — for a text file, paste its contents instead.",
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `"${file.name}" is too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB).`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return extractPolicyFromFile(buffer.toString("base64"), file.name);
}
