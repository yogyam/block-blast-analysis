/**
 * The fair dealer's per-board probabilities (`06-methods.md` §4) under a fixed marginal F,
 * cached by board. Every test that needs p_t = P_H0(indicator | board) goes through one
 * {@link NullModel} so the (expensive) solvability probability is computed once per distinct
 * board. Sparse boards, where the hazard is ~0, still cost one (cheap, small-sample) estimate;
 * near-full boards, where |S(B)| is small, are exact.
 */

import {
  boardKey,
  createSolvabilityCache,
  normaliseWeights,
  pHandSolvable,
  pHardPiece,
  pSomeFits,
  seedRng,
  type Board,
  type Rng,
  type SolvabilityCache,
  type ShapeId,
  type Weights,
} from '@blockblast/engine';

/** Tuning for the solvability probability. */
export interface NullModelOptions {
  /** RNG for the Monte Carlo branch (sparse boards). Default: a fixed seed, for reproducibility. */
  readonly rng?: Rng;
  /** Enumerate exactly when |S(B)| ≤ this; default 13. */
  readonly exactThreshold?: number;
  /** Monte Carlo sample size on sparse boards; default 8000 (the hazard there is ~0, so this is ample). */
  readonly samples?: number;
}

/** A hazard estimate with its provenance. */
export interface Hazard {
  /** h = 1 − P_H0(hand fully placeable | board). */
  readonly h: number;
  readonly exact: boolean;
  /** Standard error of h (Monte Carlo branch only). */
  readonly se?: number;
}

/** Cached fair-dealer probabilities under one marginal F. */
export class NullModel {
  readonly weights: Weights;
  /** Normalised F as parallel arrays (ids with positive weight). */
  readonly ids: readonly ShapeId[];
  readonly probs: readonly number[];
  private readonly memo: SolvabilityCache = createSolvabilityCache();
  private readonly rng: Rng;
  private readonly exactThreshold: number;
  private readonly samples: number;
  private readonly someFitsCache = new Map<string, number>();
  private readonly hazardCache = new Map<string, Hazard>();
  private readonly hardP: number;

  constructor(weights: Weights, opts: NullModelOptions = {}) {
    const norm = normaliseWeights(weights);
    this.weights = weights;
    this.ids = norm.ids;
    this.probs = norm.probs;
    this.rng = opts.rng ?? seedRng('nullmodel');
    this.exactThreshold = opts.exactThreshold ?? 13;
    this.samples = opts.samples ?? 8000;
    this.hardP = pHardPiece(weights);
  }

  /** P_H0(at least one piece of a random hand fits | board). */
  pSomeFits(b: Board): number {
    const key = boardKey(b);
    let v = this.someFitsCache.get(key);
    if (v === undefined) {
      v = pSomeFits(b, this.weights);
      this.someFitsCache.set(key, v);
    }
    return v;
  }

  /** P_H0(a random hand contains ≥1 hard piece). Board-independent. */
  pHard(): number {
    return this.hardP;
  }

  /** The fair dealer's per-turn hazard h = 1 − P_H0(hand fully placeable | board). */
  hazard(b: Board): Hazard {
    const key = boardKey(b);
    let v = this.hazardCache.get(key);
    if (v === undefined) {
      const q = pHandSolvable(b, this.weights, {
        exactThreshold: this.exactThreshold,
        samples: this.samples,
        rng: this.rng,
        memo: this.memo,
      });
      v = q.se === undefined ? { h: 1 - q.p, exact: q.exact } : { h: 1 - q.p, exact: q.exact, se: q.se };
      this.hazardCache.set(key, v);
    }
    return v;
  }
}
