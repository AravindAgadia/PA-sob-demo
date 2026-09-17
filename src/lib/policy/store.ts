import { randomUUID } from "crypto";
import { existsSync } from "fs";
import path from "path";
import { ensureSchema, pool } from "@/lib/db";
import { embedText, toPgVector } from "./embeddings";
import { seedPolicies } from "./policies";
import type { CriterionDefinition, PolicyDocument, PolicySummary } from "./types";

const EMBEDDING_MODEL = "text-embedding-3-small";

interface PolicyRow {
  id: string;
  drug: string;
  payer: string;
  line_of_business: string;
  policy_type: string;
  effective_date: string;
  review_date: string;
  source_note: string;
  approval_initial: string;
  approval_renewal: string;
  not_applicable: string[];
  raw_text: string | null;
  embedding: unknown;
  created_at: Date;
}

interface CriterionRow {
  policy_id: string;
  id: string;
  number: number;
  label: string;
  description: string;
  system_verifiable: boolean;
  evaluator: CriterionDefinition["evaluator"];
}

function rowToCriterion(row: CriterionRow): CriterionDefinition {
  return {
    id: row.id,
    number: row.number,
    label: row.label,
    description: row.description,
    systemVerifiable: row.system_verifiable,
    evaluator: row.evaluator,
  };
}

async function loadCriteria(policyId: string): Promise<CriterionDefinition[]> {
  const { rows } = await pool.query<CriterionRow>(
    "SELECT * FROM criteria WHERE policy_id = $1 ORDER BY number ASC",
    [policyId]
  );
  return rows.map(rowToCriterion);
}

/** One query for many policies' criteria instead of one query per policy —
 *  `hydratePolicies` uses this so listing/searching a page of results
 *  doesn't cost N+1 round trips. */
async function loadCriteriaForPolicies(policyIds: string[]): Promise<Map<string, CriterionDefinition[]>> {
  const byPolicy = new Map<string, CriterionDefinition[]>();
  if (policyIds.length === 0) return byPolicy;
  const { rows } = await pool.query<CriterionRow>(
    "SELECT * FROM criteria WHERE policy_id = ANY($1) ORDER BY policy_id, number ASC",
    [policyIds]
  );
  for (const row of rows) {
    const list = byPolicy.get(row.policy_id);
    const criterion = rowToCriterion(row);
    if (list) list.push(criterion);
    else byPolicy.set(row.policy_id, [criterion]);
  }
  return byPolicy;
}

function policyBase(row: PolicyRow): Omit<PolicyDocument, "criteria"> {
  return {
    id: row.id,
    drug: row.drug,
    payer: row.payer,
    lineOfBusiness: row.line_of_business,
    policyType: row.policy_type,
    effectiveDate: row.effective_date,
    reviewDate: row.review_date,
    sourceNote: row.source_note,
    approvalDuration: { initial: row.approval_initial, renewal: row.approval_renewal },
    notApplicable: row.not_applicable,
    rawText: row.raw_text ?? undefined,
    hasEmbedding: row.embedding !== null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function hydratePolicy(row: PolicyRow): Promise<PolicyDocument> {
  const criteria = await loadCriteria(row.id);
  return { ...policyBase(row), criteria };
}

async function hydratePolicies(rows: PolicyRow[]): Promise<PolicyDocument[]> {
  const criteriaByPolicy = await loadCriteriaForPolicies(rows.map((r) => r.id));
  return rows.map((row) => ({ ...policyBase(row), criteria: criteriaByPolicy.get(row.id) ?? [] }));
}

function rowToSummary(
  row: Pick<PolicyRow, "id" | "drug" | "payer" | "line_of_business">,
  criteriaCount: number
): PolicySummary {
  return {
    id: row.id,
    drug: row.drug,
    payer: row.payer,
    lineOfBusiness: row.line_of_business,
    criteriaCount,
  };
}

function buildSearchText(input: {
  drug: string;
  payer: string;
  lineOfBusiness: string;
  sourceNote: string;
  criteria: CriterionDefinition[];
}): string {
  const criteriaText = input.criteria.map((c) => `${c.label} ${c.description}`).join(" ");
  return [input.drug, input.payer, input.lineOfBusiness, input.sourceNote, criteriaText].join(" ");
}

function embeddingSourceText(input: {
  drug: string;
  payer: string;
  lineOfBusiness: string;
  criteria: CriterionDefinition[];
}): string {
  const criteriaText = input.criteria.map((c) => c.label).join("; ");
  return `${input.drug} — ${input.payer}, ${input.lineOfBusiness}. Criteria: ${criteriaText}`;
}

/** Turns free-text into a prefix-matching, OR-joined tsquery — each token
 *  is stripped to alphanumerics so punctuation in a drug name (parens,
 *  hyphens) or stray user input can't produce invalid tsquery syntax. */
function toTsQuery(raw: string): string {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean);
  return tokens.map((t) => `${t}:*`).join(" | ");
}

async function insertPolicy(policy: PolicyDocument, embedding: Float32Array | null): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO policies
        (id, drug, payer, line_of_business, policy_type, effective_date, review_date,
         source_note, approval_initial, approval_renewal, not_applicable, raw_text,
         embedding, embedding_model, created_at, search_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        policy.id,
        policy.drug,
        policy.payer,
        policy.lineOfBusiness,
        policy.policyType,
        policy.effectiveDate,
        policy.reviewDate,
        policy.sourceNote,
        policy.approvalDuration.initial,
        policy.approvalDuration.renewal,
        JSON.stringify(policy.notApplicable),
        policy.rawText ?? null,
        embedding ? toPgVector(embedding) : null,
        embedding ? EMBEDDING_MODEL : null,
        policy.createdAt,
        buildSearchText(policy),
      ]
    );
    for (const c of policy.criteria) {
      await client.query(
        `INSERT INTO criteria (policy_id, id, number, label, description, system_verifiable, evaluator)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [policy.id, c.id, c.number, c.label, c.description, c.systemVerifiable, JSON.stringify(c.evaluator)]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// --- one-time seed / migration -------------------------------------------

/** Imports data from a previous local SQLite store (`data/app.db`) on
 *  first connection to Postgres, so switching backends doesn't discard
 *  whatever had already been ingested there — including embeddings, which
 *  carry over as-is rather than being recomputed. */
async function migrateFromSqliteIfPresent(): Promise<boolean> {
  const sqlitePath = path.join(process.cwd(), "data", "app.db");
  if (!existsSync(sqlitePath)) return false;

  const { DatabaseSync } = await import("node:sqlite");
  let sqliteDb: InstanceType<typeof DatabaseSync>;
  try {
    sqliteDb = new DatabaseSync(sqlitePath, { readOnly: true });
  } catch (err) {
    console.error("Could not open the legacy SQLite store for migration:", err);
    return false;
  }

  try {
    const policyRows = sqliteDb.prepare("SELECT * FROM policies").all() as Record<string, unknown>[];
    if (policyRows.length === 0) return false;

    let migratedCount = 0;
    for (const row of policyRows) {
      try {
        const criteriaRows = sqliteDb
          .prepare("SELECT * FROM criteria WHERE policy_id = ? ORDER BY number ASC")
          .all(row.id as string) as Record<string, unknown>[];
        const criteria: CriterionDefinition[] = criteriaRows.map((c) => ({
          id: c.id as string,
          number: c.number as number,
          label: c.label as string,
          description: c.description as string,
          systemVerifiable: c.system_verifiable === 1,
          evaluator: JSON.parse(c.evaluator as string),
        }));

        const embeddingBlob = row.embedding as Uint8Array | null;
        const embedding = embeddingBlob
          ? new Float32Array(embeddingBlob.buffer, embeddingBlob.byteOffset, embeddingBlob.byteLength / 4)
          : null;

        const policy: PolicyDocument = {
          id: row.id as string,
          drug: row.drug as string,
          payer: row.payer as string,
          lineOfBusiness: row.line_of_business as string,
          policyType: row.policy_type as string,
          effectiveDate: row.effective_date as string,
          reviewDate: row.review_date as string,
          sourceNote: row.source_note as string,
          approvalDuration: {
            initial: row.approval_initial as string,
            renewal: row.approval_renewal as string,
          },
          notApplicable: JSON.parse(row.not_applicable as string),
          rawText: (row.raw_text as string | null) ?? undefined,
          hasEmbedding: embedding !== null,
          createdAt: row.created_at as string,
          criteria,
        };
        await insertPolicy(policy, embedding);
        migratedCount += 1;
      } catch (err) {
        // Skip this row, not the whole migration — one malformed legacy
        // record must not silently abort the rest and fall through to
        // re-seeding demo fixtures on top of a partial real migration.
        console.error(`Failed to migrate policy "${row.id}" from the legacy SQLite store — skipping it:`, err);
      }
    }

    if (migratedCount < policyRows.length) {
      console.error(
        `Migrated ${migratedCount} of ${policyRows.length} policies from the legacy SQLite store. The rest failed — check the errors above and re-add them via the Document Library if needed.`
      );
    }
    return migratedCount > 0;
  } finally {
    sqliteDb.close();
  }
}

let initPromise: Promise<void> | null = null;

/** Lazily creates the schema and, on an empty database, migrates from the
 *  previous local store or seeds the demo fixtures. Every exported
 *  function below awaits this first — cheap after the first call in a
 *  warm process. */
function init(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await ensureSchema();
      const { rows } = await pool.query<{ n: string }>("SELECT COUNT(*) AS n FROM policies");
      if (Number(rows[0].n) === 0) {
        const migrated = await migrateFromSqliteIfPresent();
        if (!migrated) {
          for (const policy of seedPolicies) {
            await insertPolicy({ ...policy, hasEmbedding: false }, null);
          }
        }
      }
    })();
  }
  return initPromise;
}

// --- reads -----------------------------------------------------------------

export async function getPolicy(id: string): Promise<PolicyDocument | undefined> {
  await init();
  const { rows } = await pool.query<PolicyRow>("SELECT * FROM policies WHERE id = $1", [id]);
  return rows[0] ? hydratePolicy(rows[0]) : undefined;
}

export interface ListPoliciesResult {
  items: PolicyDocument[];
  total: number;
}

/** Paginated, optionally keyword-filtered listing for the Document Library —
 *  never loads the whole catalog into memory or into the page. */
export async function listPolicies({
  page = 1,
  pageSize = 20,
  query,
}: { page?: number; pageSize?: number; query?: string } = {}): Promise<ListPoliciesResult> {
  await init();
  const offset = (page - 1) * pageSize;
  const trimmed = query?.trim();

  if (trimmed) {
    const tsQuery = toTsQuery(trimmed);
    if (!tsQuery) return { items: [], total: 0 };
    const { rows } = await pool.query<PolicyRow>(
      `SELECT * FROM policies
       WHERE search_vector @@ to_tsquery('english', $1)
       ORDER BY ts_rank(search_vector, to_tsquery('english', $1)) DESC, created_at DESC
       LIMIT $2 OFFSET $3`,
      [tsQuery, pageSize, offset]
    );
    const { rows: countRows } = await pool.query<{ n: string }>(
      "SELECT COUNT(*) AS n FROM policies WHERE search_vector @@ to_tsquery('english', $1)",
      [tsQuery]
    );
    return { items: await hydratePolicies(rows), total: Number(countRows[0].n) };
  }

  const { rows } = await pool.query<PolicyRow>(
    "SELECT * FROM policies ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    [pageSize, offset]
  );
  const { rows: countRows } = await pool.query<{ n: string }>("SELECT COUNT(*) AS n FROM policies");
  return { items: await hydratePolicies(rows), total: Number(countRows[0].n) };
}

export async function countPolicies(): Promise<number> {
  await init();
  const { rows } = await pool.query<{ n: string }>("SELECT COUNT(*) AS n FROM policies");
  return Number(rows[0].n);
}

/** One query for many policies' criteria counts instead of one per row. */
async function countCriteriaForPolicies(policyIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (policyIds.length === 0) return counts;
  const { rows } = await pool.query<{ policy_id: string; n: string }>(
    "SELECT policy_id, COUNT(*) AS n FROM criteria WHERE policy_id = ANY($1) GROUP BY policy_id",
    [policyIds]
  );
  for (const row of rows) counts.set(row.policy_id, Number(row.n));
  return counts;
}

/** Lightweight results for pickers/comboboxes over a large catalog — an
 *  empty query returns the most recently added documents as a sane default
 *  instead of an empty list. */
export async function searchPolicySummaries(query: string, limit = 10): Promise<PolicySummary[]> {
  await init();
  const trimmed = query.trim();
  type SummaryRow = Pick<PolicyRow, "id" | "drug" | "payer" | "line_of_business">;

  let rows: SummaryRow[];
  if (!trimmed) {
    ({ rows } = await pool.query<SummaryRow>(
      "SELECT id, drug, payer, line_of_business FROM policies ORDER BY created_at DESC LIMIT $1",
      [limit]
    ));
  } else {
    const tsQuery = toTsQuery(trimmed);
    if (!tsQuery) return [];
    ({ rows } = await pool.query<SummaryRow>(
      `SELECT id, drug, payer, line_of_business FROM policies
       WHERE search_vector @@ to_tsquery('english', $1)
       ORDER BY ts_rank(search_vector, to_tsquery('english', $1)) DESC
       LIMIT $2`,
      [tsQuery, limit]
    ));
  }

  const counts = await countCriteriaForPolicies(rows.map((r) => r.id));
  return rows.map((r) => rowToSummary(r, counts.get(r.id) ?? 0));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function drugMatches(a: string, b: string): boolean {
  const an = normalize(a);
  const bn = normalize(b);
  return an.length > 0 && bn.length > 0 && (an.includes(bn) || bn.includes(an));
}

/** Prefers a true exact (case/whitespace-insensitive) drug-name match over
 *  a substring match, so two ingested policies with overlapping drug names
 *  (e.g. a brand name and a biosimilar that contains it, "Xolair" vs.
 *  "Xolair-PF") don't get picked ambiguously when the request's drug name
 *  exactly matches one of them. Falls back to substring containment, most
 *  recently ingested first, only when no exact name match exists. */
function pickBestDrugMatch(rows: PolicyRow[], drug: string): PolicyRow | undefined {
  const drugNorm = normalize(drug);
  const exact = rows.find((r) => normalize(r.drug) === drugNorm);
  if (exact) return exact;
  return rows.find((r) => drugMatches(drug, r.drug));
}

/** Exact drug + payer + line-of-business lookup. The payer/LOB equality
 *  check is indexed, so this narrows to a handful of rows before the
 *  drug-name check runs in JS — it stays fast at scale because it never
 *  scans the whole catalog. */
export async function findExactPolicy(
  drug: string,
  payer: string,
  lineOfBusiness: string
): Promise<PolicyDocument | undefined> {
  await init();
  const { rows } = await pool.query<PolicyRow>(
    "SELECT * FROM policies WHERE lower(payer) = $1 AND lower(line_of_business) = $2 ORDER BY created_at DESC",
    [normalize(payer), normalize(lineOfBusiness)]
  );
  const match = pickBestDrugMatch(rows, drug);
  return match ? hydratePolicy(match) : undefined;
}

export async function findPolicyByDrugAndPayer(
  drug: string,
  payer: string
): Promise<PolicyDocument | undefined> {
  await init();
  const { rows } = await pool.query<PolicyRow>(
    "SELECT * FROM policies WHERE lower(payer) = $1 ORDER BY created_at DESC",
    [normalize(payer)]
  );
  const match = pickBestDrugMatch(rows, drug);
  return match ? hydratePolicy(match) : undefined;
}

/** Keyword fallback when nothing matches on drug+payer — indexed via
 *  Postgres full-text search, so it scales with catalog size instead of
 *  scanning every row. */
export async function searchPoliciesByKeyword(query: string, limit = 5): Promise<PolicyDocument[]> {
  await init();
  const trimmed = query.trim();
  if (!trimmed) return [];
  const tsQuery = toTsQuery(trimmed);
  if (!tsQuery) return [];
  const { rows } = await pool.query<PolicyRow>(
    `SELECT * FROM policies
     WHERE search_vector @@ to_tsquery('english', $1)
     ORDER BY ts_rank(search_vector, to_tsquery('english', $1)) DESC
     LIMIT $2`,
    [tsQuery, limit]
  );
  return hydratePolicies(rows);
}

export interface SemanticMatch {
  policy: PolicyDocument;
  similarity: number;
}

/** Embeds `queryText` and ranks it against every embedded policy by pgvector
 *  cosine similarity, using the HNSW index rather than brute-force JS. */
export async function searchPoliciesBySemanticSimilarity(
  queryText: string,
  limit = 3
): Promise<SemanticMatch[]> {
  await init();
  const queryEmbedding = await embedText(queryText);
  if (!queryEmbedding) return [];

  const vector = toPgVector(queryEmbedding);
  const { rows } = await pool.query<PolicyRow & { similarity: number }>(
    `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
     FROM policies
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector ASC
     LIMIT $2`,
    [vector, limit]
  );

  return Promise.all(
    rows.map(async (row) => ({ policy: await hydratePolicy(row), similarity: Number(row.similarity) }))
  );
}

// --- writes ------------------------------------------------------------

export type NewPolicyInput = Omit<PolicyDocument, "id" | "createdAt" | "hasEmbedding">;

export async function addPolicy(input: NewPolicyInput): Promise<PolicyDocument> {
  await init();
  const embedding = await embedText(embeddingSourceText(input));
  const policy: PolicyDocument = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    hasEmbedding: embedding !== null,
  };
  await insertPolicy(policy, embedding);
  return policy;
}

export async function deletePolicy(id: string): Promise<void> {
  await init();
  await pool.query("DELETE FROM policies WHERE id = $1", [id]);
}
