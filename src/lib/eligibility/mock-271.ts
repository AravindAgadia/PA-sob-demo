import type { EligibilityResult } from "../policy/types";

export interface EligibilityProvider {
  check(insuranceId: string, payer: string): Promise<EligibilityResult>;
}

/**
 * Keyed by payer so the mock line of business actually varies with the
 * request — otherwise every ingested policy except the Medicaid-Indiana
 * seed would fail an exact match regardless of the drug/payer entered.
 */
const LINE_OF_BUSINESS_BY_PAYER: Record<string, { lineOfBusiness: string; planType: string }> = {
  humana: { lineOfBusiness: "Medicaid - Indiana", planType: "Medicaid Managed Care" },
  anthem: { lineOfBusiness: "Commercial", planType: "Commercial PPO" },
};

/**
 * Stand-in for a real X12 270/271 eligibility check (e.g., via a
 * clearinghouse like Availity or Optum). Every caller depends only on this
 * interface, so swapping in a real integration later doesn't touch the
 * policy-matching or evaluation code.
 */
export const mock271Provider: EligibilityProvider = {
  async check(_insuranceId, payer) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const known = LINE_OF_BUSINESS_BY_PAYER[payer.trim().toLowerCase()];
    return {
      active: true,
      payer,
      lineOfBusiness: known?.lineOfBusiness ?? "Commercial",
      planType: known?.planType ?? "Commercial PPO",
      deductibleRemaining: 0,
      coinsurancePercent: 0,
      oopRemaining: 0,
      source: "271-mock",
    };
  },
};
