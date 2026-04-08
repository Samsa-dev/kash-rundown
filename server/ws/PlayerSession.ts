import type WebSocket from 'ws';
import type { ServerMessage } from '../types';

const STARTING_BALANCE = 1000;

export class PlayerSession {
  public id: string;
  public balance: number;
  public currentBet: number | null = null;
  public cashedOut = false;
  public cashOutMultiplier: number | null = null;
  private ws: WebSocket;

  constructor(id: string, ws: WebSocket) {
    this.id = id;
    this.ws = ws;
    this.balance = STARTING_BALANCE;
  }

  send(msg: ServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  placeBet(amount: number): boolean {
    if (this.currentBet !== null) return false; // already bet this round
    if (amount < 1 || amount > this.balance) return false;

    this.balance -= amount;
    this.currentBet = amount;
    this.cashedOut = false;
    this.cashOutMultiplier = null;
    return true;
  }

  cancelBet(): number | null {
    if (this.currentBet === null || this.cashedOut) return null;
    const refund = this.currentBet;
    this.balance += refund;
    this.currentBet = null;
    return refund;
  }

  cashOut(multiplier: number): number | null {
    if (this.currentBet === null || this.cashedOut) return null;

    const winAmount = this.currentBet * multiplier;
    this.balance += winAmount;
    this.cashedOut = true;
    this.cashOutMultiplier = multiplier;
    return winAmount;
  }

  /** Called when round crashes — player who didn't cash out loses bet */
  roundEnd(): void {
    this.currentBet = null;
    this.cashedOut = false;
    this.cashOutMultiplier = null;
  }

  get isConnected(): boolean {
    return this.ws.readyState === this.ws.OPEN;
  }
}
