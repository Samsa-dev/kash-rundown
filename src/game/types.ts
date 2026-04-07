export type GamePhase = 'IDLE' | 'COUNTDOWN' | 'RUNNING' | 'CRASHED' | 'CASHED_OUT';
export type ChasePhase = 1 | 2 | 3 | 4 | 5;
export type KashMood = 'CHILLIN' | 'LOCKED_IN' | 'BALLIN';

export interface HistoryEntry {
  mult: number;
  result: 'WON' | 'LOST';
  bet: number;
}

export interface Obstacle {
  type: 'car' | 'police' | 'civilian' | 'cyclist' | 'barricade' | 'spikes' | 'dumpster' | 'cones' | 'flipped_car' | 'electric_puddle';
  rx: number;
  rz: number;
  speed: number;
  color: string;
  dodged: boolean;
}

export interface NitroItem {
  rx: number;
  rz: number;
  collected: boolean;
  glow: number;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
}

export interface GameState {
  phase: GamePhase;
  multiplier: number;
  crashPoint: number | null;
  bet: number;
  balance: number;
  startTime: number | null;
  autoCashOut: boolean;
  autoCashOutTarget: number;
  countdownSec: number;
  chasePhase: ChasePhase;
  roadblockActive: boolean;
  roadblockAnswer: 'LEFT' | 'RIGHT';
  roadblockTimer: ReturnType<typeof setInterval> | null;
  roadblockStart: number | null;
  multiplierPaused: boolean;
  helicopterActive: boolean;
  heliStartTime: number | null;
  ghostMode: boolean;
  history: HistoryEntry[];
  sessionProfit: number;
  sessionRounds: number;
  bestRun: number | null;
  roadblockFired: { r3: boolean; r10: boolean; r50: boolean };
  heliActivated: boolean;
  quoteTimer: ReturnType<typeof setTimeout> | null;
}

export function createInitialState(): GameState {
  return {
    phase: 'IDLE',
    multiplier: 1.00,
    crashPoint: null,
    bet: 10,
    balance: 1000,
    startTime: null,
    autoCashOut: false,
    autoCashOutTarget: 2,
    countdownSec: 5,
    chasePhase: 1,
    roadblockActive: false,
    roadblockAnswer: 'LEFT',
    roadblockTimer: null,
    roadblockStart: null,
    multiplierPaused: false,
    helicopterActive: false,
    heliStartTime: null,
    ghostMode: false,
    history: [],
    sessionProfit: 0,
    sessionRounds: 0,
    bestRun: null,
    roadblockFired: { r3: false, r10: false, r50: false },
    heliActivated: false,
    quoteTimer: null,
  };
}
