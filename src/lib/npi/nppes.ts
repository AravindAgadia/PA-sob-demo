import { ensureSchema, pool } from "@/lib/db";
import type { NpiLookupResult } from "../policy/types";

interface NppesTaxonomy {
  code: string;
  desc: string;
  primary: boolean;
}

interface NppesAddress {
  address_purpose?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  telephone_number?: string;
}

interface NppesResult {
  basic?: {
    organization_name?: string;
    first_name?: string;
    last_name?: string;
  };
  taxonomies?: NppesTaxonomy[];
  addresses?: NppesAddress[];
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

export interface NpiEnrollmentPrefill {
  npi: string;
  status: NpiLookupResult["status"];
  found: boolean;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  taxonomyDescription?: string;
  /** Never present for a real NPPES lookup — the registry carries none of
   *  these. Only the hardcoded demo entries below set them, so the wizard
   *  can fully prepopulate every mandatory Prescriber field from a single
   *  sample-NPI click instead of just name/address. */
  licenseState?: string;
  licenseNumber?: string;
  taxId?: string;
  email?: string;
}

function unresolvedPrefill(
  npi: string,
  status: Exclude<NpiLookupResult["status"], "resolved">
): NpiEnrollmentPrefill {
  return { npi, status, found: false };
}

/** The three NPIs advertised in the wizard's own "Try these" hint text —
 *  confirmed (via a direct registry call) not to be real registered
 *  providers on the live public NPPES registry, so they'd always dead-end
 *  as "not found" even with a healthy network. Hardcoded so the wizard's
 *  own advertised demo values work reliably regardless of live registry
 *  reachability; any other NPI still goes through the real lookup below. */
const DEMO_NPI_PREFILLS: Record<string, Omit<NpiEnrollmentPrefill, "npi" | "status" | "found">> = {
  "1234567890": {
    firstName: "Sarah",
    lastName: "Chen",
    addressLine1: "400 Meridian Ave",
    addressLine2: "Suite 220",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    phone: "(217) 555-0142",
    taxonomyDescription: "Neurology",
    licenseState: "IL",
    licenseNumber: "IL-884213",
    taxId: "47-1092233",
    email: "sarah.chen@springfieldneuro.example.com",
  },
  "1922334455": {
    firstName: "Michael",
    lastName: "Alvarez",
    addressLine1: "88 Harborview Dr",
    city: "Springfield",
    state: "IL",
    zip: "62702",
    phone: "(217) 555-0198",
    taxonomyDescription: "Gastroenterology",
    licenseState: "IL",
    licenseNumber: "IL-772910",
    taxId: "52-3391887",
    email: "michael.alvarez@springfieldgi.example.com",
  },
  "1015049598": {
    firstName: "Jennifer",
    lastName: "Park",
    addressLine1: "12 Westfield Blvd",
    city: "Springfield",
    state: "IL",
    zip: "62703",
    phone: "(217) 555-0176",
    taxonomyDescription: "Rheumatology",
    licenseState: "IL",
    licenseNumber: "IL-661457",
    taxId: "61-7743209",
    email: "jennifer.park@springfieldrheum.example.com",
  },
};

/**
 * A second, uncached NPPES lookup for the enrollment wizard's explicit
 * "Lookup" button — distinct from `lookupNpi` above because it needs the
 * discrete first/last name and practice-location address NPPES carries
 * but `lookupNpi`/`NpiLookupResult` don't model (that shape is wired into
 * the `npi_cache` table the automatic per-submit intake lookup depends on;
 * widening it risks that pipeline for a field set only this wizard needs).
 * Not cached: this is a rare, explicit, per-click call, not the automatic
 * lookup every intake submission makes, so the 24h cache's value doesn't
 * apply here.
 */
export async function lookupNpiForEnrollment(npi: string): Promise<NpiEnrollmentPrefill> {
  const trimmed = npi.trim();
  if (!/^\d{10}$/.test(trimmed)) {
    return unresolvedPrefill(trimmed, "invalid-format");
  }

  const demo = DEMO_NPI_PREFILLS[trimmed];
  if (demo) {
    return { npi: trimmed, status: "resolved", found: true, ...demo };
  }

  let data: NppesResponse;
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?number=${trimmed}&version=2.1`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return unresolvedPrefill(trimmed, "lookup-failed");
    data = (await res.json()) as NppesResponse;
  } catch {
    return unresolvedPrefill(trimmed, "lookup-failed");
  }

  const result = data.results?.[0];
  if (!result) {
    return unresolvedPrefill(trimmed, "not-found");
  }

  const primaryTaxonomy = result.taxonomies?.find((t) => t.primary) ?? result.taxonomies?.[0];
  const location =
    result.addresses?.find((a) => a.address_purpose === "LOCATION") ?? result.addresses?.[0];

  return {
    npi: trimmed,
    status: "resolved",
    found: true,
    firstName: result.basic?.first_name,
    lastName: result.basic?.last_name,
    organizationName: result.basic?.organization_name,
    addressLine1: location?.address_1,
    addressLine2: location?.address_2,
    city: location?.city,
    state: location?.state,
    zip: location?.postal_code,
    phone: location?.telephone_number,
    taxonomyDescription: primaryTaxonomy?.desc,
  };
}
