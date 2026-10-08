export interface DrugCatalogEntry {
  label: string;
  ndc: string;
  hcpcsCode: string;
}

/** A small, hardcoded reference catalog backing the Drug Description
 *  autocomplete — there's no real NDC/HCPCS database in this app, so this
 *  exists purely to let the demo auto-fill NDC + HCPCS/CPT together when a
 *  known drug is selected. Codes are illustrative, not verified billing
 *  data. The brand name (the leading word, per `brandNameOf` in
 *  src/app/enroll/actions.ts) is what actually matters: it's what
 *  `findMatchingExtractedDraft` compares against a saved Document Library
 *  draft's own drug_label, so each entry here is named to line up with
 *  the real extracted drafts in the Document Library (Xolair, Vyepti,
 *  Riabni, Skyrizi, Simponi Aria, Xgeva, Alyglo, Dexcom G6 CGM System,
 *  Avsola, Byooviz, Enbrel, Entyvio) so picking one in the wizard and a
 *  matching payer (Cigna / Humana) actually surfaces its Benefit Summary. */
export const DRUG_CATALOG: DrugCatalogEntry[] = [
  { label: "Botox (onabotulinumtoxinA) 100 UNIT Injection", ndc: "00023-1145-01", hcpcsCode: "J0585" },
  { label: "Entyvio (vedolizumab) 300 MG Injection", ndc: "64764-0300-01", hcpcsCode: "J3380" },
  { label: "Actemra (tocilizumab) 200 MG/10ML Injection", ndc: "50242-0135-01", hcpcsCode: "J3262" },
  { label: "Xolair (omalizumab) 150 MG Injection", ndc: "50242-0040-62", hcpcsCode: "J2357" },
  { label: "Tepezza (teprotumumab-trbw) 500 MG Injection", ndc: "50242-0100-01", hcpcsCode: "J3241" },
  { label: "Vyepti (eptinezumab-jjmr) 100 MG Injection", ndc: "00002-1455-01", hcpcsCode: "J3032" },
  { label: "Riabni (rituximab-arrx) 100 MG/10ML Injection", ndc: "55513-0126-01", hcpcsCode: "Q5123" },
  { label: "Skyrizi (risankizumab-rzaa) 150 MG Injection", ndc: "0074-1402-01", hcpcsCode: "J0791" },
  { label: "Simponi Aria (golimumab) 50 MG/4ML IV Injection", ndc: "57894-0601-01", hcpcsCode: "J1602" },
  { label: "Xgeva (denosumab) 120 MG Injection", ndc: "55513-0730-01", hcpcsCode: "J0897" },
  { label: "Alyglo (immune globulin) 10% Injection", ndc: "71811-0101-01", hcpcsCode: "J1599" },
  {
    label: "Dexcom G6 CGM System",
    ndc: "N/A (device, not a drug)",
    hcpcsCode: "A4239",
  },
  { label: "Avsola (infliximab-axxq) 100 MG Injection", ndc: "00069-0287-01", hcpcsCode: "Q5121" },
  { label: "Byooviz (ranibizumab-nuna) 6 MG/0.05ML Injection", ndc: "63459-0601-01", hcpcsCode: "Q5124" },
  { label: "Enbrel (etanercept) 50 MG Injection", ndc: "58406-0445-01", hcpcsCode: "J1438" },
];
