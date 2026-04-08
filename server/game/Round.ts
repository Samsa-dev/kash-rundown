import { calcMultiplier, getChasePhase } from './Multiplier';
import type { RoundPhase, ChasePhase } from '../types';

export interface RoundEvents {
  onTick(multiplier: number, elapsed: number, chasePhase: ChasePhase): void;
  onCrash(crashPoint: number, hash: string): void;
  onPhaseChange(phase: ChasePhase): void;
  onObstacle(type: string, lane: number, lanes: number): void;
  onKashMove(lane: number): void;
}

const OBSTACLE_TYPES = ['barricade', 'spikes', 'dumpster', 'cones', 'flipped_car', 'electric_puddle'];
const WIDE_TYPES = ['barricade', 'spikes', 'flipped_car', 'electric_puddle'];
const OBSTACLE_LANES = [-0.667, 0, 0.667];
const KASH_LANES = [-0.5, 0, 0.5];

export class Round {
  public id: number;
  public phase: RoundPhase = 'WAITING';
  public crashPoint: number;
  public hash: string;
  public multiplier = 1.00;
  public chasePhase: ChasePhase = 1;
  public startTime: number | null = null;

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private events: RoundEvents;
  private kashLane = 0;
  private lastObstacleAt = 0;

  constructor(id: number, crashPoint: number, hash: string, events: RoundEvents) {
    this.id = id;
    this.crashPoint = crashPoint;
    this.hash = hash;
    this.events = events;
  }

  start(): void {
    this.phase = 'RUNNING';
    this.startTime = Date.now();
    this.multiplier = 1.00;
    this.chasePhase = 1;
    this.kashLane = 0;
    this.lastObstacleAt = 0;

    this.tickInterval = setInterval(() => this.tick(), 80);
  }

  private tick(): void {
    if (this.phase !== 'RUNNING' || !this.startTime) return;

    const elapsed = Date.now() - this.startTime;
    this.multiplier = calcMultiplier(elapsed);

    // Crash check
    if (this.multiplier >= this.crashPoint) {
      this.multiplier = this.crashPoint;
      this.crash();
      return;
    }

    // Phase transition
    const newPhase = getChasePhase(this.multiplier);
    if (newPhase !== this.chasePhase) {
      this.chasePhase = newPhase;
      this.events.onPhaseChange(newPhase);
    }

    // Spawn obstacles as visual drama
    this.maybeSpawnObstacle();

    // Emit tick
    this.events.onTick(this.multiplier, elapsed, this.chasePhase);
  }

  private maybeSpawnObstacle(): void {
    const now = Date.now();
    // Obstacles more frequent in higher phases
    const interval = [3000, 2000, 1200, 800][this.chasePhase - 1];

    if (now - this.lastObstacleAt < interval) return;
    if (Math.random() > 0.4) return;

    this.lastObstacleAt = now;

    const isWide = this.chasePhase >= 3 && Math.random() < 0.25;
    const type = isWide
      ? WIDE_TYPES[Math.floor(Math.random() * WIDE_TYPES.length)]
      : OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    const lane = isWide
      ? [-0.333, 0.333][Math.floor(Math.random() * 2)]
      : OBSTACLE_LANES[Math.floor(Math.random() * OBSTACLE_LANES.length)];

    this.events.onObstacle(type, lane, isWide ? 2 : 1);

    // Kash auto-dodges: move to a different lane
    if (Math.random() < 0.6) {
      const safeLanes = KASH_LANES.filter(l => Math.abs(l - lane) > 0.3);
      if (safeLanes.length > 0) {
        this.kashLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
        this.events.onKashMove(this.kashLane);
      }
    }
  }

  private crash(): void {
    this.phase = 'CRASHED';
    this.stop();
    this.events.onCrash(this.crashPoint, this.hash);
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
