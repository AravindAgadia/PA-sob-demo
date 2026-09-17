const EMBEDDING_MODEL = "text-embedding-3-small";
/** Rough char cap well under the model's 8191-token limit — the text we
 *  embed is a short canonical summary (drug/payer/criteria), never the
 *  full raw document, so this is a safety margin, not a real constraint. */
const MAX_INPUT_CHARS = 8000;

/**
 * Embeds text via OpenAI, or returns null if no API key is configured or
 * the call fails for any reason. Semantic search is always an optional
 * enhancement layered on top of exact and keyword matching — a missing or
 * failing embedding must never block ingesting or matching a policy.
 */
export async function embedText(text: string): Promise<Float32Array | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, MAX_INPUT_CHARS),
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { data?: { embedding?: number[] }[] };
    const vector = data.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length === 0) return null;
    return Float32Array.from(vector);
  } catch {
    return null;
  }
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Formats an embedding as a pgvector literal (e.g. "[0.1,0.2,0.3]") for
 *  binding into a `$n::vector` query parameter. Similarity search itself
 *  runs in Postgres via pgvector's `<=>` operator, not in JS. */
export function toPgVector(embedding: Float32Array): string {
  return `[${Array.from(embedding).join(",")}]`;
}
