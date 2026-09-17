import type { PolicyDocument } from "../types";

/**
 * Demo fixture — a second ingested policy, deliberately a different drug,
 * payer, and line of business than the Tepezza/Humana document. Proves the
 * matching/evaluation engine isn't special-cased to one policy.
 */
export const xolairAnthemCommercial: PolicyDocument = {
  id: "xolair-anthem-commercial",
  drug: "Xolair (omalizumab)",
  payer: "Anthem",
  lineOfBusiness: "Commercial",
  policyType: "Prior Authorization",
  effectiveDate: "2026-01-01",
  reviewDate: "2025-11-03",
  sourceNote:
    "Demo fixture, not transcribed from a live payer document — added to exercise a second drug/payer/line-of-business combination end to end.",
  approvalDuration: { initial: "6 months", renewal: "12 months" },
  notApplicable: [
    "No explicit age gate in this fixture",
    "No route-of-administration branching",
  ],
  hasEmbedding: false,
  createdAt: "2025-11-03T00:00:00.000Z",
  criteria: [
    {
      id: "diagnosis",
      number: 1,
      label: "Diagnosis of moderate-to-severe asthma or chronic idiopathic urticaria",
      description:
        "Has a diagnosis of moderate-to-severe persistent asthma or chronic idiopathic urticaria (CIU).",
      systemVerifiable: true,
      evaluator: {
        kind: "intake-text-match",
        field: "diagnosis",
        matchAny: ["asthma", "urticaria", "ciu"],
      },
    },
    {
      id: "prescriber-specialty",
      number: 2,
      label: "Prescriber specialty",
      description:
        "Prescribed by or in consultation with an allergist, immunologist, or pulmonologist.",
      systemVerifiable: true,
      evaluator: {
        kind: "npi-specialty-match",
        specialtyKeywords: ["allerg", "immunol", "pulmonol"],
      },
    },
    {
      id: "step-therapy",
      number: 3,
      label: "Step-therapy attestation",
      description:
        "The prescriber attests the member has had an inadequate response to standard controller therapy.",
      systemVerifiable: false,
      evaluator: {
        kind: "attestation-single",
        question:
          "Has the member had an inadequate response to standard controller therapy?",
        options: [
          {
            value: "attested-inadequate-response",
            label: "Prescriber attests: inadequate response to standard therapy",
          },
          { value: "not-attested", label: "Cannot attest" },
        ],
        satisfyingValues: ["attested-inadequate-response"],
      },
    },
  ],
};
