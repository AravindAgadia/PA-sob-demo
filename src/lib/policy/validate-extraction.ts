import type {
  CriterionNode,
  ExtractDocumentKind,
  ExtractedPolicy,
  ValidationResult,
} from "./extracted-schema";

export interface ValidationSourceDoc {
  kind: ExtractDocumentKind;
  filename: string;
  text: string;
}

/** Collapses whitespace runs and applies NFKC so smart quotes, en-dashes,
 *  and ligatures (common PDF-extraction/transcription artifacts) don't
 *  produce a false "not found" — the check is meant to catch invented
 *  quotes, not cosmetic re-encoding of the same words. */
function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Resolves a leaf's `page` citation (e.g. "p.5", "PAF-Botox p.2") to the
 *  specific source document it refers to, so a quote is checked against the
 *  right text instead of just "somewhere in everything." Falls back to
 *  searching every document when the citation doesn't name one, rather than
 *  reporting a spurious miss for an ambiguous-but-real citation. */
function resolveDoc(page: string, docs: ValidationSourceDoc[]): ValidationSourceDoc[] {
  const prefix = page.replace(/p\.?\s*\d+.*$/i, "").trim();
  if (!prefix) return docs;
  const lowerPrefix = prefix.toLowerCase();
  const matches = docs.filter((d) => d.filename.toLowerCase().includes(lowerPrefix));
  return matches.length > 0 ? matches : docs;
}

function quoteFound(quote: string, page: string, docs: ValidationSourceDoc[]): boolean {
  const target = normalize(quote);
  if (!target) return true; // nothing to check — not a fabrication risk
  const candidates = resolveDoc(page, docs);
  return candidates.some((d) => normalize(d.text).includes(target));
}

function walkCriterionNode(
  node: CriterionNode,
  path: string,
  docs: ValidationSourceDoc[],
  out: ValidationResult[]
): void {
  if (node.type === "group") {
    node.items.forEach((item, i) => walkCriterionNode(item, `${path}.items[${i}]`, docs, out));
    return;
  }
  out.push({
    path: `${path}.quote`,
    quote: node.quote,
    page: node.page,
    found: quoteFound(node.quote, node.page, docs),
  });
}

/**
 * Walks every cited quote in an extracted draft — criteria-tree leaves and
 * general rules — and checks it's an actual substring of the source
 * document it cites. This is the single highest-value trust signal in the
 * whole pipeline: an invented quote is exactly the failure mode citation
 * exists to catch, per the extraction guide's own emphasis.
 */
export function validateExtraction(
  policy: ExtractedPolicy,
  docs: ValidationSourceDoc[]
): ValidationResult[] {
  const results: ValidationResult[] = [];

  policy.rules.forEach((rule, i) => {
    if (!rule.quote) return; // Inferred/Unverified rules may have nothing to quote
    results.push({
      path: `rules[${i}].quote`,
      quote: rule.quote,
      page: rule.page,
      found: quoteFound(rule.quote, rule.page, docs),
    });
  });

  policy.conditions.forEach((condition, ci) => {
    condition.branches.forEach((branch, bi) => {
      walkCriterionNode(
        branch.criteria,
        `conditions[${ci}].branches[${bi}].criteria`,
        docs,
        results
      );
    });
  });

  return results;
}
