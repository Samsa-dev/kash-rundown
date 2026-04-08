import { createHash, randomBytes } from 'crypto';

const HOUSE_EDGE = 0.04;
const INSTANT_CRASH_RATE = 0.012;
const CHAIN_LENGTH = 10_000;

/**
 * Provably Fair RNG using SHA-256 hash chain.
 *
 * How it works:
 * 1. Generate a random seed
 * 2. Hash it CHAIN_LENGTH times to build the chain
 * 3. Reveal the last hash as public commitment
 * 4. Use hashes in reverse order (LIFO) — each round reveals next hash
 * 5. Anyone can verify: SHA256(revealed_hash) === previous_round_hash
 */
export class ProvablyFairRNG {
  private chain: string[] = [];
  private cursor = 0;
  public publicSeed: string; // The commitment hash (last in chain)

  constructor() {
    const seed = randomBytes(32).toString('hex');
    this.chain = this.buildChain(seed, CHAIN_LENGTH);
    this.publicSeed = this.chain[this.chain.length - 1];
    this.cursor = 0;
  }

  private buildChain(seed: string, length: number): string[] {
    const chain: string[] = [seed];
    for (let i = 1; i < length; i++) {
      chain.push(sha256(chain[i - 1]));
    }
    return chain;
  }

  /** Get the next crash point and its hash for verification */
  nextRound(): { crashPoint: number; hash: string } {
    if (this.cursor >= this.chain.length - 1) {
      // Regenerate chain if exhausted
      const newSeed = randomBytes(32).toString('hex');
      this.chain = this.buildChain(newSeed, CHAIN_LENGTH);
      this.publicSeed = this.chain[this.chain.length - 1];
      this.cursor = 0;
    }

    const hash = this.chain[this.cursor];
    this.cursor++;

    const crashPoint = hashToCrashPoint(hash);
    return { crashPoint, hash };
  }

  /** How many rounds remain in current chain */
  get remainingRounds(): number {
    return this.chain.length - 1 - this.cursor;
  }
}

/** Convert a hex hash to a crash point multiplier */
function hashToCrashPoint(hash: string): number {
  // Use first 8 hex chars (32 bits) for randomness
  const r = parseInt(hash.slice(0, 8), 16) / 0xFFFFFFFF;

  // ~1.2% instant crash
  if (r < INSTANT_CRASH_RATE) return 1.00;

  // Inverse transform with house edge (same formula as client RNG)
  const raw = Math.max(1.00, 1 / (r * (1 - HOUSE_EDGE)));
  return Math.round(raw * 100) / 100;
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Verify that a hash is the preimage of the next hash in the chain */
export function verifyHash(hash: string, nextHash: string): boolean {
  return sha256(hash) === nextHash;
}
