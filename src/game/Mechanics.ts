import type { GameState } from './types';
import { getElapsedForMult } from './RNG';

export function triggerRoadblock(state: GameState): void {
  state.roadblockActive = true;
  state.roadblockAnswer = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
  state.roadblockStart = Date.now();
}

export function handleDodge(
  state: GameState,
  direction: 'LEFT' | 'RIGHT'
): { success: boolean } {
  if (!state.roadblockActive) return { success: false };

  state.roadblockActive = false;

  if (direction === state.roadblockAnswer) {
    state.multiplier += 1.5;
    state.startTime = Date.now() - getElapsedForMult(state.multiplier);
    return { success: true };
  } else {
    state.multiplierPaused = true;
    setTimeout(() => {
      state.multiplierPaused = false;
      state.startTime = Date.now() - getElapsedForMult(state.multiplier);
    }, 1000);
    return { success: false };
  }
}

export function collectNitro(state: GameState, bonus: number): void {
  state.multiplier += bonus;
  state.startTime = Date.now() - getElapsedForMult(state.multiplier);
}

export function checkRoadblockThresholds(state: GameState): boolean {
  if (!state.roadblockFired.r3 && state.multiplier >= 3) {
    state.roadblockFired.r3 = true;
    return true;
  }
  if (!state.roadblockFired.r10 && state.multiplier >= 10) {
    state.roadblockFired.r10 = true;
    return true;
  }
  if (!state.roadblockFired.r50 && state.multiplier >= 50) {
    state.roadblockFired.r50 = true;
    return true;
  }
  return false;
}

export function checkHelicopterActivation(state: GameState): boolean {
  if (!state.heliActivated && state.multiplier >= 10) {
    state.heliActivated = true;
    state.helicopterActive = true;
    state.heliStartTime = Date.now();
    return true;
  }
  return false;
}
