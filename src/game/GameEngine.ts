import { GameState, createInitialState } from './types';
import { generateCrashPoint, calcMultiplier } from './RNG';
import { getChasePhase, PHASE_BANNERS } from './Phases';
import {
  checkRoadblockThresholds,
  checkHelicopterActivation,
  triggerRoadblock,
  handleDodge,
  collectNitro,
} from './Mechanics';

type GameEvent =
  | { type: 'PHASE_CHANGE'; phase: number }
  | { type: 'ROADBLOCK' }
  | { type: 'HELICOPTER_ACTIVATED' }
  | { type: 'GHOST_MODE' }
  | { type: 'CRASH' }
  | { type: 'CASH_OUT'; amount: number }
  | { type: 'MULTIPLIER_UPDATE'; multiplier: number; profit: number }
  | { type: 'BANNER'; text: string };

export type EventHandler = (event: GameEvent) => void;

export class GameEngine {
  public state: GameState;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: EventHandler[] = [];

  constructor() {
    this.state = createInitialState();
  }

  on(handler: EventHandler): void {
    this.listeners.push(handler);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  placeBet(amount: number): boolean {
    if (this.state.phase !== 'IDLE') return false;
    if (amount > this.state.balance) return false;
    if (amount < 0.10) return false;

    this.state.bet = amount;
    this.state.phase = 'COUNTDOWN';
    this.state.crashPoint = generateCrashPoint();
    this.state.multiplier = 1.00;
    this.state.chasePhase = 1;
    this.state.roadblockFired = { r3: false, r10: false, r50: false };
    this.state.helicopterActive = false;
    this.state.heliActivated = false;
    this.state.ghostMode = false;

    return true;
  }

  startRound(): void {
    this.state.phase = 'RUNNING';
    this.state.startTime = Date.now();
    this.state.multiplier = 1.00;

    this.tickInterval = setInterval(() => this.tick(), 80);
  }

  private tick(): void {
    const s = this.state;
    if (s.phase !== 'RUNNING' || s.multiplierPaused || s.roadblockActive) return;

    const elapsed = Date.now() - s.startTime!;
    s.multiplier = calcMultiplier(elapsed);

    // Auto cash-out
    if (s.autoCashOut && s.multiplier >= s.autoCashOutTarget) {
      this.doCashOut();
      return;
    }

    // Crash check
    if (s.multiplier >= s.crashPoint!) {
      this.triggerCrash();
      return;
    }

    // Phase transition
    const newPhase = getChasePhase(s.multiplier);
    if (newPhase !== s.chasePhase) {
      s.chasePhase = newPhase;
      this.emit({ type: 'PHASE_CHANGE', phase: newPhase });
      const banner = PHASE_BANNERS[newPhase];
      if (banner) this.emit({ type: 'BANNER', text: banner });
      if (newPhase === 5) {
        s.ghostMode = true;
        this.emit({ type: 'GHOST_MODE' });
      }
    }

    // Roadblocks
    if (checkRoadblockThresholds(s)) {
      triggerRoadblock(s);
      this.emit({ type: 'ROADBLOCK' });
    }

    // Helicopter
    if (checkHelicopterActivation(s)) {
      this.emit({ type: 'HELICOPTER_ACTIVATED' });
    }

    // UI update
    this.emit({
      type: 'MULTIPLIER_UPDATE',
      multiplier: s.multiplier,
      profit: s.bet * s.multiplier - s.bet,
    });
  }

  doCashOut(): void {
    if (this.state.phase !== 'RUNNING') return;
    const winAmt = this.state.bet * this.state.multiplier;
    this.state.phase = 'CASHED_OUT';
    this.stopTick();

    this.state.balance += winAmt;
    this.state.sessionProfit += winAmt - this.state.bet;
    this.state.sessionRounds++;
    if (!this.state.bestRun || this.state.multiplier > this.state.bestRun) {
      this.state.bestRun = this.state.multiplier;
    }

    this.state.history.unshift({
      mult: this.state.multiplier,
      result: 'WON',
      bet: this.state.bet,
    });
    if (this.state.history.length > 20) this.state.history.pop();

    this.emit({ type: 'CASH_OUT', amount: winAmt });
  }

  private triggerCrash(): void {
    this.state.phase = 'CRASHED';
    this.stopTick();

    const lostAmt = this.state.bet;
    this.state.balance -= lostAmt;
    this.state.sessionProfit -= lostAmt;
    this.state.sessionRounds++;

    this.state.history.unshift({
      mult: this.state.crashPoint!,
      result: 'LOST',
      bet: this.state.bet,
    });
    if (this.state.history.length > 20) this.state.history.pop();

    this.emit({ type: 'CRASH' });
  }

  dodge(direction: 'LEFT' | 'RIGHT'): boolean {
    const result = handleDodge(this.state, direction);
    return result.success;
  }

  collectNitroBonus(): number {
    const bonus = 0.5 + Math.random() * 1.5;
    collectNitro(this.state, bonus);
    return bonus;
  }

  resetToIdle(): void {
    this.state.phase = 'IDLE';
    this.state.multiplier = 1.00;
    this.state.chasePhase = 1;
    this.state.ghostMode = false;
    this.state.roadblockActive = false;
    this.state.helicopterActive = false;
    if (this.state.roadblockTimer) clearInterval(this.state.roadblockTimer);
    if (this.state.quoteTimer) clearTimeout(this.state.quoteTimer);
  }

  private stopTick(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  destroy(): void {
    this.stopTick();
    this.listeners = [];
  }
}
