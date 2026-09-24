import { headers } from "next/headers";

const buckets = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * In-memory sliding-window limiter, keyed by whatever string the caller
 * passes in (typically "<bucket>:<ip>"). Deliberately simple for a
 * single-instance demo: state resets on redeploy/restart and isn't shared
 * across serverless instances or regions — swap for a shared store (e.g.
 * Redis / Upstash) before this ever runs behind more than one instance.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= limit) {
    buckets.set(key, timestamps);
    return { allowed: false, retryAfterMs: timestamps[0]! + windowMs - now };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort caller identity from standard proxy headers — good enough
 *  to throttle abuse, not meant as a security/identity boundary. */
export async function callerKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** Throws a client-safe error once the caller has exceeded `limit` calls to
 *  `bucket` within `windowMs` — for call sites that already propagate
 *  thrown errors to the UI (e.g. via a try/catch in the caller). */
export async function assertRateLimit(bucket: string, limit: number, windowMs: number): Promise<void> {
  const key = `${bucket}:${await callerKey()}`;
  const { allowed, retryAfterMs } = rateLimit(key, limit, windowMs);
  if (!allowed) {
    throw new Error(`Too many requests — try again in ${Math.ceil(retryAfterMs / 1000)}s.`);
  }
}
