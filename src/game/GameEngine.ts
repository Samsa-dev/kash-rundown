import { GameState, createInitialState } from './types';
import { generateCrashPoint, calcMultiplier } from './RNG';
import { getChasePhase, PHASE_BANNERS } from './Phases';
import { checkHelicopterActivation } from './Mechanics';

type GameEvent =
  | { type: 'PHASE_CHANGE'; phase: number }
  | { type: 'HELICOPTER_ACTIVATED' }
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
    if (amount < 1) return false;

    this.state.bet = amount;
    this.state.phase = 'COUNTDOWN';
    this.state.crashPoint = generateCrashPoint();
    this.state.multiplier = 1.00;
    this.state.chasePhase = 1;
    this.state.helicopterActive = false;

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
    if (s.phase !== 'RUNNING') return;

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

  resetToIdle(): void {
    this.state.phase = 'IDLE';
    this.state.multiplier = 1.00;
    this.state.chasePhase = 1;
    this.state.helicopterActive = false;
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
