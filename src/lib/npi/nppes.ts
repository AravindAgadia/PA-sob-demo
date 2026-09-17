import { ensureSchema, pool } from "@/lib/db";
import type { NpiLookupResult } from "../policy/types";

interface NppesTaxonomy {
  code: string;
  desc: string;
  primary: boolean;
}

interface NppesResult {
  basic?: {
    organization_name?: string;
    first_name?: string;
    last_name?: string;
  };
  taxonomies?: NppesTaxonomy[];
}

interface NppesResponse {
  result_count: number;
  results?: NppesResult[];
}

interface NpiCacheRow {
  npi: string;
  status: string;
  found: boolean;
  provider_name: string | null;
  taxonomy_code: string | null;
  taxonomy_description: string | null;
  fetched_at: Date;
}

/** NPPES records rarely change; caching avoids re-hitting the public
 *  registry for every request that reuses the same prescriber NPI. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function rowToResult(row: NpiCacheRow): NpiLookupResult {
  return {
    npi: row.npi,
    status: row.status as NpiLookupResult["status"],
    found: row.found,
    providerName: row.provider_name ?? undefined,
    taxonomyCode: row.taxonomy_code ?? undefined,
    taxonomyDescription: row.taxonomy_description ?? undefined,
    source: "nppes-live",
  };
}

async function getCached(npi: string): Promise<NpiLookupResult | null> {
  await ensureSchema();
  const { rows } = await pool.query<NpiCacheRow>("SELECT * FROM npi_cache WHERE npi = $1", [npi]);
  const row = rows[0];
  if (!row) return null;
  const age = Date.now() - new Date(row.fetched_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return rowToResult(row);
}

async function setCached(result: NpiLookupResult): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO npi_cache (npi, status, found, provider_name, taxonomy_code, taxonomy_description, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (npi) DO UPDATE SET
       status = excluded.status,
       found = excluded.found,
       provider_name = excluded.provider_name,
       taxonomy_code = excluded.taxonomy_code,
       taxonomy_description = excluded.taxonomy_description,
       fetched_at = excluded.fetched_at`,
    [
      result.npi,
      result.status,
      result.found,
      result.providerName ?? null,
      result.taxonomyCode ?? null,
      result.taxonomyDescription ?? null,
      new Date().toISOString(),
    ]
  );
}

function unresolved(
  npi: string,
  status: Exclude<NpiLookupResult["status"], "resolved">
): NpiLookupResult {
  return { npi, status, found: false, source: "nppes-live" };
}

/**
 * Live call to the public NPPES NPI Registry API — no auth required.
 * https://npiregistry.cms.hhs.gov/api/
 *
 * Returns raw taxonomy data only. Whether a taxonomy satisfies a given
 * policy's specialty requirement is policy-specific, so that comparison
 * happens in the evaluator against each criterion's own keyword list.
 *
 * The status field distinguishes "couldn't check" from "checked, no match"
 * so callers never mistake a registry outage or a malformed NPI for a
 * prescriber who genuinely lacks the required specialty. Resolved and
 * not-found results are cached; a transient lookup failure is not, so a
 * retry can succeed once the registry is reachable again.
 */
export async function lookupNpi(npi: string): Promise<NpiLookupResult> {
  const trimmed = npi.trim();
  if (!/^\d{10}$/.test(trimmed)) {
    return unresolved(trimmed, "invalid-format");
  }

  const cached = await getCached(trimmed);
  if (cached) return cached;

  let data: NppesResponse;
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?number=${trimmed}&version=2.1`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return unresolved(trimmed, "lookup-failed");
    data = (await res.json()) as NppesResponse;
  } catch {
    return unresolved(trimmed, "lookup-failed");
  }

  const result = data.results?.[0];
  if (!result) {
    const notFound = unresolved(trimmed, "not-found");
    await setCached(notFound);
    return notFound;
  }

  const primaryTaxonomy =
    result.taxonomies?.find((t) => t.primary) ?? result.taxonomies?.[0];
  const taxonomyDescription = primaryTaxonomy?.desc ?? "Unknown specialty";

  const providerName =
    result.basic?.organization_name ??
    [result.basic?.first_name, result.basic?.last_name].filter(Boolean).join(" ");

  const resolved: NpiLookupResult = {
    npi: trimmed,
    status: "resolved",
    found: true,
    providerName: providerName || undefined,
    taxonomyCode: primaryTaxonomy?.code,
    taxonomyDescription,
    source: "nppes-live",
  };
  await setCached(resolved);
  return resolved;
}
