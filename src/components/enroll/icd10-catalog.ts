export interface Icd10CatalogEntry {
  code: string;
  description: string;
}

/** A small, hardcoded reference set covering the conditions tied to the
 *  drugs already used elsewhere in this demo (Botox, Entyvio, Actemra,
 *  Xolair, Tepezza, Byooviz) — same spirit as DRUG_CATALOG: there's no
 *  real ICD-10 database here, just enough to make the autocomplete feel
 *  real for this demo's own scenarios. */
export const ICD10_CATALOG: Icd10CatalogEntry[] = [
  { code: "G43.709", description: "Chronic migraine, intractable" },
  { code: "G24.5", description: "Blepharospasm" },
  { code: "G51.3", description: "Clonic hemifacial spasm" },
  { code: "K50.90", description: "Crohn's disease, unspecified, without complications" },
  { code: "K51.90", description: "Ulcerative colitis, unspecified, without complications" },
  { code: "M05.79", description: "Rheumatoid arthritis with rheumatoid factor, unspecified site" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated" },
  { code: "L50.1", description: "Idiopathic urticaria" },
  { code: "H05.011", description: "Thyroid eye disease" },
  { code: "H35.3210", description: "Wet age-related macular degeneration (AMD)" },
];
