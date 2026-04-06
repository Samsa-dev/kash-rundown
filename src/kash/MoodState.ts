import type { ChasePhase, KashMood } from '../game/types';

export function getMoodFromPhase(phase: ChasePhase, isIdle: boolean): KashMood {
  if (isIdle) return 'CHILLIN';
  if (phase === 5) return 'BALLIN';
  if (phase >= 2) return 'LOCKED_IN';
  return 'CHILLIN';
}

export function getMoodColor(mood: KashMood): string {
  switch (mood) {
    case 'BALLIN': return '#7B2FBE';
    case 'LOCKED_IN': return '#EA580C';
    case 'CHILLIN': return '#505064';
  }
}
