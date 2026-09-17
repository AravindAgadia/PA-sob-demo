import type { CriterionDefinition, CriterionResult, EvalContext } from "./types";

function evaluateCriterion(
  def: CriterionDefinition,
  ctx: EvalContext
): CriterionResult {
  const base = {
    id: def.id,
    number: def.number,
    label: def.label,
    systemVerifiable: def.systemVerifiable,
  };
  const spec = def.evaluator;

  switch (spec.kind) {
    case "intake-text-match": {
      const raw = ctx.intake[spec.field];
      const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
      if (!value) {
        return { ...base, status: "needs-info", detail: "Not provided at intake." };
      }
      const matched = spec.matchAny.some((candidate) =>
        value.includes(candidate.toLowerCase())
      );
      return matched
        ? {
            ...base,
            status: "confirmed",
            detail: `Matched intake field "${spec.field}": "${raw}".`,
          }
        : {
            ...base,
            status: "not-met",
            detail: `Intake value "${raw}" did not match this policy's requirement.`,
          };
    }

    case "npi-specialty-match": {
      const lookup = ctx.npiLookup;
      if (!lookup || !lookup.found) {
        return {
          ...base,
          status: "needs-info",
          detail: "NPI lookup has not resolved a provider yet.",
        };
      }
      return lookup.matchesRequiredSpecialty
        ? {
            ...base,
            status: "confirmed",
            detail: `NPPES returned "${lookup.taxonomyDescription}" for NPI ${lookup.npi} — matches ophthalmology, endocrinology, or a recognized TED specialist.`,
          }
        : {
            ...base,
            status: "not-met",
            detail: `NPPES returned "${lookup.taxonomyDescription}" for NPI ${lookup.npi} — does not match the required specialties.`,
          };
    }

    case "follow-up-single": {
      const value = ctx.answers[spec.answerKey];
      if (value === undefined) {
        return {
          ...base,
          status: "needs-info",
          detail: "Awaiting a response from the requesting provider.",
        };
      }
      const satisfied = spec.satisfyingValues.includes(value);
      return satisfied
        ? { ...base, status: "confirmed", detail: "Confirmed by provider response." }
        : {
            ...base,
            status: "not-met",
            detail: "Provider response does not satisfy this criterion.",
          };
    }

    case "follow-up-multi-any": {
      const value = ctx.answers[spec.answerKey];
      if (value === undefined) {
        return {
          ...base,
          status: "needs-info",
          detail: "Awaiting a response from the requesting provider.",
        };
      }
      return value.length > 0
        ? {
            ...base,
            status: "confirmed",
            detail: `Provider confirmed: ${value.join(", ")}.`,
          }
        : {
            ...base,
            status: "not-met",
            detail: "Provider indicated none of the listed findings apply.",
          };
    }
  }
}

export function evaluatePolicy(
  criteria: CriterionDefinition[],
  ctx: EvalContext
): CriterionResult[] {
  return criteria.map((def) => evaluateCriterion(def, ctx));
}
