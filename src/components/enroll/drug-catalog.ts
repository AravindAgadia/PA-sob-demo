export interface DrugCatalogEntry {
  label: string;
  ndc: string;
  hcpcsCode: string;
}

/** A small, hardcoded reference catalog backing the Drug Description
 *  autocomplete — there's no real NDC/HCPCS database in this app (the
 *  policy-matching seed data only covers Tepezza and Xolair, and neither
 *  carries billing codes), so this exists purely to let the demo
 *  auto-fill NDC + HCPCS/CPT together when a known drug is selected. */
export const DRUG_CATALOG: DrugCatalogEntry[] = [
  { label: "Botox (onabotulinumtoxinA) 100 UNIT Injection", ndc: "00023-1145-01", hcpcsCode: "J0585" },
  { label: "Entyvio (vedolizumab) 300 MG Injection", ndc: "64764-0300-01", hcpcsCode: "J3380" },
  { label: "Actemra (tocilizumab) 200 MG/10ML Injection", ndc: "50242-0135-01", hcpcsCode: "J3262" },
  { label: "Xolair (omalizumab) 150 MG Injection", ndc: "50242-0040-62", hcpcsCode: "J2357" },
  { label: "Tepezza (teprotumumab-trbw) 500 MG Injection", ndc: "50242-0100-01", hcpcsCode: "J3241" },
];
