/**
 * Crash point generation with house edge.
 * Currently uses Math.random() — will be replaced with
 * SHA-256 provably fair hash chain for production.
 */

const HOUSE_EDGE = 0.04;
const INSTANT_CRASH_RATE = 0.012;

export function generateCrashPoint(): number {
  const r = Math.random();
  if (r < INSTANT_CRASH_RATE) return 1.00;
  const raw = Math.max(1.00, 1 / (r * (1 - HOUSE_EDGE)));
  return Math.round(raw * 100) / 100;
}

/**
 * Calculate multiplier from elapsed time.
 * Exponential growth curve — K controls speed.
 */
const GROWTH_RATE = 0.000055;

export function calcMultiplier(elapsedMs: number): number {
  return Math.max(1.00, Math.exp(GROWTH_RATE * elapsedMs));
}

/**
 * Inverse: get elapsed time for a given multiplier.
 * Used to recalibrate startTime after bonuses.
 */
export function getElapsedForMult(m: number): number {
  return Math.log(Math.max(1, m)) / GROWTH_RATE;
}
