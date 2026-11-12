/**
 * Fair-dealer (H0) probabilities for the detector's indicators, given a board and a weight
 * vector F over the pool (`06-methods.md` §4). Under H0 the three slots are independent
 * draws from F, so hands are i.i.d. triples (duplicates allowed).
 *
 * - "Some piece fits": p = 1 − (1 − F(S(B)))³, exact.
 * - "Hand contains a hard piece": p = 1 − (1 − F(hard))³, exact.
 * - "Hand fully placeable in some order": exact enumeration of multisets when the fits-set
 *   S(B) is small (near-full boards, where the hazard matters), Monte Carlo otherwise, with
 *   the standard error reported.
 *
 * All functions treat `weights` as unnormalised and normalise internally. Shapes absent from
 * the map, or with weight 0, are never dealt (the §9 treatment of unobserved shapes).
 */

import type { Board } from './board.ts';
import type { Rng } from './rng.ts';
import { HARD_SHAPE_IDS, getShape, type ShapeId } from './shapes.ts';
import { createSolvabilityCache, fitsAnywhereSet, isHandSolvable, type SolvabilityCache } from './solvability.ts';
import type { Hand } from './types.ts';

/** A marginal F over the pool: shape id → non-negative weight (need not sum to 1). */
export type Weights = ReadonlyMap<ShapeId, number>;

/** Uniform weights over a pool. */
export function uniformWeights(pool: readonly ShapeId[]): Weights {
  const m = new Map<ShapeId, number>();
  for (const id of pool) m.set(id, 1);
  return m;
}

/** Plug-in weights from observed counts (the marginal-estimation rule, `06-methods.md` §4). */
export function weightsFromCounts(counts: ReadonlyMap<ShapeId, number>): Weights {
  return new Map(counts);
}

/** Normalised weights as a parallel pair of arrays (ids with positive weight only). */
export interface NormalisedWeights {
  readonly ids: readonly ShapeId[];
  readonly probs: readonly number[];
}

/** Drop zero/negative/unknown entries and normalise to sum 1. Throws if nothing remains. */
export function normaliseWeights(weights: Weights): NormalisedWeights {
  const ids: ShapeId[] = [];
  const raw: number[] = [];
  let total = 0;
  for (const [id, w] of weights) {
    if (!(w > 0) || !Number.isFinite(w)) continue;
    getShape(id); // throws on unknown ids
    ids.push(id);
    raw.push(w);
    total += w;
  }
  if (total <= 0) throw new Error('weights must contain at least one positive entry');
  return { ids, probs: raw.map((w) => w / total) };
}

/** Total normalised weight of a set of shapes. */
export function weightOf(set: ReadonlySet<ShapeId>, weights: Weights): number {
  const { ids, probs } = normaliseWeights(weights);
  let w = 0;
  for (let i = 0; i < ids.length; i++) if (set.has(ids[i] as ShapeId)) w += probs[i] as number;
  return w;
}

/** P_H0(at least one of the three pieces fits somewhere | board) = 1 − (1 − F(S(B)))³. */
export function pSomeFits(board: Board, weights: Weights): number {
  const { ids, probs } = normaliseWeights(weights);
  const fits = fitsAnywhereSet(board, ids);
  let w = 0;
  for (let i = 0; i < ids.length; i++) if (fits.has(ids[i] as ShapeId)) w += probs[i] as number;
  return 1 - (1 - w) ** 3;
}

/** P_H0(hand contains at least one hard piece) = 1 − (1 − F(hard))³. Board-independent. */
export function pHardPiece(weights: Weights): number {
  const { ids, probs } = normaliseWeights(weights);
  let w = 0;
  for (let i = 0; i < ids.length; i++) if (HARD_SHAPE_IDS.has(ids[i] as ShapeId)) w += probs[i] as number;
  return 1 - (1 - w) ** 3;
}

/** Options for {@link pHandSolvable}. */
export interface HandSolvableOptions {
  /** Enumerate exactly when |S(B)| ≤ this; default 12. */
  readonly exactThreshold?: number;
  /** Monte Carlo sample size otherwise; default 20,000. */
  readonly samples?: number;
  /** RNG for Monte Carlo. Required when the Monte Carlo branch can be taken. */
  readonly rng?: Rng;
  /** Shared memo across calls on the same board (and across boards; keys include the board). */
  readonly memo?: SolvabilityCache;
}

/** A null probability with its provenance. */
export interface NullProbability {
  readonly p: number;
  /** True when computed by exact enumeration; false for Monte Carlo. */
  readonly exact: boolean;
  /** Standard error of a Monte Carlo estimate (absent when exact). */
  readonly se?: number;
  /** |S(B)|: how many pool shapes fit the board individually. */
  readonly fitsCount: number;
  /** Multisets evaluated (exact) or hands sampled (Monte Carlo). */
  readonly evaluations: number;
}

const DEFAULT_EXACT_THRESHOLD = 12;
const DEFAULT_SAMPLES = 20_000;

/**
 * P_H0(the dealt hand can be fully placed in some order | board).
 *
 * Exact branch: sum over all multisets {a ≤ b ≤ c} of pool shapes with positive weight of
 * P(multiset) · 1[solvable]. Multisets with no piece in S(B) are unsolvable and are skipped in
 * bulk; multisets with at least one fitting piece are checked by the oracle (a non-fitting
 * piece may still fit after a clear, so they are not assumed unsolvable).
 *
 * Monte Carlo branch: `samples` i.i.d. hands from F; `se = sqrt(p(1−p)/n)`.
 */
export function pHandSolvable(board: Board, weights: Weights, opts: HandSolvableOptions = {}): NullProbability {
  const { ids, probs } = normaliseWeights(weights);
  const fits = fitsAnywhereSet(board, ids);
  const fitsCount = fits.size;
  if (fitsCount === 0) return { p: 0, exact: true, fitsCount, evaluations: 0 };

  const memo = opts.memo ?? createSolvabilityCache();
  const threshold = opts.exactThreshold ?? DEFAULT_EXACT_THRESHOLD;

  if (fitsCount <= threshold) {
    return exactHandSolvable(board, ids, probs, fits, memo, fitsCount);
  }
  const rng = opts.rng;
  if (rng === undefined) throw new Error('pHandSolvable: Monte Carlo branch needs opts.rng');
  return monteCarloHandSolvable(board, ids, probs, rng, opts.samples ?? DEFAULT_SAMPLES, memo, fitsCount);
}

function exactHandSolvable(
  board: Board,
  ids: readonly ShapeId[],
  probs: readonly number[],
  fits: ReadonlySet<ShapeId>,
  memo: SolvabilityCache,
  fitsCount: number,
): NullProbability {
  const n = ids.length;
  let p = 0;
  let evaluations = 0;
  for (let i = 0; i < n; i++) {
    const a = ids[i] as ShapeId;
    const pa = probs[i] as number;
    for (let j = i; j < n; j++) {
      const b = ids[j] as ShapeId;
      const pb = probs[j] as number;
      for (let k = j; k < n; k++) {
        const c = ids[k] as ShapeId;
        if (!fits.has(a) && !fits.has(b) && !fits.has(c)) continue; // nothing fits: unsolvable
        const pc = probs[k] as number;
        evaluations++;
        const hand: Hand = [a, b, c];
        if (!isHandSolvable(board, hand, memo)) continue;
        // Number of ordered hands mapping to this multiset: 6 if all distinct, 3 if one pair, 1 if a triple.
        const orderings = i === j && j === k ? 1 : i === j || j === k ? 3 : 6;
        p += orderings * pa * pb * pc;
      }
    }
  }
  return { p: Math.min(1, p), exact: true, fitsCount, evaluations };
}

/** Sample one shape id from normalised probabilities. */
export function sampleShape(ids: readonly ShapeId[], probs: readonly number[], rng: Rng): ShapeId {
  const u = rng.next();
  let acc = 0;
  for (let i = 0; i < ids.length; i++) {
    acc += probs[i] as number;
    if (u < acc) return ids[i] as ShapeId;
  }
  return ids[ids.length - 1] as ShapeId; // floating-point tail
}

function monteCarloHandSolvable(
  board: Board,
  ids: readonly ShapeId[],
  probs: readonly number[],
  rng: Rng,
  samples: number,
  memo: SolvabilityCache,
  fitsCount: number,
): NullProbability {
  if (!Number.isInteger(samples) || samples <= 0) throw new RangeError('samples must be a positive integer');
  let hits = 0;
  for (let s = 0; s < samples; s++) {
    const hand: Hand = [sampleShape(ids, probs, rng), sampleShape(ids, probs, rng), sampleShape(ids, probs, rng)];
    if (isHandSolvable(board, hand, memo)) hits++;
  }
  const p = hits / samples;
  return { p, exact: false, se: Math.sqrt((p * (1 - p)) / samples), fitsCount, evaluations: samples };
}
