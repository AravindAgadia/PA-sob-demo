import type {
  CriterionNode,
  ExtractedCondition,
  ExtractedPolicy,
  GeneralRule,
} from "./extracted-schema";

/**
 * Transforms a raw ExtractedPolicy into the six-section view model the
 * sample Summary of Benefits documents use (Cigna_SOB_Botox.docx /
 * Cigna_SOB_Entyvio.docx) — pure data shaping, kept out of the page
 * component so the rendering stays simple.
 */

function collectLeaves(node: CriterionNode, out: ReturnType<typeof makeLeafList>): void {
  if (node.type === "group") {
    node.items.forEach((item) => collectLeaves(item, out));
    return;
  }
  out.push(node);
}
function makeLeafList() {
  return [] as Extract<CriterionNode, { type: "leaf" }>[];
}

function findRule(rules: GeneralRule[], kind: GeneralRule["kind"]): GeneralRule | undefined {
  return rules.find((r) => r.kind === kind);
}

export interface SobViewModel {
  payer: string;
  title: string;
  drugSummary: string;
  benefitSummary: string;
  governingPolicySummary: string;
  coverageAtAGlance: {
    paRequired: string;
    coveredDiagnoses: string;
    prescriber: string;
    stepTherapy: string;
    approvalDuration: string;
    notCovered: GeneralRule | undefined;
  };
  conditions: ExtractedCondition[];
  doseRows: { conditionName: string; branch: string; text: string; page: string }[];
  unitConversionNote?: string;
  siteOfCare: GeneralRule | undefined;
  documentation: {
    intakeItems: string[];
    providerItems: { text: string; page: string }[];
    rule: GeneralRule | undefined;
  };
  relatedDocumentsNotUsed: string[];
}

export function buildSobViewModel(policy: ExtractedPolicy): SobViewModel {
  const drug = policy.drugs[0];
  const drugSummary = drug
    ? `${drug.brand}${drug.generic ? ` (${drug.generic})` : ""}`
    : policy.title;
  const benefitSummary = `${policy.benefit === "medical" ? "Medical" : "Pharmacy"} · ${drug?.hcpcs ?? "—"} (per ${drug?.unit ?? "—"})`;
  const governingPolicySummary = `${policy.policyNumber} · eff. ${policy.effectiveDate}`;

  const fdaCount = policy.conditions.filter((c) => c.category === "FDA").length;
  const otherCount = policy.conditions.length - fdaCount;
  const coveredDiagnoses = `${policy.conditions.length} condition${policy.conditions.length === 1 ? "" : "s"}: ${fdaCount} FDA-approved, ${otherCount} other use${otherCount === 1 ? "" : "s"} with supporting evidence`;

  const withPrescriber = policy.conditions.filter((c) => c.prescriber && c.prescriber.specialties.length > 0);
  const prescriber =
    withPrescriber.length > 0
      ? `Specialist required for ${withPrescriber.length} condition${withPrescriber.length === 1 ? "" : "s"}: ${withPrescriber
          .map((c) => c.name)
          .join(", ")}. No prescriber requirement stated for the rest.`
      : "No prescriber requirement stated.";

  const stepConditions = policy.conditions.filter((c) =>
    c.branches.some((b) => {
      const leaves = makeLeafList();
      collectLeaves(b.criteria, leaves);
      return leaves.some(
        (l) => l.check.kind === "attestation-multi" || /tried|step|prior therapy/i.test(l.text)
      );
    })
  );
  const stepTherapy =
    stepConditions.length > 0
      ? `Required for ${stepConditions.length} condition${stepConditions.length === 1 ? "" : "s"}: ${stepConditions
          .map((c) => c.name)
          .join(", ")}.`
      : "No step-therapy requirement stated.";

  const durations = new Set(policy.conditions.flatMap((c) => c.branches.map((b) => `${b.branch}: ${b.duration}`)));
  const approvalDuration = Array.from(durations).join("; ") || "Not stated in policy";

  const doseRows = policy.conditions.flatMap((c) =>
    c.dosing.map((d) => ({
      conditionName: c.name,
      branch: d.branch,
      text: `${d.maxDose} ${d.unit} · ${d.interval}${d.qualifier ? ` · ${d.qualifier}` : ""}`,
      page: c.page,
    }))
  );

  // Every SOB always has these baseline items ticked "From intake" — they're
  // fixed facts about how the PA request form works, not something that
  // depends on whether this particular policy happens to carry a matching
  // criterion leaf (dosing, in particular, is never part of the criteria
  // tree at all, so it would otherwise never appear here). Site of
  // administration is included only when the policy actually has an
  // applicable, policy-stated site-of-care rule (matching how the sample
  // SOBs include it for Entyvio but not for Botox).
  const siteOfCareRule = findRule(policy.rules, "site_of_care");
  const intakeItemsSet = new Set<string>([
    "Diagnosis and ICD-10 code",
    "Prescriber specialty and NPI",
    "Dose, frequency and duration",
  ]);
  if (siteOfCareRule?.label === "Policy") {
    intakeItemsSet.add("Site of administration");
  }
  const providerItems: { text: string; page: string }[] = [];
  for (const condition of policy.conditions) {
    for (const branch of condition.branches) {
      const leaves = makeLeafList();
      collectLeaves(branch.criteria, leaves);
      for (const leaf of leaves) {
        if (leaf.answerSource === "intake") {
          intakeItemsSet.add(leaf.label);
        } else if (leaf.documentationRequired) {
          providerItems.push({ text: `${condition.name}: ${leaf.text}`, page: leaf.page });
        }
      }
    }
  }

  return {
    payer: policy.payer,
    title: policy.title,
    drugSummary,
    benefitSummary,
    governingPolicySummary,
    coverageAtAGlance: {
      paRequired: "Required",
      coveredDiagnoses,
      prescriber,
      stepTherapy,
      approvalDuration,
      notCovered: findRule(policy.rules, "not_covered"),
    },
    conditions: policy.conditions,
    doseRows,
    unitConversionNote: policy.unitConversionNote,
    siteOfCare: siteOfCareRule,
    documentation: {
      intakeItems: Array.from(intakeItemsSet),
      providerItems,
      rule: findRule(policy.rules, "documentation"),
    },
    relatedDocumentsNotUsed: policy.relatedDocuments.filter((d) => !d.used).map((d) => d.number),
  };
}
