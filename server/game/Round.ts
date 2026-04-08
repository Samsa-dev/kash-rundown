import { calcMultiplier, getChasePhase } from './Multiplier';
import type { RoundPhase, ChasePhase } from '../types';

export interface RoundEvents {
  onTick(multiplier: number, elapsed: number, chasePhase: ChasePhase): void;
  onCrash(crashPoint: number, hash: string): void;
  onPhaseChange(phase: ChasePhase): void;
  onObstacle(type: string, lane: number, lanes: number, rz?: number): void;
  onKashMove(lane: number): void;
}

const OBSTACLE_TYPES = ['barricade', 'spikes', 'dumpster', 'cones', 'manhole'];
const WIDE_TYPES = ['police_alt'];
const OBSTACLE_LANES = [-0.667, 0, 0.667];
const KASH_LANES = [-0.8, -0.05, 0.7];

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
  private pendingDodge: ReturnType<typeof setTimeout> | null = null;

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

    // Spawn obstacles — but not if we're about to crash (within 10% of crash point)
    if (this.multiplier < this.crashPoint * 0.9) {
      this.maybeSpawnObstacle();
    }

    // Emit tick
    this.events.onTick(this.multiplier, elapsed, this.chasePhase);
  }

  private maybeSpawnObstacle(): void {
    const now = Date.now();
    const interval = [1200, 800, 500, 350, 250][this.chasePhase - 1];

    if (now - this.lastObstacleAt < interval) return;
    if (Math.random() > 0.7) return;

    this.lastObstacleAt = now;

    // How many obstacles? More likely in higher phases
    const multiChance = [0.15, 0.25, 0.35, 0.45, 0.5][this.chasePhase - 1];
    const count = Math.random() < multiChance ? 2 : 1;

    // Pick all lanes first
    const usedLanes: number[] = [];
    for (let i = 0; i < count; i++) {
      const availableLanes = OBSTACLE_LANES.filter(l => !usedLanes.some(u => Math.abs(u - l) < 0.3));
      if (availableLanes.length === 0) break;
      usedLanes.push(availableLanes[Math.floor(Math.random() * availableLanes.length)]);
    }

    // Chance of a wide obstacle instead of normal ones
    let isWide = false;
    const wideChance = this.chasePhase >= 3 ? 0.2 : 0;
    if (WIDE_TYPES.length > 0 && Math.random() < wideChance) {
      // Spawn one wide obstacle instead
      isWide = true;
      const type = WIDE_TYPES[Math.floor(Math.random() * WIDE_TYPES.length)];
      const lane = [-0.333, 0.333][Math.floor(Math.random() * 2)];
      this.events.onObstacle(type, lane, 2);
      usedLanes.length = 0;
      usedLanes.push(lane);
    } else {
      // Spawn normal obstacles
      for (const l of usedLanes) {
        const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
        this.events.onObstacle(type, l, 1);
      }
    }

    // Wide obstacles cover more space — bigger danger/safe zone
    const dangerRadius = isWide ? 0.7 : 0.4;
    const safeRadius = isWide ? 0.6 : 0.3;

    // Kash only moves when in danger
    const inDanger = usedLanes.some(l => Math.abs(this.kashLane - l) < dangerRadius);
    if (inDanger) {
      const safeLanes = KASH_LANES.filter(kl => usedLanes.every(ol => Math.abs(kl - ol) > safeRadius));
      if (safeLanes.length > 0) {
        const newLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
        this.kashLane = newLane;
        this.events.onKashMove(newLane);
      }
    }
  }

  private crash(): void {
    this.phase = 'CRASHED';
    this.stop();
    if (this.pendingDodge) { clearTimeout(this.pendingDodge); this.pendingDodge = null; }

    // Spawn crash obstacle exactly in Kash's lane
    const crashType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    const crashLane = this.kashLane;

    if (this.crashPoint <= 1.00) {
      // Instant crash — no obstacle, engine didn't start
      this.events.onCrash(this.crashPoint, this.hash);
    } else {
      // Spawn obstacle from the horizon — delay scales with phase speed
      this.events.onObstacle(crashType, crashLane, 1, 0);
      const delay = [1000, 600, 380, 300, 200][this.chasePhase - 1];
      setTimeout(() => {
        this.events.onCrash(this.crashPoint, this.hash);
      }, delay);
    }
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
