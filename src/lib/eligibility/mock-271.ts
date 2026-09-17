import type { EligibilityResult } from "../policy/types";

export interface EligibilityProvider {
  check(insuranceId: string, payer: string): Promise<EligibilityResult>;
}

/**
 * Stand-in for a real X12 270/271 eligibility check (e.g., via a
 * clearinghouse like Availity or Optum). Every caller depends only on this
 * interface, so swapping in a real integration later doesn't touch the
 * policy-matching or evaluation code.
 */
export const mock271Provider: EligibilityProvider = {
  async check(_insuranceId, payer) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return {
      active: true,
      payer,
      lineOfBusiness: "Medicaid - Indiana",
      planType: "Medicaid Managed Care",
      deductibleRemaining: 0,
      coinsurancePercent: 0,
      oopRemaining: 0,
      source: "271-mock",
    };
  },
};
