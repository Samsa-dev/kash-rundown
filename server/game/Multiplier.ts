/** Same exponential growth curve as the client */
const GROWTH_RATE = 0.000055;

export function calcMultiplier(elapsedMs: number): number {
  return Math.max(1.00, Math.exp(GROWTH_RATE * elapsedMs));
}

export function getChasePhase(multiplier: number): 1 | 2 | 3 | 4 | 5 {
  if (multiplier < 2) return 1;
  if (multiplier < 5) return 2;
  if (multiplier < 10) return 3;
  if (multiplier < 50) return 4;
  return 5;
}
