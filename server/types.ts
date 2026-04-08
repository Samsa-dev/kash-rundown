// Shared types between server and client

export type RoundPhase = 'WAITING' | 'COUNTDOWN' | 'RUNNING' | 'CRASHED';
export type ChasePhase = 1 | 2 | 3 | 4;

export interface RoundState {
  id: number;
  phase: RoundPhase;
  multiplier: number;
  crashPoint: number;
  hash: string;
  startTime: number | null;
  elapsed: number;
  chasePhase: ChasePhase;
}

export interface PlayerBet {
  playerId: string;
  amount: number;
  cashedOut: boolean;
  cashOutMultiplier: number | null;
}

// Server → Client messages
export type ServerMessage =
  | { type: 'round:waiting'; nextRoundIn: number; previousHash?: string; previousCrashPoint?: number }
  | { type: 'round:countdown'; roundId: number; seconds: number }
  | { type: 'round:tick'; multiplier: number; elapsed: number }
  | { type: 'round:crash'; crashPoint: number; hash: string; roundId: number }
  | { type: 'bet:confirmed'; amount: number; balance: number }
  | { type: 'bet:rejected'; reason: string }
  | { type: 'bet:cancelled'; refund: number; balance: number }
  | { type: 'cashOut:confirmed'; amount: number; multiplier: number; balance: number }
  | { type: 'players'; count: number; totalBet: number }
  | { type: 'obstacle:spawn'; obstacleType: string; lane: number; lanes: number }
  | { type: 'kash:move'; lane: number }
  | { type: 'welcome'; balance: number; playerId: string }
  | { type: 'history'; entries: { roundId: number; crashPoint: number; hash: string }[] };

// Client → Server messages
export type ClientMessage =
  | { type: 'placeBet'; amount: number }
  | { type: 'cashOut' }
  | { type: 'cancelBet' }
  | { type: 'ping' };
