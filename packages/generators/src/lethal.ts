/**
 * Lethal(π): with probability π (optionally only past a score threshold), search the pool for a
 * hand with exactly two individually placeable pieces and one unplaceable piece such that no
 * ordering places all three, and deal it; otherwise deal from the base. Positive control for H4
 * (Z < 0 on the "unsolvable" indicator, Λ < 1) and the "looks playable but lethal" signature.
 *
 * The search mirrors the game's `func_death_blcok` (`docs/findings/whitebox.md` §4d): shuffle the
 * pool, split placeable from unplaceable, iterate over (placeable a, placeable b, unplaceable u)
 * and return `[a, b, u]` for the first triple the oracle rejects. The game bounds the search by
 * time (100 ms); here the default bound is an attempt count so runs are reproducible, and a time
 * budget is opt-in.
 */

import {
  canPlaceAny,
  createSolvabilityCache,
  shuffleInPlace,
  solvabilityDetail,
  type Board,
  type GameState,
  type Generator,
  type Hand,
  type Rng,
  type ShapeId,
  type SolvabilityCache,
} from '@blockblast/engine';
import { basePool, isPastThreshold, shuffleHand, thresholdToJSON, type ScoreThreshold } from './common.ts';

/** Options for {@link findLethalHand}. */
export interface LethalSearchOptions {
  /** Maximum (a, b, u) triples tested; default 2,000. */
  readonly maxTriples?: number;
  /** Optional wall-clock budget in ms (breaks reproducibility; off by default). */
  readonly timeBudgetMs?: number;
  readonly memo?: SolvabilityCache;
}

/** Outcome of one lethal search. */
export interface LethalSearchResult {
  /** `[a, b, u]` in the game's order, or null when no such hand was found. */
  readonly hand: Hand | null;
  readonly triplesTested: number;
  /** Pool pieces that fit the board individually. */
  readonly placeable: number;
  /** Pool pieces that do not fit the board individually. */
  readonly unplaceable: number;
  /** True when the triple budget ran out before the search space did. */
  readonly exhausted: boolean;
  readonly timedOut: boolean;
}

/** The two-fit-one-not death signature: exactly two pieces fit individually and no order places all three. */
export function hasLethalSignature(board: Board, hand: Hand, memo?: SolvabilityCache): boolean {
  const d = solvabilityDetail(board, hand, memo ?? createSolvabilityCache());
  return d.fitsCount === 2 && !d.solvable;
}

/**
 * Search `pool` for a lethal `[a, b, u]` on `board` (see the module doc). Consumes `rng` for the
 * shuffle only; the result is a pure function of (board, pool, shuffle).
 */
export function findLethalHand(board: Board, pool: readonly ShapeId[], rng: Rng, opts: LethalSearchOptions = {}): LethalSearchResult {
  const shuffled = shuffleInPlace([...pool], rng);
  const placeable: ShapeId[] = [];
  const unplaceable: ShapeId[] = [];
  for (const id of shuffled) (canPlaceAny(board, id) ? placeable : unplaceable).push(id);
  const none = { hand: null, triplesTested: 0, placeable: placeable.length, unplaceable: unplaceable.length, exhausted: false, timedOut: false };
  if (placeable.length < 2 || unplaceable.length === 0) return none;

  const maxTriples = opts.maxTriples ?? 2000;
  const budget = opts.timeBudgetMs;
  const start = budget === undefined ? 0 : Date.now();
  const memo = opts.memo ?? createSolvabilityCache();
  let tested = 0;
  for (let i = 0; i < placeable.length; i++) {
    const a = placeable[i] as ShapeId;
    for (let j = i + 1; j < placeable.length; j++) {
      const b = placeable[j] as ShapeId;
      for (const u of unplaceable) {
        tested++;
        const hand: Hand = [a, b, u];
        const d = solvabilityDetail(board, hand, memo);
        if (d.fitsCount === 2 && !d.solvable) {
          return { hand, triplesTested: tested, placeable: placeable.length, unplaceable: unplaceable.length, exhausted: false, timedOut: false };
        }
        if (tested >= maxTriples) return { ...none, triplesTested: tested, exhausted: true };
        if (budget !== undefined && Date.now() - start >= budget) return { ...none, triplesTested: tested, timedOut: true };
      }
    }
  }
  return { ...none, triplesTested: tested };
}

/** Options for {@link LethalGenerator}. */
export interface LethalOptions {
  /** Probability of running the lethal search on an eligible deal (0–1). */
  readonly probability: number;
  /** Only search at or past this score; default: always eligible. */
  readonly scoreThreshold?: ScoreThreshold;
  /** Pool the search draws from; default the base's pool. The game uses ids 2–42 (`LETHAL_SEARCH_POOL`). */
  readonly pool?: readonly ShapeId[];
  /** Maximum triples tested per search; default 2,000. */
  readonly maxTriples?: number;
  /** Optional wall-clock budget per search in ms (non-deterministic; off by default). */
  readonly timeBudgetMs?: number;
  /** Shuffle the slot order of a found hand instead of the game's `[a, b, u]`; default false. */
  readonly shuffleSlots?: boolean;
}

export class LethalGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[];
  readonly searchPool: readonly ShapeId[];
  private readonly base: Generator;
  private readonly opts: LethalOptions;
  private deals = 0;
  private requested = 0;
  private found = 0;
  private fallbacks = 0;
  private last: unknown = null;

  constructor(base: Generator, opts: LethalOptions) {
    if (!(opts.probability >= 0 && opts.probability <= 1)) throw new RangeError('probability must be in [0, 1]');
    this.base = base;
    this.opts = opts;
    this.searchPool = opts.pool ?? basePool(base);
    this.pool = [...new Set([...basePool(base), ...this.searchPool])];
    this.name = `lethal(${base.name})`;
  }

  next(state: GameState, rng: Rng): Hand {
    this.deals++;
    const eligible = this.opts.scoreThreshold === undefined || isPastThreshold(state, this.opts.scoreThreshold);
    if (eligible && rng.next() < this.opts.probability) {
      this.requested++;
      const searchOpts: LethalSearchOptions = {
        ...(this.opts.maxTriples === undefined ? {} : { maxTriples: this.opts.maxTriples }),
        ...(this.opts.timeBudgetMs === undefined ? {} : { timeBudgetMs: this.opts.timeBudgetMs }),
      };
      const r = findLethalHand(state.board, this.searchPool, rng, searchOpts);
      this.last = { triplesTested: r.triplesTested, placeable: r.placeable, unplaceable: r.unplaceable, found: r.hand !== null, exhausted: r.exhausted, timedOut: r.timedOut };
      if (r.hand !== null) {
        this.found++;
        return this.opts.shuffleSlots === true ? shuffleHand(r.hand, rng) : r.hand;
      }
    } else {
      this.last = null;
    }
    this.fallbacks++;
    return this.base.next(state, rng);
  }

  reset(): void {
    this.base.reset();
    this.deals = 0;
    this.requested = 0;
    this.found = 0;
    this.fallbacks = 0;
    this.last = null;
  }

  serializeState(): unknown {
    return {
      name: this.name,
      probability: this.opts.probability,
      scoreThreshold: this.opts.scoreThreshold === undefined ? null : thresholdToJSON(this.opts.scoreThreshold),
      searchPool: this.searchPool,
      maxTriples: this.opts.maxTriples ?? 2000,
      shuffleSlots: this.opts.shuffleSlots === true,
      deals: this.deals,
      requested: this.requested,
      found: this.found,
      fallbacks: this.fallbacks,
      lastSearch: this.last,
      base: this.base.serializeState(),
    };
  }
}
