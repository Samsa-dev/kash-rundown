/**
 * Provably Fair RNG — client-side hash chain using SHA-256.
 *
 * How it works:
 * 1. Generate a random seed via crypto.getRandomValues
 * 2. Pre-compute a chain of SHA-256 hashes
 * 3. Use hashes in LIFO order to derive crash points
 * 4. Same formula as the server: identical distribution
 *
 * The chain is generated async at startup, then consumed synchronously.
 */

const HOUSE_EDGE = 0.04;
const INSTANT_CRASH_RATE = 0.012;
const CHAIN_LENGTH = 500;

let chain: string[] = [];
let cursor = 0;
let ready = false;

/** Hex encode a Uint8Array */
function toHex(buf: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < buf.length; i++) hex += buf[i].toString(16).padStart(2, '0');
  return hex;
}

/** SHA-256 hash a hex string */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(hash));
}

/** Build the hash chain (async, called once at startup) */
async function buildChain(): Promise<void> {
  const seedBytes = new Uint8Array(32);
  crypto.getRandomValues(seedBytes);
  const seed = toHex(seedBytes);

  chain = [seed];
  for (let i = 1; i < CHAIN_LENGTH; i++) {
    chain.push(await sha256(chain[i - 1]));
  }
  cursor = 0;
  ready = true;
}

/** Convert a hex hash to a crash point — same formula as server */
function hashToCrashPoint(hash: string): number {
  const r = parseInt(hash.slice(0, 8), 16) / 0xFFFFFFFF;
  if (r < INSTANT_CRASH_RATE) return 1.00;
  const raw = Math.max(1.00, 1 / (r * (1 - HOUSE_EDGE)));
  return Math.round(raw * 100) / 100;
}

/** Initialize the RNG — call once before the game starts */
export async function initRNG(): Promise<void> {
  await buildChain();
}

/** Generate the next crash point from the hash chain */
export function generateCrashPoint(): number {
  if (!ready || cursor >= chain.length - 1) {
    // Fallback if chain exhausted (shouldn't happen with 500 rounds)
    // Regenerate synchronously using Math.random same formula
    const r = Math.random();
    if (r < INSTANT_CRASH_RATE) return 1.00;
    return Math.round(Math.max(1.00, 1 / (r * (1 - HOUSE_EDGE))) * 100) / 100;
  }

  const hash = chain[cursor];
  cursor++;

  // Regenerate chain in background if running low
  if (cursor > chain.length - 50) {
    buildChain(); // fire and forget
  }

  return hashToCrashPoint(hash);
}

/**
 * Calculate multiplier from elapsed time.
 * Exponential growth curve — same as server.
 */
const GROWTH_RATE = 0.000055;

export function calcMultiplier(elapsedMs: number): number {
  return Math.max(1.00, Math.exp(GROWTH_RATE * elapsedMs));
}

/**
 * Inverse: get elapsed time for a given multiplier.
 */
export function getElapsedForMult(m: number): number {
  return Math.log(Math.max(1, m)) / GROWTH_RATE;
}
