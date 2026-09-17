const EXTRACTION_MODEL = "gpt-4o-mini";
const MAX_INPUT_CHARS = 50_000;

const VALID_KINDS = new Set([
  "intake-text-match",
  "npi-specialty-match",
  "attestation-single",
  "attestation-multi",
]);
const VALID_INTAKE_FIELDS = new Set(["diagnosis", "drug", "dispensingLocation", "payer"]);

const SYSTEM_PROMPT = `You extract structured prior-authorization criteria from a payer's coverage policy document. Read the pasted text and return ONLY a JSON object (no markdown, no commentary, no code fences) with this exact shape:

{
  "drug": string,
  "payer": string,
  "lineOfBusiness": string,
  "policyType": string,
  "effectiveDate": string,
  "reviewDate": string,
  "sourceNote": string,
  "approvalInitial": string,
  "approvalRenewal": string,
  "notApplicable": string[],
  "criteria": [
    {
      "label": string,
      "description": string,
      "kind": "intake-text-match" | "npi-specialty-match" | "attestation-single" | "attestation-multi",
      "intakeField": "diagnosis" | "drug" | "dispensingLocation" | "payer" | null,
      "matchAny": string[] | null,
      "specialtyKeywords": string[] | null,
      "question": string | null,
      "options": string[] | null,
      "satisfyingOptions": string[] | null
    }
  ]
}

Field notes:
- "lineOfBusiness": e.g. "Commercial", "Medicaid - <State>", "Medicare Advantage".
- "effectiveDate" / "reviewDate": YYYY-MM-DD if stated, else "".
- "notApplicable": requirements this policy explicitly does NOT impose (no age gate, no step therapy, etc.) — [] if none noted.
- Use "intake-text-match" for anything checkable against the request's diagnosis, drug, dispensing location, or payer (set "intakeField" and "matchAny"; leave other criterion fields null).
- Use "npi-specialty-match" for prescriber-specialty requirements (set "specialtyKeywords"; leave other criterion fields null).
- Use "attestation-single" when the prescriber must pick exactly one answer from a small set (set "question", "options", and "satisfyingOptions" — the subset of "options" that satisfy the criterion; leave other criterion fields null).
- Use "attestation-multi" when satisfied by selecting one or more findings from a list, any one being enough (set "question" and "options"; leave other criterion fields null).
- Only include criteria actually stated in the text — never invent requirements. Return between 1 and 15 criteria.
- Any field not stated in the text should be "" (or null / [] as typed above), not omitted.`;

export interface ExtractedCriterion {
  label: string;
  description: string;
  kind: "intake-text-match" | "npi-specialty-match" | "attestation-single" | "attestation-multi";
  intakeField: "diagnosis" | "drug" | "dispensingLocation" | "payer" | null;
  matchAny: string[] | null;
  specialtyKeywords: string[] | null;
  question: string | null;
  options: string[] | null;
  satisfyingOptions: string[] | null;
}

export interface ExtractedPolicy {
  drug: string;
  payer: string;
  lineOfBusiness: string;
  policyType: string;
  effectiveDate: string;
  reviewDate: string;
  sourceNote: string;
  approvalInitial: string;
  approvalRenewal: string;
  notApplicable: string[];
  criteria: ExtractedCriterion[];
}

export type ExtractResult = { ok: true; policy: ExtractedPolicy } | { ok: false; error: string };

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function nullableStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function nullableStrArray(v: unknown): string[] | null {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
}

function coerceCriterion(raw: unknown): ExtractedCriterion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = str(r.label).trim();
  if (!label) return null;

  const kindRaw = str(r.kind);
  const kind = (
    VALID_KINDS.has(kindRaw) ? kindRaw : "attestation-single"
  ) as ExtractedCriterion["kind"];

  const intakeFieldRaw = nullableStr(r.intakeField);
  const intakeField =
    intakeFieldRaw && VALID_INTAKE_FIELDS.has(intakeFieldRaw)
      ? (intakeFieldRaw as ExtractedCriterion["intakeField"])
      : null;

  return {
    label,
    description: str(r.description, label),
    kind,
    intakeField,
    matchAny: nullableStrArray(r.matchAny),
    specialtyKeywords: nullableStrArray(r.specialtyKeywords),
    question: nullableStr(r.question),
    options: nullableStrArray(r.options),
    satisfyingOptions: nullableStrArray(r.satisfyingOptions),
  };
}

function coercePolicy(raw: unknown): ExtractedPolicy {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const criteriaRaw = Array.isArray(r.criteria) ? r.criteria : [];
  const criteria = criteriaRaw
    .map(coerceCriterion)
    .filter((c): c is ExtractedCriterion => c !== null)
    .slice(0, 20);

  return {
    drug: str(r.drug),
    payer: str(r.payer),
    lineOfBusiness: str(r.lineOfBusiness),
    policyType: str(r.policyType, "Prior Authorization"),
    effectiveDate: str(r.effectiveDate),
    reviewDate: str(r.reviewDate),
    sourceNote: str(r.sourceNote),
    approvalInitial: str(r.approvalInitial),
    approvalRenewal: str(r.approvalRenewal),
    notApplicable: strArray(r.notApplicable),
    criteria,
  };
}

/**
 * Extracts a structured policy draft from pasted document text via an
 * OpenAI chat completion. The result only ever prefills the "Add document"
 * form — it still goes through the same manual review and server-side
 * validation as a hand-entered policy, so a malformed or incomplete
 * extraction can't silently produce a bad ingested document.
 */
export async function extractPolicyFromText(rawText: string): Promise<ExtractResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "No OpenAI API key configured. Add OPENAI_API_KEY to .env.local and restart the dev server.",
    };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste the policy document text above first." };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: trimmed.slice(0, MAX_INPUT_CHARS) },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `OpenAI request failed (HTTP ${res.status}). ${detail.slice(0, 300)}` };
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "OpenAI returned an empty response." };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false, error: "OpenAI's response wasn't valid JSON. Try again." };
    }

    const policy = coercePolicy(parsed);
    if (policy.criteria.length === 0) {
      return {
        ok: false,
        error:
          "Couldn't find any extractable criteria in this text. Try pasting more of the policy, or enter criteria manually.",
      };
    }

    return { ok: true, policy };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Extraction failed. Try again." };
  }
}
