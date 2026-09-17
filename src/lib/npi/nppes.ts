import type { NpiLookupResult } from "../policy/types";

const REQUIRED_SPECIALTY_KEYWORDS = ["ophthalmol", "endocrin", "thyroid", "eye"];

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

const NOT_FOUND: Omit<NpiLookupResult, "npi"> = {
  found: false,
  matchesRequiredSpecialty: false,
  source: "nppes-live",
};

/**
 * Live call to the public NPPES NPI Registry API — no auth required.
 * https://npiregistry.cms.hhs.gov/api/
 */
export async function lookupNpi(npi: string): Promise<NpiLookupResult> {
  const trimmed = npi.trim();
  if (!/^\d{10}$/.test(trimmed)) {
    return { npi: trimmed, ...NOT_FOUND };
  }

  let data: NppesResponse;
  try {
    const url = `https://npiregistry.cms.hhs.gov/api/?number=${trimmed}&version=2.1`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { npi: trimmed, ...NOT_FOUND };
    data = (await res.json()) as NppesResponse;
  } catch {
    return { npi: trimmed, ...NOT_FOUND };
  }

  const result = data.results?.[0];
  if (!result) {
    return { npi: trimmed, ...NOT_FOUND };
  }

  const primaryTaxonomy =
    result.taxonomies?.find((t) => t.primary) ?? result.taxonomies?.[0];
  const taxonomyDescription = primaryTaxonomy?.desc ?? "Unknown specialty";
  const matchesRequiredSpecialty = REQUIRED_SPECIALTY_KEYWORDS.some((kw) =>
    taxonomyDescription.toLowerCase().includes(kw)
  );

  const providerName =
    result.basic?.organization_name ??
    [result.basic?.first_name, result.basic?.last_name].filter(Boolean).join(" ");

  return {
    npi: trimmed,
    found: true,
    providerName: providerName || undefined,
    taxonomyCode: primaryTaxonomy?.code,
    taxonomyDescription,
    matchesRequiredSpecialty,
    source: "nppes-live",
  };
}
