/**
 * Seeded pseudo-random numbers: xoshiro128** (Blackman & Vigna), 128-bit state, period 2^128 − 1.
 * Deterministic, serialisable, forkable; no dependency on `Math.random`.
 *
 * Not for cryptography. Suitable for simulation and for Monte Carlo null probabilities.
 */

/** Serialisable RNG state: four unsigned 32-bit words. */
export interface RngState {
  readonly algorithm: 'xoshiro128**';
  readonly s: readonly [number, number, number, number];
}

/** The random source the engine consumes. */
export interface Rng {
  /** Uniform double in [0, 1) with 53 bits of resolution. */
  next(): number;
  /** Uniform integer in [0, n) without modulo bias. `n` must be a positive integer ≤ 2^32. */
  nextInt(n: number): number;
  /** Uniform unsigned 32-bit integer. */
  nextUint32(): number;
  /** A new independent stream derived from (and advancing) this one. */
  fork(): Rng;
  /** Snapshot of the state; restore with {@link Xoshiro128ss.fromState}. */
  getState(): RngState;
}

const TWO_32 = 4294967296;
const TWO_53 = 9007199254740992;

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** splitmix32: expands a 32-bit seed into a well-mixed sequence of 32-bit words. */
function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

/** FNV-1a 32-bit hash of a string, for string seeds. */
export function hashStringSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seedToUint32(seed: number | string): number {
  if (typeof seed === 'string') return hashStringSeed(seed);
  if (!Number.isFinite(seed)) throw new RangeError('seed must be finite');
  // Fold a double into 32 bits deterministically (integers below 2^32 map to themselves).
  const asInt = Math.floor(seed);
  if (asInt === seed && asInt >= 0 && asInt < TWO_32) return asInt >>> 0;
  return hashStringSeed(String(seed));
}

/** xoshiro128** generator. */
export class Xoshiro128ss implements Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  private constructor(s0: number, s1: number, s2: number, s3: number) {
    this.s0 = s0 >>> 0;
    this.s1 = s1 >>> 0;
    this.s2 = s2 >>> 0;
    this.s3 = s3 >>> 0;
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) {
      // The all-zero state is a fixed point; nudge it.
      this.s0 = 1;
    }
  }

  /** Create from a numeric or string seed (expanded via splitmix32). */
  static fromSeed(seed: number | string): Xoshiro128ss {
    const mix = splitmix32(seedToUint32(seed));
    return new Xoshiro128ss(mix(), mix(), mix(), mix());
  }

  /** Restore a snapshot from {@link getState}. */
  static fromState(state: RngState): Xoshiro128ss {
    if (state.algorithm !== 'xoshiro128**' || state.s.length !== 4) {
      throw new Error('unsupported RNG state');
    }
    const [a, b, c, d] = state.s;
    return new Xoshiro128ss(a, b, c, d);
  }

  nextUint32(): number {
    const s1 = this.s1;
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ s1) >>> 0;
    this.s1 = (s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  next(): number {
    const hi = this.nextUint32() >>> 5; // 27 bits
    const lo = this.nextUint32() >>> 6; // 26 bits
    return (hi * 67108864 + lo) / TWO_53;
  }

  nextInt(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > TWO_32) {
      throw new RangeError(`nextInt bound must be an integer in [1, 2^32], got ${n}`);
    }
    if (n === 1) return 0;
    // Rejection sampling: discard draws above the largest multiple of n below 2^32.
    const limit = TWO_32 - (TWO_32 % n);
    let x = this.nextUint32();
    while (x >= limit) x = this.nextUint32();
    return x % n;
  }

  fork(): Xoshiro128ss {
    const mix = splitmix32(this.nextUint32());
    return new Xoshiro128ss(mix() ^ this.nextUint32(), mix() ^ this.nextUint32(), mix() ^ this.nextUint32(), mix() ^ this.nextUint32());
  }

  getState(): RngState {
    return { algorithm: 'xoshiro128**', s: [this.s0, this.s1, this.s2, this.s3] };
  }
}

/** Convenience: a seeded {@link Rng}. */
export function seedRng(seed: number | string): Rng {
  return Xoshiro128ss.fromSeed(seed);
}

/** Fisher–Yates shuffle in place using the given RNG. */
export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const a = items[i] as T;
    items[i] = items[j] as T;
    items[j] = a;
  }
  return items;
}
