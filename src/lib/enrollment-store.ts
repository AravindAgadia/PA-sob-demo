import { randomUUID } from "crypto";
import { ensureSchema, pool } from "@/lib/db";
import type { EnrollmentData, EnrollStepId } from "@/components/enroll/types";

/**
 * CRUD for the `enrollments` table — a wizard session, draft or
 * submitted. Deliberately its own module (not store.ts), touching only
 * this new table, same precedent as extraction-store.ts.
 */

export interface EnrollmentSummary {
  id: string;
  draftNumber: string;
  status: "draft" | "submitted";
  step: EnrollStepId;
  payer: string;
  patientName: string;
  drugLabel: string;
  urgency: string;
  caseNumber: string | null;
  updatedAt: string;
}

export interface EnrollmentRecord extends EnrollmentSummary {
  data: EnrollmentData;
}

interface EnrollmentRow {
  id: string;
  draft_number: string;
  status: string;
  step: string;
  data: EnrollmentData;
  payer: string;
  patient_name: string;
  drug_label: string;
  urgency: string;
  case_id: string | null;
  case_number: string | null;
  created_at: Date;
  updated_at: Date;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowToSummary(row: EnrollmentRow): EnrollmentSummary {
  return {
    id: row.id,
    draftNumber: row.draft_number,
    status: row.status as "draft" | "submitted",
    step: row.step as EnrollStepId,
    payer: row.payer,
    patientName: row.patient_name,
    drugLabel: row.drug_label,
    urgency: row.urgency,
    caseNumber: row.case_number,
    updatedAt: toIso(row.updated_at),
  };
}

function rowToRecord(row: EnrollmentRow): EnrollmentRecord {
  return { ...rowToSummary(row), data: row.data };
}

function derivePayer(data: EnrollmentData): string {
  return data.payerPatient.payer;
}

function derivePatientName(data: EnrollmentData): string {
  return [data.payerPatient.patientFirstName, data.payerPatient.patientLastName]
    .filter(Boolean)
    .join(" ");
}

function deriveDrugLabel(data: EnrollmentData): string {
  return data.drug.drugDescription;
}

function deriveUrgency(data: EnrollmentData): string {
  return data.payerPatient.urgency;
}

export async function saveDraftEnrollment(input: {
  id?: string;
  data: EnrollmentData;
  step: EnrollStepId;
}): Promise<EnrollmentRecord> {
  await ensureSchema();
  const payer = derivePayer(input.data);
  const patientName = derivePatientName(input.data);
  const drugLabel = deriveDrugLabel(input.data);
  const urgency = deriveUrgency(input.data);

  if (input.id) {
    const { rows } = await pool.query<EnrollmentRow>(
      `UPDATE enrollments
       SET data = $2, step = $3, payer = $4, patient_name = $5, drug_label = $6, urgency = $7, updated_at = now()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [input.id, JSON.stringify(input.data), input.step, payer, patientName, drugLabel, urgency]
    );
    if (rows[0]) return rowToRecord(rows[0]);
    // Fell through: the id didn't match a draft row (e.g. already submitted,
    // or stale from a prior session) — fall back to creating a fresh one
    // rather than silently losing the user's in-progress edits.
  }

  const id = randomUUID();
  const { rows: seqRows } = await pool.query<{ n: string }>("SELECT nextval('draft_number_seq') AS n");
  const draftNumber = `DRAFT-${seqRows[0]!.n}`;
  const { rows } = await pool.query<EnrollmentRow>(
    `INSERT INTO enrollments (id, draft_number, status, step, data, payer, patient_name, drug_label, urgency)
     VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, draftNumber, input.step, JSON.stringify(input.data), payer, patientName, drugLabel, urgency]
  );
  return rowToRecord(rows[0]!);
}

export async function listEnrollments(): Promise<EnrollmentSummary[]> {
  await ensureSchema();
  const { rows } = await pool.query<EnrollmentRow>(
    "SELECT * FROM enrollments ORDER BY updated_at DESC"
  );
  return rows.map(rowToSummary);
}

export async function getEnrollment(id: string): Promise<EnrollmentRecord | undefined> {
  await ensureSchema();
  const { rows } = await pool.query<EnrollmentRow>("SELECT * FROM enrollments WHERE id = $1", [id]);
  return rows[0] ? rowToRecord(rows[0]) : undefined;
}

export async function deleteEnrollment(id: string): Promise<void> {
  await ensureSchema();
  await pool.query("DELETE FROM enrollments WHERE id = $1 AND status = 'draft'", [id]);
}
