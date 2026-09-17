import type { PolicyDocument } from "../types";

/**
 * Hand-transcribed from Humana's "Tepezza (teprotumumab) — Pharmacy Coverage
 * Policy" (Medicaid - Indiana, effective 5/1/2026). Seeded on first run —
 * see src/lib/policy/store.ts for how ingested documents are persisted.
 */
export const tepezzaHumanaMedicaidIndiana: PolicyDocument = {
  id: "tepezza-humana-medicaid-in",
  drug: "Tepezza (teprotumumab)",
  payer: "Humana",
  lineOfBusiness: "Medicaid - Indiana",
  policyType: "Prior Authorization",
  effectiveDate: "2026-05-01",
  reviewDate: "2026-02-18",
  sourceNote:
    "No stable URL: Humana's site triggers a direct download rather than a browsable page for this document. The source PDF also carries version-freshness language instructing readers to verify against Humana's live coverage-policy page before relying on a saved copy.",
  approvalDuration: { initial: "Plan year", renewal: "Plan year" },
  notApplicable: [
    "No explicit age 18+ eligibility gate in this policy",
    "No ICD-10 code specified in this policy",
    "No step therapy requirement stated",
    "No site-of-care restriction stated",
    "No route-of-administration branching — IV solution is the only listed product",
  ],
  hasEmbedding: false,
  createdAt: "2026-02-18T00:00:00.000Z",
  criteria: [
    {
      id: "diagnosis",
      number: 1,
      label: "Diagnosis of thyroid eye disease",
      description: "Has a diagnosis of thyroid eye disease.",
      systemVerifiable: true,
      evaluator: {
        kind: "intake-text-match",
        field: "diagnosis",
        matchAny: ["thyroid eye disease", "e0500", "e05.00", "ted"],
      },
    },
    {
      id: "thyroid-status",
      number: 2,
      label: "Euthyroid or receiving correction",
      description:
        "Is euthyroid, or is currently receiving treatment to correct the thyroid levels.",
      systemVerifiable: false,
      evaluator: {
        kind: "attestation-single",
        question: "What is the member's thyroid status?",
        options: [
          { value: "euthyroid", label: "Euthyroid" },
          {
            value: "being-treated",
            label: "Currently receiving treatment to correct levels",
          },
          { value: "not-controlled", label: "Neither confirmed" },
        ],
        satisfyingValues: ["euthyroid", "being-treated"],
      },
    },
    {
      id: "prescriber-specialty",
      number: 3,
      label: "Prescriber specialty",
      description:
        "Prescribed by or in consultation with an ophthalmologist, endocrinologist, specialist, or physician who specializes in thyroid eye disease.",
      systemVerifiable: true,
      evaluator: {
        kind: "npi-specialty-match",
        specialtyKeywords: ["ophthalmol", "endocrin", "thyroid", "eye"],
      },
    },
    {
      id: "prior-therapy",
      number: 4,
      label: "Prior-therapy attestation",
      description:
        "The prescriber attests the member has not received a prior course of therapy (e.g., up to 8 infusions per lifetime).",
      systemVerifiable: false,
      evaluator: {
        kind: "attestation-single",
        question: "Has the member had a prior course of Tepezza therapy?",
        options: [
          {
            value: "attested-no-prior",
            label: "Prescriber attests: no prior course of therapy",
          },
          {
            value: "has-prior-therapy",
            label: "Cannot attest / member has had prior therapy",
          },
        ],
        satisfyingValues: ["attested-no-prior"],
      },
    },
    {
      id: "disease-severity",
      number: 5,
      label: "Moderate to severe TED",
      description:
        "Has moderate to severe thyroid eye disease, defined as at least one of the following findings.",
      systemVerifiable: false,
      evaluator: {
        kind: "attestation-multi",
        question: "Which of the following findings apply?",
        options: [
          { value: "lid-retraction", label: "≥ 2mm lid retraction" },
          { value: "soft-tissue", label: "Moderate or severe soft tissue involvement" },
          { value: "exophthalmos", label: "Exophthalmos ≥ 3mm above normal" },
          { value: "diplopia", label: "Diplopia" },
        ],
      },
    },
  ],
};
