/**
 * Exact-ish permutation tests on hand composition (`06-methods.md` §3.4), the H5 battery:
 * within-hand duplicate rate, hand size-sum variance, slot-position bias, and lag-k serial
 * correlation of size across consecutive hands. Each is a hand-only statistic, so it is tested
 * by an appropriate permutation (repartition pooled pieces, shuffle slots within hands, or
 * shuffle hand order within games). Board-conditional statistics are NOT permuted here.
 *
 * The detector's single H5 primary is the Bonferroni-combined omnibus over the battery, which
 * fires for both bag-like dealers (duplicate/lag) and slot-biased dealers (slot-position).
 */

import { getShape, seedRng, shuffleInPlace, type Rng, type ShapeId } from '@blockblast/engine';
import type { Game } from './dataset.ts';
import { normalTwoSidedP } from './stats.ts';

/** Result of one permutation test. */
export interface PermTestResult {
  readonly statistic: number;
  /** Mean of the permutation null. */
  readonly nullMean: number;
  readonly nullSd: number;
  /** Two-sided empirical permutation p-value, (1 + #{|perm − mean| ≥ |obs − mean|}) / (B + 1). */
  readonly p: number;
  /**
   * Studentized (normal-approximation) two-sided p-value from z = (obs − mean)/sd. The
   * permutation null of these sum/mean statistics is asymptotically normal, so this has no
   * 1/(B+1) resolution floor — necessary to clear Holm at α = 0.01. The §7 KS-uniformity check
   * confirms it stays calibrated under the null generators.
   */
  readonly zApproxP: number;
  readonly permutations: number;
}

const sizeOf = (id: ShapeId): number => getShape(id).size;

/** All dealt hands pooled (each an ordered triple). */
function allHands(games: readonly Game[]): Array<readonly [ShapeId, ShapeId, ShapeId]> {
  const out: Array<readonly [ShapeId, ShapeId, ShapeId]> = [];
  for (const g of games) for (const r of g) out.push(r.hand);
  return out;
}

function twoSidedP(obs: number, nulls: readonly number[], nullMean: number): number {
  const d = Math.abs(obs - nullMean);
  let ge = 0;
  for (const v of nulls) if (Math.abs(v - nullMean) >= d - 1e-12) ge++;
  return (1 + ge) / (nulls.length + 1);
}

function summarise(obs: number, nulls: number[], permutations: number): PermTestResult {
  const n = nulls.length;
  const nullMean = nulls.reduce((a, b) => a + b, 0) / n;
  const nullSd = Math.sqrt(nulls.reduce((a, b) => a + (b - nullMean) * (b - nullMean), 0) / Math.max(1, n - 1));
  const zApproxP = nullSd > 0 ? normalTwoSidedP((obs - nullMean) / nullSd) : obs === nullMean ? 1 : 0;
  return { statistic: obs, nullMean, nullSd, p: twoSidedP(obs, nulls, nullMean), zApproxP, permutations };
}

/** Fraction of hands containing at least two equal piece ids. */
function duplicateRate(hands: ReadonlyArray<readonly [ShapeId, ShapeId, ShapeId]>): number {
  let dup = 0;
  for (const h of hands) if (h[0] === h[1] || h[1] === h[2] || h[0] === h[2]) dup++;
  return dup / hands.length;
}

/** Variance of the per-hand size-sum. */
function sizeSumVariance(hands: ReadonlyArray<readonly [ShapeId, ShapeId, ShapeId]>): number {
  const sums = hands.map((h) => sizeOf(h[0]) + sizeOf(h[1]) + sizeOf(h[2]));
  const m = sums.reduce((a, b) => a + b, 0) / sums.length;
  return sums.reduce((a, b) => a + (b - m) * (b - m), 0) / sums.length;
}

/**
 * Permutation test for a pooled-piece statistic (duplicate rate, size-sum variance): repartition
 * all dealt pieces into random triples, which is the exact null of independent slots with the
 * observed marginal.
 */
function pooledPieceTest(
  games: readonly Game[],
  stat: (hands: ReadonlyArray<readonly [ShapeId, ShapeId, ShapeId]>) => number,
  B: number,
  rng: Rng,
): PermTestResult {
  const hands = allHands(games);
  const obs = stat(hands);
  const pool: ShapeId[] = [];
  for (const h of hands) pool.push(h[0], h[1], h[2]);
  const nHands = hands.length;
  const nulls: number[] = [];
  for (let b = 0; b < B; b++) {
    shuffleInPlace(pool, rng);
    const perm: Array<readonly [ShapeId, ShapeId, ShapeId]> = [];
    for (let i = 0; i < nHands; i++) {
      const j = i * 3;
      perm.push([pool[j] as ShapeId, pool[j + 1] as ShapeId, pool[j + 2] as ShapeId]);
    }
    nulls.push(stat(perm));
  }
  return summarise(obs, nulls, B);
}

/** Within-hand duplicate-rate permutation test (bag → fewer duplicates than independence). */
export function duplicateRateTest(games: readonly Game[], B = 2000, rng: Rng = seedRng('perm-dup')): PermTestResult {
  return pooledPieceTest(games, duplicateRate, B, rng);
}

/** Size-sum variance permutation test (size balancing → lower variance). */
export function sizeSumVarianceTest(games: readonly Game[], B = 2000, rng: Rng = seedRng('perm-var')): PermTestResult {
  return pooledPieceTest(games, sizeSumVariance, B, rng);
}

/**
 * Slot-position bias: mean size of slot 0 minus mean size of slot 2. The null shuffles the three
 * slots within each hand (slot order is exchangeable under H0). SlotBiased sorts hands, so slot 0
 * is systematically smaller and the statistic is strongly negative.
 */
export function slotBiasTest(games: readonly Game[], B = 2000, rng: Rng = seedRng('perm-slot')): PermTestResult {
  const hands = allHands(games);
  const stat = (hh: ReadonlyArray<readonly [number, number, number]>): number => {
    let s0 = 0;
    let s2 = 0;
    for (const h of hh) {
      s0 += sizeOf(h[0] as ShapeId);
      s2 += sizeOf(h[2] as ShapeId);
    }
    return (s0 - s2) / hh.length;
  };
  const obs = stat(hands);
  const nulls: number[] = [];
  for (let b = 0; b < B; b++) {
    const perm = hands.map((h) => {
      const t = [h[0], h[1], h[2]];
      shuffleInPlace(t, rng);
      return t as unknown as readonly [number, number, number];
    });
    nulls.push(stat(perm));
  }
  return summarise(obs, nulls, B);
}

/**
 * Lag-1 serial correlation of the per-hand size-sum across consecutive hands within a game (bag
 * detection). The null shuffles the order of hands within each game (hands i.i.d. under H0).
 */
export function lag1Test(games: readonly Game[], B = 2000, rng: Rng = seedRng('perm-lag')): PermTestResult {
  const seqs = games.map((g) => g.map((r) => sizeOf(r.hand[0]) + sizeOf(r.hand[1]) + sizeOf(r.hand[2]))).filter((s) => s.length >= 3);
  const autocorr = (sequences: number[][]): number => {
    let num = 0;
    let den = 0;
    let count = 0;
    let grand = 0;
    for (const s of sequences) {
      for (const v of s) grand += v;
      count += s.length;
    }
    const mean = count > 0 ? grand / count : 0;
    for (const s of sequences) {
      for (let i = 0; i < s.length; i++) {
        const d = (s[i] as number) - mean;
        den += d * d;
        if (i + 1 < s.length) num += d * ((s[i + 1] as number) - mean);
      }
    }
    return den > 0 ? num / den : 0;
  };
  const obs = autocorr(seqs);
  const nulls: number[] = [];
  for (let b = 0; b < B; b++) {
    const perm = seqs.map((s) => shuffleInPlace([...s], rng));
    nulls.push(autocorr(perm));
  }
  return summarise(obs, nulls, B);
}

/** The full H5 battery and its Bonferroni-combined omnibus p-value. */
export interface HandCompositionResult {
  readonly duplicate: PermTestResult;
  readonly sizeVariance: PermTestResult;
  readonly slotBias: PermTestResult;
  readonly lag1: PermTestResult;
  /**
   * Bonferroni-combined studentized p over the two trend-robust statistics (duplicate rate and
   * slot-position bias): the single H5 primary p-value. `sizeVariance` and `lag1` are confounded
   * by non-stationarity — a score-dependent dealer makes the three pieces of a hand share the
   * same state, inflating within-hand size correlation and serial correlation even though the
   * slots are conditionally independent — so they are reported as exploratory (§3.4) but kept
   * out of the primary, which must attribute a kill dealer to H3, not H5 (§7 criterion 3).
   */
  readonly omnibusP: number;
  /** Bonferroni-combined empirical permutation p over the same two statistics (for reporting). */
  readonly omnibusEmpiricalP: number;
}

/** Run the four hand-composition permutation tests. */
export function handCompositionTests(games: readonly Game[], B = 2000, seed: number | string = 'perm'): HandCompositionResult {
  const duplicate = duplicateRateTest(games, B, seedRng(`${seed}-dup`));
  const sizeVariance = sizeSumVarianceTest(games, B, seedRng(`${seed}-var`));
  const slotBias = slotBiasTest(games, B, seedRng(`${seed}-slot`));
  const lag1 = lag1Test(games, B, seedRng(`${seed}-lag`));
  const minZ = Math.min(duplicate.zApproxP, slotBias.zApproxP);
  const minEmp = Math.min(duplicate.p, slotBias.p);
  return { duplicate, sizeVariance, slotBias, lag1, omnibusP: Math.min(1, minZ * 2), omnibusEmpiricalP: Math.min(1, minEmp * 2) };
}
