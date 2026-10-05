import { randomUUID } from "crypto";
import { ensureSchema, pool } from "@/lib/db";
import type { ExtractedPolicy, ExtractSourceText, ValidationResult } from "./extracted-schema";

/**
 * CRUD for the new, separate extracted_policy_drafts table — deliberately
 * its own module (not store.ts), touching only the new table. Nothing an
 * extracted draft does here can affect the live policies/criteria tables
 * store.ts manages, or any screen that reads from them.
 */

export interface ExtractedDraftSummary {
  id: string;
  payer: string;
  drugLabel: string;
  status: string;
  createdAt: string;
}

export interface ExtractedDraft extends ExtractedDraftSummary {
  data: ExtractedPolicy;
  validation: ValidationResult[];
  /** The transcribed source text every field was extracted from — kept so
   *  a draft can be re-validated or audited later without re-uploading the
   *  original PDFs (per the requirement that the policy text itself, not
   *  just the structured output, persists in the database). */
  sourceText: ExtractSourceText[];
}

interface DraftRow {
  id: string;
  payer: string;
  drug_label: string;
  status: string;
  data: ExtractedPolicy;
  validation: ValidationResult[];
  source_text: ExtractSourceText[];
  created_at: Date;
}

function rowToDraft(row: DraftRow): ExtractedDraft {
  return {
    id: row.id,
    payer: row.payer,
    drugLabel: row.drug_label,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    data: row.data,
    validation: row.validation,
    sourceText: row.source_text ?? [],
  };
}

export async function saveDraft(input: {
  payer: string;
  drugLabel: string;
  data: ExtractedPolicy;
  validation: ValidationResult[];
  sourceText: ExtractSourceText[];
}): Promise<ExtractedDraft> {
  await ensureSchema();
  const id = randomUUID();
  const status = input.validation.every((v) => v.found) ? "draft" : "needs-review";
  const { rows } = await pool.query<DraftRow>(
    `INSERT INTO extracted_policy_drafts (id, payer, drug_label, status, data, validation, source_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      input.payer,
      input.drugLabel,
      status,
      JSON.stringify(input.data),
      JSON.stringify(input.validation),
      JSON.stringify(input.sourceText),
    ]
  );
  return rowToDraft(rows[0]!);
}

export async function listDrafts(): Promise<ExtractedDraftSummary[]> {
  await ensureSchema();
  const { rows } = await pool.query<Pick<DraftRow, "id" | "payer" | "drug_label" | "status" | "created_at">>(
    "SELECT id, payer, drug_label, status, created_at FROM extracted_policy_drafts ORDER BY created_at DESC"
  );
  return rows.map((row) => ({
    id: row.id,
    payer: row.payer,
    drugLabel: row.drug_label,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

export async function getDraft(id: string): Promise<ExtractedDraft | undefined> {
  await ensureSchema();
  const { rows } = await pool.query<DraftRow>("SELECT * FROM extracted_policy_drafts WHERE id = $1", [id]);
  return rows[0] ? rowToDraft(rows[0]) : undefined;
}

export async function deleteDraft(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM extracted_policy_drafts WHERE id = $1", [id]);
}
