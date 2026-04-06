import type { ChasePhase, KashMood } from './types';

export function getChasePhase(multiplier: number): ChasePhase {
  if (multiplier < 3) return 1;
  if (multiplier < 10) return 2;
  if (multiplier < 50) return 3;
  if (multiplier < 500) return 4;
  return 5;
}

export function getKashMood(phase: ChasePhase, isIdle: boolean): KashMood {
  if (isIdle) return 'CHILLIN';
  if (phase === 5) return 'BALLIN';
  if (phase >= 2) return 'LOCKED_IN';
  return 'CHILLIN';
}

export const PHASE_NAMES: Record<ChasePhase, string> = {
  1: 'CLEAN RUN',
  2: 'FIRST SIREN',
  3: 'CHOPPER UP',
  4: 'FULL PURSUIT',
  5: 'GHOST MODE',
};

export const PHASE_BANNERS: Record<number, string> = {
  2: '🚨 SIREN — THEY\'RE ON YOUR TAIL',
  3: '🚁 CHOPPER UP — SPOTLIGHT ACTIVE',
  4: '⚡ FULL PURSUIT — MAXIMUM DANGER',
  5: '👻 GHOST MODE ACTIVATED',
};
