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
    evaluator: def.evaluator,
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
      if (!lookup) {
        return {
          ...base,
          status: "needs-info",
          detail: "NPI lookup has not resolved a provider yet.",
        };
      }
      switch (lookup.status) {
        case "invalid-format":
          return {
            ...base,
            status: "needs-info",
            detail: "Ordering provider NPI must be 10 digits.",
          };
        case "lookup-failed":
          return {
            ...base,
            status: "needs-info",
            detail: "Couldn't reach the NPPES NPI Registry to verify this prescriber. Try submitting again.",
          };
        case "not-found":
          return {
            ...base,
            status: "needs-info",
            detail: `No NPPES record found for NPI ${lookup.npi}. Double-check the number.`,
          };
        case "resolved": {
          const description = (lookup.taxonomyDescription ?? "").toLowerCase();
          const matched = spec.specialtyKeywords.some((kw) =>
            description.includes(kw.toLowerCase())
          );
          return matched
            ? {
                ...base,
                status: "confirmed",
                detail: `NPPES returned "${lookup.taxonomyDescription}" for NPI ${lookup.npi} — matches a required specialty.`,
              }
            : {
                ...base,
                status: "not-met",
                detail: `NPPES returned "${lookup.taxonomyDescription}" for NPI ${lookup.npi} — does not match the required specialties (${spec.specialtyKeywords.join(", ")}).`,
              };
        }
      }
    }

    case "attestation-single": {
      const value = ctx.answers[def.id];
      if (value === undefined) {
        return {
          ...base,
          status: "needs-info",
          detail: "Awaiting a response from the requesting provider.",
        };
      }
      const satisfied = spec.satisfyingValues.includes(value as string);
      return satisfied
        ? { ...base, status: "confirmed", detail: "Confirmed by provider response." }
        : {
            ...base,
            status: "not-met",
            detail: "Provider response does not satisfy this criterion.",
          };
    }

    case "attestation-multi": {
      const value = ctx.answers[def.id] as string[] | undefined;
      if (value === undefined) {
        return {
          ...base,
          status: "needs-info",
          detail: "Awaiting a response from the requesting provider.",
        };
      }
      const labels = spec.options
        .filter((opt) => value.includes(opt.value))
        .map((opt) => opt.label);
      return value.length > 0
        ? {
            ...base,
            status: "confirmed",
            detail: `Provider confirmed: ${labels.join(", ")}.`,
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
