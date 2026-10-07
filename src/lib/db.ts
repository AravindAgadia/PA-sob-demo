import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/env";

/**
 * Real, network-accessible Postgres — required for serverless deployment
 * (Vercel functions have no persistent/shared local disk, which is why the
 * project moved off SQLite). Any Postgres works: Vercel Postgres, Neon,
 * Supabase, or a self-hosted instance — this only needs a connection
 * string in DATABASE_URL.
 *
 * Uses pgvector for semantic search (real indexed similarity search, not
 * brute-force JS) and native tsvector full-text search in place of SQLite's
 * FTS5.
 */
const SCHEMA_SQL = `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    drug TEXT NOT NULL,
    payer TEXT NOT NULL,
    line_of_business TEXT NOT NULL,
    policy_type TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    review_date TEXT NOT NULL,
    source_note TEXT NOT NULL,
    approval_initial TEXT NOT NULL,
    approval_renewal TEXT NOT NULL,
    not_applicable JSONB NOT NULL,
    raw_text TEXT,
    embedding vector(1536),
    embedding_model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    search_text TEXT NOT NULL DEFAULT '',
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', search_text)) STORED
  );

  CREATE INDEX IF NOT EXISTS idx_policies_search_vector ON policies USING GIN (search_vector);
  CREATE INDEX IF NOT EXISTS idx_policies_drug ON policies (lower(drug));
  CREATE INDEX IF NOT EXISTS idx_policies_payer ON policies (lower(payer));
  CREATE INDEX IF NOT EXISTS idx_policies_lob ON policies (lower(line_of_business));
  CREATE INDEX IF NOT EXISTS idx_policies_created_at ON policies (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_policies_embedding ON policies USING hnsw (embedding vector_cosine_ops);

  CREATE TABLE IF NOT EXISTS criteria (
    policy_id TEXT NOT NULL REFERENCES policies (id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    number INTEGER NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    system_verifiable BOOLEAN NOT NULL,
    evaluator JSONB NOT NULL,
    PRIMARY KEY (policy_id, id)
  );

  CREATE INDEX IF NOT EXISTS idx_criteria_policy ON criteria (policy_id);

  CREATE TABLE IF NOT EXISTS npi_cache (
    npi TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    found BOOLEAN NOT NULL,
    provider_name TEXT,
    taxonomy_code TEXT,
    taxonomy_description TEXT,
    fetched_at TIMESTAMPTZ NOT NULL
  );

  -- Drafts from the upgraded (nested-schema) extraction pipeline — separate
  -- from "policies"/"criteria" above, which still back the live matching
  -- engine and Document Library on today's flat schema. Keeping this table
  -- apart means landing richer extraction output never risks the
  -- currently-working app.
  CREATE TABLE IF NOT EXISTS extracted_policy_drafts (
    id TEXT PRIMARY KEY,
    payer TEXT NOT NULL,
    drug_label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    data JSONB NOT NULL,
    validation JSONB NOT NULL,
    source_text JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE extracted_policy_drafts ADD COLUMN IF NOT EXISTS source_text JSONB NOT NULL DEFAULT '[]';

  CREATE INDEX IF NOT EXISTS idx_extracted_drafts_created_at ON extracted_policy_drafts (created_at DESC);

  -- Persisted enrollment-wizard sessions (draft or submitted) and the
  -- cases created from a submitted one — the enrollment wizard was
  -- originally stateless; this is the pivot to real save/resume and a
  -- lookup-able case history.
  CREATE SEQUENCE IF NOT EXISTS draft_number_seq START 10000;

  CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY,
    draft_number TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    step TEXT NOT NULL DEFAULT 'payer-patient',
    data JSONB NOT NULL,
    payer TEXT NOT NULL DEFAULT '',
    patient_name TEXT NOT NULL DEFAULT '',
    drug_label TEXT NOT NULL DEFAULT '',
    case_id TEXT,
    case_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS draft_number TEXT NOT NULL DEFAULT '';

  CREATE INDEX IF NOT EXISTS idx_enrollments_status_updated ON enrollments (status, updated_at DESC);

  CREATE SEQUENCE IF NOT EXISTS case_number_seq START 10000;

  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    case_number TEXT NOT NULL UNIQUE,
    enrollment_id TEXT NOT NULL REFERENCES enrollments (id) ON DELETE CASCADE,
    run_data JSONB NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}',
    decision TEXT NOT NULL DEFAULT 'pending',
    decline_reason TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_cases_enrollment ON cases (enrollment_id);
  CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases (created_at DESC);
`;

function createPool(): Pool {
  const connectionString = getDatabaseUrl();
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  // Managed Postgres providers (Vercel Postgres, Neon, Supabase, RDS, ...)
  // all present valid, publicly-trusted certificates — verify them by
  // default. DATABASE_SSL_INSECURE=true is an explicit escape hatch for a
  // self-hosted instance with a self-signed cert; never set it against a
  // provider you don't control.
  const allowInsecureTls = process.env.DATABASE_SSL_INSECURE === "true";
  return new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: !allowInsecureTls },
    max: 5,
  });
}

// Cache the pool on the Node global so Next.js dev-mode module reloads
// (Fast Refresh / Turbopack HMR) don't open a fresh pool on every edit.
const globalForDb = globalThis as unknown as { __sobPool?: Pool };

export const pool = globalForDb.__sobPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sobPool = pool;
}

let schemaReady: Promise<void> | null = null;

/** Idempotent — safe to call at the top of every store function. Cheap
 *  after the first call within a warm process; on a cold start it re-runs
 *  the (all `IF NOT EXISTS`) DDL once, which is the standard "migrate on
 *  boot" approach for a project this size. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(SCHEMA_SQL).then(() => undefined);
  }
  return schemaReady;
}
