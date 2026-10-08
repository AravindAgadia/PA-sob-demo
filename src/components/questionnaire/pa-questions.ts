/**
 * Standard provider-questionnaire question set, transcribed from the
 * payer's PA question bank (ExplantionationInfo.xlsx). Shown as-is for
 * every drug/case rather than branching per policy — the source sheet
 * itself only varies by formulation/diagnosis branch, which this demo
 * doesn't attempt to replicate.
 */
export type PaQuestionType = "single-choice" | "yes-no" | "free-text";

export interface PaQuestion {
  /** Stable id used as the FollowUpAnswers key — the sheet's own
   *  sequence number (Q1..Q22), not its opaque numeric QuestionID. */
  id: string;
  type: PaQuestionType;
  prompt: string;
  notes?: string;
  options?: string[];
}

export const PA_QUESTIONS: PaQuestion[] = [
  {
    id: "Q1",
    type: "single-choice",
    notes: "IV formulation is the vial and SQ formulation is the prefilled syringe/pen",
    prompt: "Is this request for intravenous formulation (IV), subcutaneous formulation (SQ), or IV then SQ?",
    options: ["Intravenous formulation (IV)", "Subcutaneous formulation (SQ)", "IV, then followed by SQ"],
  },
  {
    id: "Q2",
    type: "single-choice",
    notes: "IV only",
    prompt: "What is the diagnosis or reason for treatment?",
    options: [
      "Crohn's disease, moderate to severe",
      "Ulcerative colitis, moderate to severe",
      "Immunotherapy related toxicities",
      "Acute Graft-versus-host disease (GVHD)",
      "Other",
    ],
  },
  {
    id: "Q3",
    type: "single-choice",
    notes: "SQ or IV then SQ",
    prompt: "What is the diagnosis or reason for treatment?",
    options: ["Crohn's disease, moderate to severe", "Ulcerative colitis, moderate to severe", "Other than what is listed above"],
  },
  {
    id: "Q4",
    type: "free-text",
    prompt: "Indicate the patient's diagnosis or reason for treatment.",
  },
  {
    id: "Q5",
    type: "single-choice",
    prompt: "Is this a request for initial or continuation of therapy?",
    options: ["Initial request", "Continuation request"],
  },
  {
    id: "Q6",
    type: "yes-no",
    prompt: "Is the patient undergoing immune checkpoint inhibitor therapy for a cancer diagnosis?",
  },
  {
    id: "Q7",
    type: "yes-no",
    prompt: "Is the patient experiencing moderate to severe diarrhea or colitis as a result of immune checkpoint inhibitor treatment?",
  },
  {
    id: "Q8",
    type: "yes-no",
    prompt: "Have symptoms persisted despite treatment with steroids?",
  },
  {
    id: "Q9",
    type: "yes-no",
    prompt: "Is the patient experiencing moderate to severe esophagitis, gastritis, or duodenitis as a result of immune checkpoint inhibitor treatment?",
  },
  {
    id: "Q10",
    type: "yes-no",
    prompt: "Have symptoms improved on corticosteroids or budesonide?",
  },
  {
    id: "Q11",
    type: "yes-no",
    prompt: "Does the patient have steroid-refractory disease?",
  },
  {
    id: "Q12",
    type: "yes-no",
    prompt: "Is the requested medication being initiated in combination with systemic corticosteroids?",
  },
  {
    id: "Q13",
    type: "yes-no",
    prompt: "Has the patient completed intravenous induction doses with Entyvio and is using subcutaneous Entyvio for maintenance therapy?",
  },
  {
    id: "Q14",
    type: "yes-no",
    prompt:
      "Has the patient been stabilized on intravenous Entyvio maintenance therapy and is switching to maintenance therapy with subcutaneous Entyvio?",
  },
  {
    id: "Q15",
    type: "yes-no",
    prompt: "Has the patient been receiving and is maintained on a stable dose of intravenous Entyvio?",
  },
  {
    id: "Q16",
    type: "yes-no",
    prompt: "Has the patient been receiving and is maintained on a stable dose of subcutaneous Entyvio?",
  },
  {
    id: "Q17",
    type: "yes-no",
    prompt: "Is there confirmation of clinically significant improvement or stabilization in clinical signs and symptoms of the disease?",
  },
  {
    id: "Q18",
    type: "yes-no",
    prompt:
      "Will the requested medication be used in combination with oral or topical Janus kinase (JAK) inhibitors, ozanimod, etrasimod, deucravacitinib, or any of the following biologic immunomodulators: tumor necrosis factor (TNF) antagonists, interleukin (IL)-23 inhibitors, IL-17 inhibitors, IL-6 inhibitors, IL-1 inhibitors, ustekinumab, abatacept, rituximab, or natalizumab?",
  },
  {
    id: "Q19",
    type: "yes-no",
    prompt: "Does the patient have an active, serious infection or a history of recurrent infections?",
  },
  {
    id: "Q20",
    type: "yes-no",
    prompt:
      "Does the patient have new or worsening neurological signs or symptoms of John Cunningham virus (JCV) infection or risk of progressive multifocal leukoencephalopathy (PML)?",
  },
  {
    id: "Q21",
    type: "single-choice",
    prompt: "How old is the patient?",
    options: ["0-5 years of age", "6 years of age or older"],
  },
  {
    id: "Q22",
    type: "single-choice",
    prompt: "How old is the patient?",
    options: ["0-17 years of age", "18 years of age or older"],
  },
];
