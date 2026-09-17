import { Pool } from "pg";

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
`;

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Postgres connection string to .env.local (and to Vercel's project Environment Variables for production)."
    );
  }
  return new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
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
