/**
 * The upgraded, nested-schema extraction pipeline — deliberately a separate
 * module from ./extract.ts (not a replacement of it). ./extract.ts still
 * backs the existing Document Library's manual "Add document" flow
 * (document-form.tsx), targeting today's live, flat PolicyDocument shape;
 * changing that file's exports would break a currently-working screen.
 * This module targets the new nested ./extracted-schema.ts shape instead,
 * and is consumed only by the new, additive /documents/extract route.
 */
import { getOpenAiApiKey } from "@/lib/env";
import { log } from "@/lib/log";
import { extractPageMarkedText } from "./pdf-text";
import { PHASE_A_SCHEMA, PHASE_B_SCHEMA } from "./extraction-json-schemas";
import { validateExtraction } from "./validate-extraction";
import type {
  ExtractDocumentKind,
  ExtractedCondition,
  ExtractedPolicy,
  ExtractResult,
  ExtractSourceDocument,
  GeneralRule,
  PolicyDrug,
  RelatedDocument,
} from "./extracted-schema";

const EXTRACTION_MODEL = "gpt-4o-mini";

/** One click can fan out into 1 + N OpenAI calls (N = conditions found) —
 *  this caps the fan-out, independent of whatever per-click rate limit the
 *  calling server action applies. */
const MAX_CONDITIONS_PER_RUN = 40;
const PHASE_B_CONCURRENCY = 4;

const KIND_LABEL: Record<ExtractDocumentKind, string> = {
  "governing-policy": "governing policy",
  "pa-form": "PA form",
  "general-policy": "general policy",
  other: "other",
};

const KIND_ORDER: ExtractDocumentKind[] = ["governing-policy", "pa-form", "general-policy", "other"];

interface PreparedDoc {
  kind: ExtractDocumentKind;
  filename: string;
  /** Page-marked ("--- Page N ---") text, local to this one document. */
  text: string;
}

interface PageRange {
  startPage: number;
  endPage: number;
}

interface ConditionIndexEntry {
  number: number;
  name: string;
  category: "FDA" | "other";
  startPage: number;
  endPage: number;
}

interface PhaseAResult {
  payer: string;
  policyNumber: string;
  title: string;
  benefit: "medical" | "pharmacy";
  route: string;
  drugs: PolicyDrug[];
  effectiveDate: string;
  reviewDate: string;
  relatedDocuments: RelatedDocument[];
  changeSummary: string;
  unitConversionNote: string | null;
  rules: GeneralRule[];
  conditionIndex: ConditionIndexEntry[];
  sharedSectionPages: {
    policyStatement: PageRange;
    dosingInformation: PageRange;
    codingInformation: PageRange;
    conditionsNotCovered: PageRange;
    revisionDetails: PageRange;
  };
}

// ---- shared OpenAI call ---------------------------------------------------

async function runStructuredChat(
  systemPrompt: string,
  userText: string,
  jsonSchema: { name: string; strict: boolean; schema: unknown }
): Promise<unknown> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key configured. Add OPENAI_API_KEY to .env.local, then restart the dev server."
    );
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: jsonSchema },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    log.error("Extraction chat call failed", {
      schema: jsonSchema.name,
      status: res.status,
      detail: detail.slice(0, 800),
    });
    throw new Error(`Extraction request failed (HTTP ${res.status}). Try again in a moment.`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string; refusal?: string } }[];
  };
  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`The extraction model declined: ${message.refusal}`);
  }
  const content = message?.content;
  if (!content) throw new Error("Extraction returned an empty response.");

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Extraction response wasn't valid JSON.");
  }
}

// ---- document prep / slicing ----------------------------------------------

function sortDocs(docs: PreparedDoc[]): PreparedDoc[] {
  return [...docs].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}

function buildFullText(docs: PreparedDoc[]): string {
  return sortDocs(docs)
    .map((d) => `=== DOCUMENT: ${d.filename} (${KIND_LABEL[d.kind]}) ===\n\n${d.text}`)
    .join("\n\n");
}

/** Extracts the inclusive [startPage, endPage] slice of a page-marked
 *  document's text. Falls back to the whole document whenever the
 *  requested range doesn't resolve cleanly — a slightly-too-wide slice
 *  costs a few extra tokens; a slightly-too-narrow one can silently drop
 *  the text a criterion needed. */
function sliceByPageRange(pageMarkedText: string, range: PageRange): string {
  const markerRe = /---\s*Page\s+(\d+)\s*---/g;
  const marks: { page: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(pageMarkedText))) {
    marks.push({ page: Number(m[1]), index: m.index });
  }
  if (marks.length === 0) return pageMarkedText;

  const startMark = marks.find((mk) => mk.page === range.startPage) ?? marks[0]!;
  const endMarkIdx = marks.findIndex((mk) => mk.page === range.endPage);
  const sliceEnd =
    endMarkIdx >= 0 && endMarkIdx + 1 < marks.length ? marks[endMarkIdx + 1]!.index : pageMarkedText.length;

  return sliceEnd > startMark.index ? pageMarkedText.slice(startMark.index, sliceEnd) : pageMarkedText;
}

// ---- Phase A: header + condition index ------------------------------------

const PHASE_A_SYSTEM_PROMPT = `You are filling a Summary of Benefits (SOB) for one drug, one payer, medical benefit, from the supplied coverage-policy documents.

RULES
1. Use only the supplied documents. Do not use outside knowledge.
2. For every field, cite the page it came from and a label: "Policy" (stated in a document), "Inferred" (concluded from the policy, not stated — use only when nothing is stated), or "Unverified" (needs confirmation from a source you can't read, e.g. an external drug list).
3. If the documents do not address a field, return the literal string "Not stated in policy" for text fields, or [] for list fields. Never guess.
4. Page-citation convention: anything from the governing policy is cited as a bare "p.N". Anything from another supplied document is cited as "<short name of that document> p.N" (e.g. "PAF-Botox p.2", "1605 p.2").
5. Site of care: use the governing policy's own rule if it states one (label "Policy"). Otherwise, if a general site-of-care policy was supplied AND the PA form asks about moving the patient to a lower-cost setting, that general policy applies (label "Policy", cite its own page). If neither settles it, say so in the text and label "Unverified".
6. This is the FIRST of a two-phase extraction. Return only policy/drug-level header fields and a CONDITION INDEX (number, name, category, and the page range *in the governing policy* where each numbered condition's full text lives) — do not extract any condition's criteria, prescriber rule, or dosing here; that happens per-condition in phase two. Also return the page ranges (in the governing policy) of these shared sections, if present: the Policy Statement, the general Dosing Information section, the Coding Information section, the Conditions Not Covered section, and the Revision Details page (usually the last page). If a section genuinely isn't present, use the same range as the nearest section you can find rather than an invalid range.
7. Revision Details table: this table usually lists MULTIPLE past revisions, one row per revision, each with its own "Review Date" and "Effective Date" columns. The policy's CURRENT reviewDate and effectiveDate are the LAST (bottommost / most recent) row of that table — not the first row, and not just whatever date appears on page 1. Read every row and use the last one. "changeSummary": from that same last row's "Summary of Changes" text, note what changed in the most recent revision (kept for change tracking even though it is never shown to the end user) — e.g. a dose limit that was lowered for certain conditions.
8. General rules ("rules" field): actively look for ALL FIVE kinds below, each as its own entry — do not stop after finding one kind. Most governing policies state several of these:
   - "not_covered": usually in the Policy Statement and/or a "Conditions Not Covered" section. Capture the FULL statement, not a one-line summary — if it names specific excluded combinations (e.g. concurrent use of another named drug, drug class, or therapy type), list them explicitly in the text; these specific exclusions are often the operative detail, not the generic "not covered for any other use" sentence around them.
   - "higher_dose": usually in the Policy Statement — what happens when a requested dose exceeds the stated limit (e.g. "reviewed case by case").
   - "documentation": usually in the Policy Statement — general documentation/chart-notes requirements that apply across all conditions (not a single condition's own criterion).
   - "renewal": usually in the Policy Statement — the rule for continuing/extending an existing approval.
   - "site_of_care": per rule 5 above.
   Every one of these 5 kinds gets exactly one entry in "rules", with no exceptions — if a kind genuinely has no stated text anywhere in the supplied documents, still include it with label "Unverified" and text explaining nothing settles it (this is itself useful information, e.g. "Not stated in policy; no general site-of-care policy was supplied"). Never simply omit a kind.
9. "relatedDocuments": list EVERY document supplied to you (the governing policy itself, and every other file, e.g. a PA form or a general policy), one entry each. Set "used": true if anything in your header fields or rules actually drew on that document's content, false if it was supplied but you found nothing to use from it. Use each document's own title/number as "number" (e.g. the PA form's own title), and "type" as a short description (e.g. "PA form", "general policy").
10. "unitConversionNote": if the policy states its OWN unit-conversion rule for approval-duration math (e.g. "1 month = 30 days" for counting how long a patient has been on therapy), quote it here verbatim. This is easy to miss because it's usually a single incidental sentence, not its own section — read carefully. null if no such rule is stated.
11. Plain English, short lines.

Return JSON matching the required schema.`;

async function runPhaseA(fullText: string): Promise<PhaseAResult> {
  return (await runStructuredChat(PHASE_A_SYSTEM_PROMPT, fullText, PHASE_A_SCHEMA)) as PhaseAResult;
}

// ---- Phase B: one condition at a time -------------------------------------

const PHASE_B_SYSTEM_PROMPT = `You are filling in ONE numbered condition of a Summary of Benefits (SOB), from the supplied excerpt of a coverage policy plus any PA form / general policy text also supplied.

RULES
1. Use only the supplied text. Do not use outside knowledge.
2. For every criterion and dosing rule, cite the page it came from (bare "p.N" for the governing policy, "<short name> p.N" for anything else) and the EXACT quote it came from. Copy the quote character-for-character from the supplied text — same words, same punctuation, same symbols (e.g. "≥", "±"), same capitalization — never paraphrase, correct, or retype it from memory. Prefer the SHORTEST exact phrase that still identifies the criterion (a clause or short sentence, not a whole paragraph) — a short exact copy is far more useful than a long one with a single word changed. Never invent a quote you cannot find in the supplied text.
3. Label every criterion/rule: "Policy" (stated), "Inferred" (concluded, not stated — rare), or "Unverified" (needs a source you can't read).
4. Keep this condition's logic exactly as written: ALL / BOTH / ONE, with nested groups — do not flatten or simplify it.
5. Keep "initial" and "continuation" branches separate, each with its own duration, if the policy splits them for this condition; otherwise return a single branch tagged "single". A patient under the minimum time on therapy, or restarting, is reviewed under the initial branch — set minTimeOnDrug on the continuation branch so that rule is explicit.
6. Mark fields already supplied at intake (not asked again as a PA question) with answerSource "intake": diagnosis/ICD-10 (check kind diagnosis-match), prescriber specialty/NPI (check kind npi-specialty-match), age (check kind age-check), site of administration (check kind site-of-care). Dose/frequency/duration are handled separately in "dosing", not as a criterion leaf. Mark anything resolved by the 271 eligibility transaction as answerSource "271" (rare inside a condition's own criteria). Mark anything that genuinely needs the requesting provider to attest as answerSource "provider", using check kind attestation-single (pick exactly one of a small set) or attestation-multi (any one of several findings is enough) as fits the policy's wording — step therapy ("tried at least one of...") is usually attestation-multi.
7. Dosing: list every distinct dose limit as its own flat row in "dosing". If a dose depends on more than one qualifier (e.g. by limb AND by age band), list every combination as its own row rather than nesting — put the full qualifier path in "qualifier" as plain text (e.g. "Upper limb · Child, 6 u/kg (cap 240u)").
8. ICD-10 codes: only include codes the supplied text actually states for this condition; [] if none are stated — do not guess a code from the condition name.
8b. "cptCode": the CPT procedure code for THIS condition's administration/injection, from the Coding Information section (distinct from the drug's own HCPCS code, which is reported once at the policy level, not per condition) — e.g. the injection or infusion procedure code billed alongside the drug code. null if the Coding Information section doesn't break CPT codes out per condition.
9. Write ages as "Age >=N" in the criterion's own "text" field; the structured "check" itself just needs minAge.
10. documentationRequired: true exactly when the policy marks this criterion "[documentation required]" or equivalent; otherwise false. This is independent of "text" — "text" is ALWAYS a required, non-empty, plain-English paraphrase of what the criterion requires, even when documentationRequired is true and even though "quote" separately holds the exact source wording. Never leave "text" blank.

Return JSON matching the required schema, for exactly this one condition.`;

async function runPhaseB(
  entry: ConditionIndexEntry,
  governingPolicyText: string,
  shared: PhaseAResult["sharedSectionPages"],
  otherDocsText: string
): Promise<ExtractedCondition> {
  const conditionSlice = sliceByPageRange(governingPolicyText, {
    startPage: entry.startPage,
    endPage: entry.endPage,
  });
  const sharedSlices = [
    shared.policyStatement,
    shared.dosingInformation,
    shared.codingInformation,
    shared.conditionsNotCovered,
  ]
    .map((range) => sliceByPageRange(governingPolicyText, range))
    .join("\n\n");

  const userText = [
    `Condition ${entry.number}: ${entry.name} (${entry.category})`,
    `=== GOVERNING POLICY — THIS CONDITION'S OWN TEXT (p.${entry.startPage}-${entry.endPage}) ===`,
    conditionSlice,
    `=== GOVERNING POLICY — SHARED SECTIONS (Policy Statement, Dosing Information, Coding Information, Conditions Not Covered) ===`,
    sharedSlices,
    otherDocsText,
  ].join("\n\n");

  const raw = (await runStructuredChat(PHASE_B_SYSTEM_PROMPT, userText, PHASE_B_SCHEMA)) as ExtractedCondition;
  // Structured Outputs occasionally emits the literal string "null" instead
  // of JSON null for an unset optional field — normalize it here so a
  // truthy-check in the renderer doesn't display the word "null".
  const cptCode = raw.cptCode && raw.cptCode !== "null" ? raw.cptCode : undefined;
  return {
    ...raw,
    number: entry.number,
    name: raw.name || entry.name,
    category: raw.category || entry.category,
    cptCode,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

// ---- pipeline --------------------------------------------------------------

async function runPipeline(prepared: PreparedDoc[]): Promise<ExtractResult> {
  const governingDoc = prepared.find((d) => d.kind === "governing-policy");
  if (!governingDoc) {
    return { ok: false, error: "Tag at least one uploaded file as the governing policy." };
  }

  const otherDocs = prepared.filter((d) => d.kind !== "governing-policy");
  const otherDocsText = otherDocs.length
    ? otherDocs.map((d) => `=== DOCUMENT: ${d.filename} (${KIND_LABEL[d.kind]}) ===\n\n${d.text}`).join("\n\n")
    : "(No PA form or general policy supplied.)";

  let phaseA: PhaseAResult;
  try {
    phaseA = await runPhaseA(buildFullText(prepared));
  } catch (err) {
    log.error("Phase A extraction failed", { message: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't extract the policy header." };
  }

  if (phaseA.conditionIndex.length === 0) {
    return { ok: false, error: "No numbered conditions were found in the governing policy." };
  }
  if (phaseA.conditionIndex.length > MAX_CONDITIONS_PER_RUN) {
    return {
      ok: false,
      error: `This policy lists ${phaseA.conditionIndex.length} conditions, over this tool's ${MAX_CONDITIONS_PER_RUN}-per-run limit.`,
    };
  }

  let conditions: ExtractedCondition[];
  try {
    conditions = await mapWithConcurrency(phaseA.conditionIndex, PHASE_B_CONCURRENCY, (entry) =>
      runPhaseB(entry, governingDoc.text, phaseA.sharedSectionPages, otherDocsText)
    );
  } catch (err) {
    log.error("Phase B extraction failed", { message: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't extract one of the conditions." };
  }

  const draft: ExtractedPolicy = {
    payer: phaseA.payer,
    policyNumber: phaseA.policyNumber,
    title: phaseA.title,
    benefit: phaseA.benefit,
    route: phaseA.route,
    drugs: phaseA.drugs,
    effectiveDate: phaseA.effectiveDate,
    reviewDate: phaseA.reviewDate,
    relatedDocuments: phaseA.relatedDocuments,
    changeSummary: phaseA.changeSummary,
    unitConversionNote: phaseA.unitConversionNote ?? undefined,
    conditions: conditions.sort((a, b) => a.number - b.number),
    rules: phaseA.rules,
  };

  const sourceDocs = prepared.map((d) => ({ kind: d.kind, filename: d.filename, text: d.text }));
  const validation = validateExtraction(draft, sourceDocs);

  return { ok: true, draft, validation, sourceDocs };
}

/**
 * Main entry point: one or more uploaded policy documents (governing policy
 * required; PA form / general policy / other optional) → a validated,
 * cited, nested policy draft. Each PDF is transcribed to page-marked text
 * first (pdf-text.ts), then extracted in two phases: Phase A reads
 * everything and returns header fields + a condition index; Phase B runs
 * once per condition (bounded concurrency), each call scoped to just that
 * condition's own text plus the shared sections and any PA-form/general-
 * policy text — not the whole governing policy resent per condition.
 */
export async function extractPolicyFromDocuments(docs: ExtractSourceDocument[]): Promise<ExtractResult> {
  if (docs.length === 0) {
    return { ok: false, error: "Upload at least one document." };
  }

  let prepared: PreparedDoc[];
  try {
    prepared = await Promise.all(
      docs.map(async (d) => ({
        kind: d.kind,
        filename: d.filename,
        text: await extractPageMarkedText(d.bytes, d.filename),
      }))
    );
  } catch (err) {
    log.error("PDF transcription failed", { message: err instanceof Error ? err.message : String(err) });
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't read one of the uploaded files." };
  }

  return runPipeline(prepared);
}

/** Paste-text fallback — skips pdf-text.ts, still goes through the same
 *  two-phase prompts, treating the pasted text as the governing policy. */
export async function extractPolicyFromText(rawText: string): Promise<ExtractResult> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste the policy document text above first." };
  }
  const text = /---\s*Page\s+\d+\s*---/i.test(trimmed) ? trimmed : `--- Page 1 ---\n\n${trimmed}`;
  return runPipeline([{ kind: "governing-policy", filename: "pasted-text", text }]);
}
