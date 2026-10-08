/**
 * Deterministic "sample 271 response" cost-share figures for the Patient
 * Eligibility & Cost Share section — not derived from any real eligibility
 * computation (the mock 271 check always returns zeros). Seeded from the
 * member/patient identity so the same case always shows the same numbers
 * instead of values that shift on every reload, while different patients
 * show different ones.
 */
export interface SampleCostShare {
  deductibleLimit: number;
  deductibleMet: number;
  deductibleRemaining: number;
  oonDeductibleLimit: number;
  coinsurancePercent: number;
  oonCoinsurancePercent: number;
  copay: number;
  oopMaxLimit: number;
  oopMaxMet: number;
  oopMaxRemaining: number;
  oonOopMaxLimit: number;
  groupNumber: string;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, options: readonly T[]): T {
  return options[Math.floor(random() * options.length)];
}

export function buildSampleCostShare(seed: string): SampleCostShare {
  const random = mulberry32(hashSeed(seed || "sample"));

  const deductibleLimit = pick(random, [500, 1000, 1500, 2000, 2500, 3000]);
  const deductibleMet = Math.round(deductibleLimit * (0.2 + random() * 0.6));
  const coinsurancePercent = pick(random, [10, 20, 30, 40]);
  const copay = pick(random, [25, 30, 40, 50, 60]);
  const oopMaxLimit = pick(random, [3000, 5000, 7500, 10000]);
  const oopMaxMet = Math.round(oopMaxLimit * (0.1 + random() * 0.5));
  const groupNumber = String(1000000 + Math.floor(random() * 9000000));

  return {
    deductibleLimit,
    deductibleMet,
    deductibleRemaining: deductibleLimit - deductibleMet,
    oonDeductibleLimit: deductibleLimit * 2,
    coinsurancePercent,
    oonCoinsurancePercent: Math.min(60, coinsurancePercent * 2),
    copay,
    oopMaxLimit,
    oopMaxMet,
    oopMaxRemaining: oopMaxLimit - oopMaxMet,
    oonOopMaxLimit: oopMaxLimit * 2,
    groupNumber,
  };
}
