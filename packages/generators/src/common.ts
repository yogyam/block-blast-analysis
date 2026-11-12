/**
 * Shared machinery for the zoo: a weighted sampler, score thresholds, the fit-biased solvable
 * hand search used by the rescue-type generators, and small helpers for serialisable state.
 */

import {
  DEFAULT_POOL,
  canPlace,
  canPlaceAny,
  createSolvabilityCache,
  fitsAnywhereSet,
  getShape,
  isHandSolvable,
  normaliseWeights,
  placeUnchecked,
  sampleShape,
  shuffleInPlace,
  type Board,
  type GameState,
  type Generator,
  type Hand,
  type Rng,
  type ShapeId,
  type SolvabilityCache,
  type Weights,
} from '@blockblast/engine';

/** A normalised marginal over shape ids with an O(n) sampler. Immutable. */
export class Sampler {
  readonly ids: readonly ShapeId[];
  readonly probs: readonly number[];
  /** Unnormalised weights (positive entries only). */
  readonly weights: Weights;

  constructor(weights: Weights) {
    const { ids, probs } = normaliseWeights(weights);
    this.ids = ids;
    this.probs = probs;
    const kept = new Map<ShapeId, number>();
    for (const id of ids) kept.set(id, weights.get(id) as number);
    this.weights = kept;
  }

  /** Uniform over a pool. */
  static uniform(pool: readonly ShapeId[]): Sampler {
    if (pool.length === 0) throw new Error('pool must not be empty');
    const w = new Map<ShapeId, number>();
    for (const id of pool) w.set(id, 1);
    return new Sampler(w);
  }

  sample(rng: Rng): ShapeId {
    return sampleShape(this.ids, this.probs, rng);
  }

  /** Three i.i.d. draws. */
  hand(rng: Rng): Hand {
    return [this.sample(rng), this.sample(rng), this.sample(rng)];
  }

  /** A new sampler with each weight multiplied by `factor(id)` (non-positive results drop the id). */
  scaled(factor: (id: ShapeId) => number): Sampler {
    const w = new Map<ShapeId, number>();
    for (const [id, weight] of this.weights) w.set(id, weight * factor(id));
    return new Sampler(w);
  }

  /** Weights as a JSON-able object. */
  toJSON(): Record<string, number> {
    return Object.fromEntries(this.weights);
  }
}

/**
 * The marginal a wrapper should treat as its base's: the base's own `weights` when it exposes a
 * `ReadonlyMap` (the engine's `UniformGenerator`, `WeightedGenerator`), else uniform over
 * `base.pool`, else uniform over `DEFAULT_POOL`.
 */
export function baseWeights(base: Generator): Weights {
  const maybe = (base as { weights?: unknown }).weights;
  if (maybe instanceof Map) return maybe as Weights;
  const pool = base.pool ?? DEFAULT_POOL;
  const w = new Map<ShapeId, number>();
  for (const id of pool) w.set(id, 1);
  return w;
}

/** The base's pool, falling back to the engine default. */
export function basePool(base: Generator): readonly ShapeId[] {
  return base.pool ?? DEFAULT_POOL;
}

/**
 * When a score-dependent generator switches on. A bare number is an absolute score. Relative
 * forms use the pre-game personal best in `GameState.personalBest`; on a fresh install that is 0,
 * so `fractionOfBest` is met from the first deal (which is what the live session showed).
 */
export type ScoreThreshold =
  | number
  | { readonly absolute: number }
  | { readonly fractionOfBest: number }
  | { readonly offsetFromBest: number };

/** True when the pre-deal state is at or past the threshold. */
export function isPastThreshold(state: GameState, threshold: ScoreThreshold): boolean {
  if (typeof threshold === 'number') return state.score >= threshold;
  if ('absolute' in threshold) return state.score >= threshold.absolute;
  if ('fractionOfBest' in threshold) return state.score >= threshold.fractionOfBest * state.personalBest;
  return state.score >= state.personalBest + threshold.offsetFromBest;
}

/** JSON-able form of a threshold. */
export function thresholdToJSON(threshold: ScoreThreshold): unknown {
  return typeof threshold === 'number' ? { absolute: threshold } : threshold;
}

/** Shuffle the slot order of a hand (so a constructed placement order leaks nothing into slots). */
export function shuffleHand(hand: Hand, rng: Rng): Hand {
  const ids = shuffleInPlace([hand[0], hand[1], hand[2]], rng);
  return [ids[0] as ShapeId, ids[1] as ShapeId, ids[2] as ShapeId];
}

/** Options for {@link findSolvableHand}. */
export interface SolvableSearchOptions {
  /**
   * Weight multiplier for pieces that fit the board at deal time (≥ 1). 1 means no bias: the
   * guarantee alone. Non-fitting pieces keep their weight; they can still fit after a clear.
   */
  readonly fitBias?: number;
  /** Rejection-sampling attempts before the constructive fallback. Default 200. */
  readonly maxAttempts?: number;
  /** Node budget of the constructive depth-first fallback. Default 20,000. */
  readonly maxNodes?: number;
  readonly memo?: SolvabilityCache;
}

/** Result of {@link findSolvableHand}. */
export interface SolvableSearchResult {
  /** A solvable hand, or null when none was found (nothing fits, or the budget ran out). */
  readonly hand: Hand | null;
  /** Rejection-sampling attempts used (0 when nothing fits at all). */
  readonly attempts: number;
  /** True when the hand came from the constructive fallback rather than sampling. */
  readonly constructed: boolean;
}

const DEFAULT_MAX_ATTEMPTS = 200;
const DEFAULT_MAX_NODES = 20_000;

/**
 * Find a hand that the oracle says is fully placeable in some order.
 *
 * 1. Rejection sampling: draw i.i.d. hands from `sampler` (pieces that fit now up-weighted by
 *    `fitBias`) until `isHandSolvable`.
 * 2. Constructive fallback: depth-first over (fitting piece, legal placement, clears) for three
 *    levels in shuffled order; complete when the node budget is not hit. The resulting triple
 *    has its slot order shuffled so the placement order does not leak into the slots.
 *
 * Returns `hand: null` only when no pool piece fits at all or the budget is exhausted.
 */
export function findSolvableHand(board: Board, sampler: Sampler, rng: Rng, opts: SolvableSearchOptions = {}): SolvableSearchResult {
  const fits = fitsAnywhereSet(board, sampler.ids);
  if (fits.size === 0) return { hand: null, attempts: 0, constructed: false };
  const memo = opts.memo ?? createSolvabilityCache();
  const fitBias = opts.fitBias ?? 1;
  if (!(fitBias >= 1) || !Number.isFinite(fitBias)) throw new RangeError('fitBias must be a finite number >= 1');
  const biased = fitBias === 1 ? sampler : sampler.scaled((id) => (fits.has(id) ? fitBias : 1));
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const hand = biased.hand(rng);
    if (isHandSolvable(board, hand, memo)) return { hand, attempts, constructed: false };
  }

  const built = constructSolvableHand(board, sampler.ids, rng, opts.maxNodes ?? DEFAULT_MAX_NODES);
  return { hand: built === null ? null : shuffleHand(built, rng), attempts, constructed: built !== null };
}

/**
 * Depth-first construction of a solvable triple: pick a fitting piece, place it (clears applied),
 * repeat twice more. Candidate pieces and placements are visited in shuffled order.
 */
export function constructSolvableHand(board: Board, pool: readonly ShapeId[], rng: Rng, maxNodes: number): Hand | null {
  let nodes = 0;
  const chosen: ShapeId[] = [];

  function dfs(b: Board, depth: number): boolean {
    const candidates = shuffleInPlace(pool.filter((id) => canPlaceAny(b, id)), rng);
    if (depth === 2) {
      const last = candidates[0];
      if (last === undefined) return false;
      chosen.push(last);
      return true;
    }
    for (const id of candidates) {
      const placements = shuffleInPlace(getShape(id).placements.filter((p) => canPlace(b, p)), rng);
      for (const p of placements) {
        if (++nodes > maxNodes) return false;
        chosen.push(id);
        if (dfs(placeUnchecked(b, p).board, depth + 1)) return true;
        chosen.pop();
        if (nodes > maxNodes) return false;
      }
    }
    return false;
  }

  if (!dfs(board, 0)) return null;
  return [chosen[0] as ShapeId, chosen[1] as ShapeId, chosen[2] as ShapeId];
}

/** Smallest pool piece (by cell count, then id) that fits the board, or undefined. */
export function smallestFittingPiece(board: Board, pool: readonly ShapeId[]): ShapeId | undefined {
  let best: ShapeId | undefined;
  let bestSize = Infinity;
  for (const id of pool) {
    const size = getShape(id).size;
    if ((size < bestSize || (size === bestSize && best !== undefined && id < best)) && canPlaceAny(board, id)) {
      best = id;
      bestSize = size;
    }
  }
  return best;
}

/** Hard-piece ids present in a pool, given a hard set. */
export function hardIn(pool: readonly ShapeId[], hard: ReadonlySet<ShapeId>): ShapeId[] {
  return pool.filter((id) => hard.has(id));
}

/** Multiply the weights of `hard` ids by `factor`. */
export function biasHard(weights: Weights, hard: ReadonlySet<ShapeId>, factor: number): Weights {
  const out = new Map<ShapeId, number>();
  for (const [id, w] of weights) out.set(id, hard.has(id) ? w * factor : w);
  return out;
}

/** A fresh `[a, b, c]` tuple from any three ids. */
export function tuple(a: ShapeId, b: ShapeId, c: ShapeId): Hand {
  return [a, b, c];
}
