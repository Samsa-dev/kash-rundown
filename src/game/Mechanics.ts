import type { GameState } from './types';

export function checkHelicopterActivation(state: GameState): boolean {
  if (!state.helicopterActive && state.multiplier >= 50) {
    state.helicopterActive = true;
    state.heliStartTime = Date.now();
    return true;
  }
  return false;
}
