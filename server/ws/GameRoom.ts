import type WebSocket from 'ws';
import { Round } from '../game/Round';
import { ProvablyFairRNG } from '../game/RNG';
import { PlayerSession } from './PlayerSession';
import type { ServerMessage, ClientMessage, ChasePhase } from '../types';

const COUNTDOWN_SECONDS = 5;
const WAIT_AFTER_CRASH = 3000; // ms between rounds

export class GameRoom {
  private rng = new ProvablyFairRNG();
  private players = new Map<string, PlayerSession>();
  private round: Round | null = null;
  private roundId = 0;
  private history: { roundId: number; crashPoint: number; hash: string }[] = [];
  private previousHash: string | undefined;
  private previousCrashPoint: number | undefined;
  private countdownStartedAt: number | null = null;

  constructor() {
    this.startNextRound();
  }

  addPlayer(ws: WebSocket): PlayerSession {
    const id = 'p_' + Math.random().toString(36).slice(2, 8);
    const session = new PlayerSession(id, ws);
    this.players.set(id, session);

    // Send welcome + history
    session.send({ type: 'welcome', balance: session.balance, playerId: id });
    session.send({ type: 'history', entries: this.history.slice(0, 20) });

    // Send current round state
    if (this.countdownStartedAt && this.round) {
      const elapsed = (Date.now() - this.countdownStartedAt) / 1000;
      const remaining = Math.max(1, Math.ceil(COUNTDOWN_SECONDS - elapsed));
      session.send({ type: 'round:countdown', roundId: this.roundId, seconds: remaining });
    } else if (this.round?.phase === 'RUNNING') {
      session.send({
        type: 'round:tick',
        multiplier: this.round.multiplier,
        elapsed: this.round.startTime ? Date.now() - this.round.startTime : 0,
      });
    }

    this.broadcastPlayerCount();
    return session;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.broadcastPlayerCount();
  }

  handleMessage(playerId: string, raw: string): void {
    const session = this.players.get(playerId);
    if (!session) return;

    let msg: ClientMessage;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'placeBet':
        this.handlePlaceBet(session, msg.amount);
        break;
      case 'cashOut':
        this.handleCashOut(session);
        break;
      case 'cancelBet':
        this.handleCancelBet(session);
        break;
      case 'ping':
        break;
    }
  }

  private handlePlaceBet(session: PlayerSession, amount: number): void {
    // Can only bet before round starts running
    if (!this.round || this.round.phase === 'RUNNING' || this.round.phase === 'CRASHED') {
      session.send({ type: 'bet:rejected', reason: 'Round not accepting bets' });
      return;
    }

    if (session.placeBet(amount)) {
      session.send({ type: 'bet:confirmed', amount, balance: session.balance });
      this.broadcastPlayerCount();
    } else {
      session.send({ type: 'bet:rejected', reason: amount > session.balance ? 'Insufficient balance' : 'Invalid bet' });
    }
  }

  private handleCancelBet(session: PlayerSession): void {
    // Can only cancel before round starts running
    if (!this.round || this.round.phase === 'RUNNING' || this.round.phase === 'CRASHED') return;
    const refund = session.cancelBet();
    if (refund !== null) {
      session.send({ type: 'bet:cancelled', refund, balance: session.balance });
    }
  }

  private handleCashOut(session: PlayerSession): void {
    if (!this.round || this.round.phase !== 'RUNNING') return;

    const winAmount = session.cashOut(this.round.multiplier);
    if (winAmount !== null) {
      session.send({
        type: 'cashOut:confirmed',
        amount: winAmount,
        multiplier: this.round.multiplier,
        balance: session.balance,
      });
    }
  }

  private startNextRound(): void {
    this.roundId++;
    const { crashPoint, hash } = this.rng.nextRound();

    // Broadcast waiting phase
    this.broadcast({
      type: 'round:waiting',
      nextRoundIn: COUNTDOWN_SECONDS,
      previousHash: this.previousHash,
      previousCrashPoint: this.previousCrashPoint,
    });

    this.round = new Round(this.roundId, crashPoint, hash, {
      onTick: (multiplier, elapsed, chasePhase) => {
        this.broadcast({ type: 'round:tick', multiplier, elapsed });
      },
      onCrash: (cp, h) => {
        this.onRoundCrash(cp, h);
      },
      onPhaseChange: (_phase: ChasePhase) => {
        // Phase changes are derived client-side from multiplier
      },
      onObstacle: (obstacleType, lane, lanes, rz?) => {
        this.broadcast({ type: 'obstacle:spawn', obstacleType, lane, lanes, rz });
      },
      onKashMove: (lane) => {
        this.broadcast({ type: 'kash:move', lane });
      },
    });

    // Countdown
    this.countdownStartedAt = Date.now();
    this.broadcast({ type: 'round:countdown', roundId: this.roundId, seconds: COUNTDOWN_SECONDS });

    setTimeout(() => {
      if (this.round && this.round.id === this.roundId) {
        this.countdownStartedAt = null;
        this.round.start();
      }
    }, COUNTDOWN_SECONDS * 1000);
  }

  private onRoundCrash(crashPoint: number, hash: string): void {
    // Record history
    this.history.unshift({ roundId: this.roundId, crashPoint, hash });
    if (this.history.length > 50) this.history.pop();

    this.previousHash = hash;
    this.previousCrashPoint = crashPoint;

    // Broadcast crash
    this.broadcast({ type: 'round:crash', crashPoint, hash, roundId: this.roundId });

    // End round for all players
    for (const session of this.players.values()) {
      session.roundEnd();
    }

    // Schedule next round
    setTimeout(() => this.startNextRound(), WAIT_AFTER_CRASH);
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const session of this.players.values()) {
      if (session.isConnected) {
        session.send(msg);
      }
    }
  }

  private broadcastPlayerCount(): void {
    let totalBet = 0;
    let count = 0;
    for (const s of this.players.values()) {
      if (s.isConnected) count++;
      if (s.currentBet) totalBet += s.currentBet;
    }
    this.broadcast({ type: 'players', count, totalBet });
  }
}
