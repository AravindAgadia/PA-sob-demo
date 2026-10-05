import type { CriterionNode } from "@/lib/policy/extracted-schema";
import type { SobViewModel } from "@/lib/policy/sob-view-model";

function LabelChip({ children }: { children: string }) {
  return <span className="sob-chip">{children}</span>;
}

function CriterionTree({ node }: { node: CriterionNode }) {
  if (node.type === "group") {
    return (
      <ul className="sob-group">
        <li className="sob-group-logic">{node.logic === "ONE" ? "ONE OF:" : `${node.logic}:`}</li>
        {node.items.map((item, i) => (
          <li key={i}>
            <CriterionTree node={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="sob-leaf">
      <span>{node.text}</span>
      {node.documentationRequired && <LabelChip>doc</LabelChip>}
      <span className="sob-cite">
        <LabelChip>{node.provenance}</LabelChip> {node.page}
      </span>
    </div>
  );
}

export function SobDocument({ model }: { model: SobViewModel }) {
  return (
    <div className="sob-doc">
      <style>{`
        .sob-doc { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 52rem; margin: 0 auto; padding: 2rem; font-size: 14px; line-height: 1.5; }
        .sob-doc h1 { font-size: 1.4rem; margin: 0 0 0.25rem; }
        .sob-doc h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #1a1a1a; margin: 2rem 0 0.75rem; padding-bottom: 0.25rem; }
        .sob-doc h3 { font-size: 0.95rem; margin: 1rem 0 0.4rem; }
        .sob-header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem 1.5rem; margin-bottom: 0.5rem; }
        .sob-header-grid div span:first-child { color: #555; margin-right: 0.4rem; }
        .sob-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.5rem 0; border-top: 1px solid #ddd; }
        .sob-row:first-child { border-top: none; }
        .sob-row-label { font-weight: 600; min-width: 11rem; flex-shrink: 0; }
        .sob-row-value { flex: 1; }
        .sob-chip { display: inline-block; font-size: 0.7rem; border: 1px solid #999; border-radius: 3px; padding: 0 0.3rem; margin-right: 0.25rem; white-space: nowrap; }
        .sob-cite { float: right; font-size: 0.75rem; color: #555; white-space: nowrap; }
        .sob-condition { margin-bottom: 1.25rem; page-break-inside: avoid; }
        .sob-condition-head { font-weight: 700; }
        .sob-branch { margin: 0.4rem 0 0.75rem 0.5rem; }
        .sob-branch-head { font-style: italic; margin-bottom: 0.25rem; }
        .sob-group { list-style: none; margin: 0 0 0 0.75rem; padding: 0; border-left: 2px solid #ccc; padding-left: 0.6rem; }
        .sob-group-logic { font-size: 0.75rem; font-weight: 700; color: #555; }
        .sob-leaf { padding: 0.15rem 0; }
        .sob-dose-row { display: flex; gap: 1rem; padding: 0.3rem 0; border-top: 1px solid #eee; }
        .sob-doc-list { list-style: disc; margin: 0.25rem 0 0.25rem 1.25rem; padding: 0; }
        .sob-footer-note { margin-top: 2rem; padding-top: 1rem; border-top: 2px solid #1a1a1a; font-size: 0.8rem; color: #444; }
        @media print {
          .sob-doc { padding: 0; }
          .sob-no-print { display: none !important; }
        }
      `}</style>

      <h1>Summary of Benefits</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Generated draft — review before relying on it</p>
      <div className="sob-header-grid">
        <div>
          <span>Payer</span>
          {model.payer}
        </div>
        <div>
          <span>Drug</span>
          {model.drugSummary}
        </div>
        <div>
          <span>Benefit · HCPCS</span>
          {model.benefitSummary}
        </div>
        <div>
          <span>Governing policy</span>
          {model.governingPolicySummary}
        </div>
      </div>

      <h2>1 · Patient eligibility &amp; cost share</h2>
      <p style={{ fontSize: "0.8rem", color: "#555" }}>
        Filled per patient from the 271 eligibility check — not part of the policy itself.
      </p>
      <div className="sob-row">
        <span className="sob-row-label">Eligibility · Plan / LOB</span>
        <span className="sob-row-value">
          Active / inactive · plan, line of business, coverage dates <LabelChip>Patient · 271</LabelChip>
        </span>
      </div>
      <div className="sob-row">
        <span className="sob-row-label">Cost share · Network</span>
        <span className="sob-row-value">
          Deductible, copay, coinsurance, out-of-pocket max · in / out of network{" "}
          <LabelChip>Patient · 271</LabelChip>
        </span>
      </div>

      <h2>2 · Coverage at a glance</h2>
      <div className="sob-row">
        <span className="sob-row-label">Prior authorization</span>
        <span className="sob-row-value">{model.coverageAtAGlance.paRequired}</span>
      </div>
      <div className="sob-row">
        <span className="sob-row-label">Covered diagnoses</span>
        <span className="sob-row-value">{model.coverageAtAGlance.coveredDiagnoses}</span>
      </div>
      <div className="sob-row">
        <span className="sob-row-label">Prescriber</span>
        <span className="sob-row-value">{model.coverageAtAGlance.prescriber}</span>
      </div>
      <div className="sob-row">
        <span className="sob-row-label">Step therapy</span>
        <span className="sob-row-value">{model.coverageAtAGlance.stepTherapy}</span>
      </div>
      <div className="sob-row">
        <span className="sob-row-label">Approval duration</span>
        <span className="sob-row-value">
          {model.coverageAtAGlance.approvalDuration}
          {model.unitConversionNote && (
            <>
              {" "}
              <span style={{ fontSize: "0.8rem", color: "#555" }}>({model.unitConversionNote})</span>
            </>
          )}
        </span>
      </div>
      {model.coverageAtAGlance.notCovered && (
        <div className="sob-row">
          <span className="sob-row-label">Not covered</span>
          <span className="sob-row-value">
            {model.coverageAtAGlance.notCovered.text} <LabelChip>{model.coverageAtAGlance.notCovered.label}</LabelChip>{" "}
            {model.coverageAtAGlance.notCovered.page}
          </span>
        </div>
      )}

      <h2>3 · Coverage criteria by condition</h2>
      {model.conditions.map((condition) => (
        <div key={condition.number} className="sob-condition">
          <p className="sob-condition-head">
            #{condition.number} · {condition.name}{" "}
            <LabelChip>{condition.category}</LabelChip>
            {condition.icd10.length > 0 && <span style={{ fontSize: "0.8rem", color: "#555" }}> · {condition.icd10.join(", ")}</span>}
            {condition.cptCode && <span style={{ fontSize: "0.8rem", color: "#555" }}> · CPT {condition.cptCode}</span>}
            <span className="sob-cite">{condition.page}</span>
          </p>
          {condition.prescriber && condition.prescriber.specialties.length > 0 && (
            <p style={{ fontSize: "0.85rem", margin: "0.15rem 0" }}>
              Prescriber ({condition.prescriber.appliesTo}): {condition.prescriber.specialties.join(", ")}
            </p>
          )}
          {condition.branches.map((branch, bi) => (
            <div key={bi} className="sob-branch">
              <p className="sob-branch-head">
                {branch.branch === "single"
                  ? `Approve ${branch.duration}`
                  : `${branch.branch === "initial" ? "Initial therapy" : "Continuing therapy"} → approve ${branch.duration}`}
                {branch.minTimeOnDrug && ` (min. time on drug: ${branch.minTimeOnDrug})`}
              </p>
              <CriterionTree node={branch.criteria} />
            </div>
          ))}
        </div>
      ))}

      <h2>4 · Dose and quantity rules</h2>
      {model.doseRows.map((row, i) => (
        <div key={i} className="sob-dose-row">
          <span style={{ fontWeight: 600, minWidth: "14rem" }}>
            {row.conditionName}
            {row.branch !== "single" && row.branch !== "both" && ` (${row.branch})`}
          </span>
          <span>{row.text}</span>
          <span className="sob-cite" style={{ marginLeft: "auto" }}>
            {row.page}
          </span>
        </div>
      ))}
      {model.doseRows.length === 0 && <p>Not stated in policy.</p>}

      <h2>5 · Site of care</h2>
      {model.siteOfCare ? (
        <p>
          {model.siteOfCare.text} <LabelChip>{model.siteOfCare.label}</LabelChip> {model.siteOfCare.page}
        </p>
      ) : (
        <p>Not stated in policy.</p>
      )}

      <h2>6 · Documentation to have ready</h2>
      <ul className="sob-doc-list">
        {model.documentation.intakeItems.map((item) => (
          <li key={item}>
            {item} <LabelChip>✓ From intake</LabelChip>
          </li>
        ))}
        {model.documentation.providerItems.map((item, i) => (
          <li key={i}>
            {item.text} <span className="sob-cite">{item.page}</span>
          </li>
        ))}
        {model.documentation.rule && (
          <li>
            {model.documentation.rule.text} <LabelChip>{model.documentation.rule.label}</LabelChip>
          </li>
        )}
      </ul>

      {model.relatedDocumentsNotUsed.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "#555" }}>
          Also on file for this drug, not used for this policy: {model.relatedDocumentsNotUsed.join(", ")}.
        </p>
      )}

      <div className="sob-footer-note">
        <p>
          If this request proceeds, PA questions come next — generated from the open criteria above. Questions
          already answered by intake, eligibility, or prescriber data are pre-filled.
        </p>
        <p>
          Labels: <LabelChip>Patient · 271</LabelChip> patient-specific eligibility data ·{" "}
          <LabelChip>Policy</LabelChip> stated in the payer&apos;s policy · <LabelChip>Inferred</LabelChip> concluded,
          not stated · <LabelChip>Unverified</LabelChip> needs confirmation from a source that can&apos;t be read
          automatically · <LabelChip>✓ From intake</LabelChip> already captured on the PA request form.
        </p>
        <p>
          This is a machine-extracted draft, not a final determination. The member&apos;s own plan document may
          differ and takes precedence.
        </p>
      </div>
    </div>
  );
}
