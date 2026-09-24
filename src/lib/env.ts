/**
 * Central place to read required environment variables — fails with a
 * clear, actionable message the moment the value is actually needed,
 * instead of a raw driver/SDK error surfacing deep inside an unrelated
 * request.
 */
export function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL is not set. Add your Postgres connection string to .env.local (and to Vercel's project Environment Variables for production)."
    );
  }
  return value;
}

/** Optional — features that depend on it (AI extraction, semantic search)
 *  degrade gracefully when it's absent, so this never throws. */
export function getOpenAiApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY || undefined;
}
