import type { ChasePhase, KashMood } from './types';

export function getChasePhase(multiplier: number): ChasePhase {
  if (multiplier < 2) return 1;
  if (multiplier < 5) return 2;
  if (multiplier < 10) return 3;
  if (multiplier < 50) return 4;
  return 5;
}

export function getKashMood(phase: ChasePhase, isIdle: boolean): KashMood {
  if (isIdle) return 'CHILLIN';
  if (phase >= 4) return 'BALLIN';
  if (phase >= 2) return 'LOCKED_IN';
  return 'CHILLIN';
}

export const PHASE_NAMES: Record<ChasePhase, string> = {
  1: 'CLEAN RUN',
  2: 'FIRST SIREN',
  3: 'PURSUIT',
  4: 'FULL PURSUIT',
  5: 'FULL PURSUIT',
};

export const PHASE_BANNERS: Record<number, string> = {
  2: '⚡ 2× — THEY SEE US',
  3: '🔥 5× — PEDAL TO THE METAL',
  4: '🚨 10× — NO TURNING BACK',
  5: '🚁 50× — LEGEND STATUS',
};
