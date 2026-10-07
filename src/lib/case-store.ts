import { randomUUID } from "crypto";
import { ensureSchema, pool } from "@/lib/db";
import type { IntakeRunResult } from "@/app/actions";
import type { CaseDecision, FollowUpAnswers } from "@/lib/policy/types";

/**
 * CRUD for the `cases` table — a submitted enrollment's eligibility/
 * policy-match snapshot plus its live decision state. Its own module,
 * same precedent as extraction-store.ts/enrollment-store.ts.
 */

/** Everything IntakeRunResult carries except `results` — those are always
 *  re-derived via evaluatePolicy (policy criteria + answers), never
 *  stored, exactly like the in-memory flow this replaces. */
export type CaseRunData = Omit<IntakeRunResult, "results">;

export interface CaseSummary {
  id: string;
  caseNumber: string;
  enrollmentId: string;
  payer: string;
  patientName: string;
  drugLabel: string;
  decision: CaseDecision;
  createdAt: string;
}

export interface CaseRecord extends CaseSummary {
  runData: CaseRunData;
  answers: FollowUpAnswers;
  declineReason: string | null;
  closedAt: string | null;
}

interface CaseRow {
  id: string;
  case_number: string;
  enrollment_id: string;
  run_data: CaseRunData;
  answers: FollowUpAnswers;
  decision: string;
  decline_reason: string | null;
  closed_at: Date | null;
  created_at: Date;
  payer: string;
  patient_name: string;
  drug_label: string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function rowToSummary(row: CaseRow): CaseSummary {
  return {
    id: row.id,
    caseNumber: row.case_number,
    enrollmentId: row.enrollment_id,
    payer: row.payer,
    patientName: row.patient_name,
    drugLabel: row.drug_label,
    decision: row.decision as CaseDecision,
    createdAt: toIso(row.created_at),
  };
}

function rowToRecord(row: CaseRow): CaseRecord {
  return {
    ...rowToSummary(row),
    runData: row.run_data,
    answers: row.answers ?? {},
    declineReason: row.decline_reason,
    closedAt: row.closed_at ? toIso(row.closed_at) : null,
  };
}

const CASE_SELECT = `
  SELECT c.*, e.payer AS payer, e.patient_name AS patient_name, e.drug_label AS drug_label
  FROM cases c
  JOIN enrollments e ON e.id = c.enrollment_id
`;

/** The one transactional write in this codebase — allocating a case
 *  number, inserting the case, and marking the enrollment submitted all
 *  need to land together or not at all. */
export async function createCaseForEnrollment(
  enrollmentId: string,
  runData: CaseRunData
): Promise<CaseSummary> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: seqRows } = await client.query<{ n: string }>("SELECT nextval('case_number_seq') AS n");
    const caseNumber = `CASE-${seqRows[0]!.n}`;
    const id = randomUUID();
    await client.query(
      `INSERT INTO cases (id, case_number, enrollment_id, run_data)
       VALUES ($1, $2, $3, $4)`,
      [id, caseNumber, enrollmentId, JSON.stringify(runData)]
    );
    await client.query(
      `UPDATE enrollments SET status = 'submitted', case_id = $2, case_number = $3 WHERE id = $1`,
      [enrollmentId, id, caseNumber]
    );
    await client.query("COMMIT");
    return {
      id,
      caseNumber,
      enrollmentId,
      payer: runData.intake.payer,
      patientName: `${runData.intake.patientFirstName} ${runData.intake.patientLastName}`.trim(),
      drugLabel: runData.intake.drug,
      decision: "pending",
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listCases(): Promise<CaseSummary[]> {
  await ensureSchema();
  const { rows } = await pool.query<CaseRow>(`${CASE_SELECT} ORDER BY c.created_at DESC`);
  return rows.map(rowToSummary);
}

export async function getCaseByNumber(caseNumber: string): Promise<CaseRecord | undefined> {
  await ensureSchema();
  const { rows } = await pool.query<CaseRow>(`${CASE_SELECT} WHERE c.case_number = $1`, [caseNumber]);
  return rows[0] ? rowToRecord(rows[0]) : undefined;
}

export async function updateCaseAnswers(
  caseNumber: string,
  answers: FollowUpAnswers
): Promise<CaseRecord | undefined> {
  await ensureSchema();
  const { rows } = await pool.query<CaseRow>(
    `UPDATE cases SET answers = $2, updated_at = now() WHERE case_number = $1 RETURNING id`,
    [caseNumber, JSON.stringify(answers)]
  );
  if (!rows[0]) return undefined;
  return getCaseByNumber(caseNumber);
}

export async function proceedCase(caseNumber: string): Promise<CaseRecord | undefined> {
  await ensureSchema();
  await pool.query(
    `UPDATE cases SET decision = 'proceeded', updated_at = now() WHERE case_number = $1`,
    [caseNumber]
  );
  return getCaseByNumber(caseNumber);
}

export async function declineCase(
  caseNumber: string,
  reason: string
): Promise<CaseRecord | undefined> {
  await ensureSchema();
  await pool.query(
    `UPDATE cases
     SET decision = 'declined', decline_reason = $2, closed_at = now(), updated_at = now()
     WHERE case_number = $1`,
    [caseNumber, reason || null]
  );
  return getCaseByNumber(caseNumber);
}
