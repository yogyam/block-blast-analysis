/**
 * BlockBlastLike: a documented APPROXIMATION of the live dealer's observed behaviour.
 *
 * THIS IS A MODEL, NOT THE GAME'S CODE. It reproduces the regimes seen in one install's logs
 * (`docs/findings/whitebox.md` §4c–4e, `docs/findings/phase2-log.md`) with cheap stand-ins for
 * the native strategies, so the detector can be validated against something shaped like the real
 * dealer. The game's own strategies (gap-fill, entropy-increase, multi-clear, "extremely difficult
 * problem", ...) are not reimplemented; their one shared property that matters to the detector,
 * "always return a fully placeable hand", is.
 *
 * Observed behaviour mirrored, with the default of each knob:
 *
 * - Early game (score below `earlyUntil`, default 600): deal from the live pool (ids 2–31) with
 *   the hard shapes filtered out (`filterIds`: 11, 12, 13, 21–24, 39–41), always fully placeable,
 *   biased toward pieces that fit the board (`fitBias`, a stand-in for the gap-fill / entropy
 *   strategies; the bias strength itself was not observed).
 * - Middle (between `earlyUntil` and `lethalFrom`, default 800): the filter is removed; hands are
 *   still guaranteed placeable (observed: 14020 multi-clear with the filter removed).
 * - Late (score at or past `lethalFrom`): with probability `lethalProbability` (default 1.0: the
 *   script requested algorithm 24001 on every deal from score 814 on) run the game's lethal search
 *   over `lethalPool` (ids 2–42). If it finds a hand, deal it with probability `dealLethal`
 *   (default 0: in the observed session the lethal hands were computed but never dealt) and
 *   otherwise deal a hard-but-solvable hand (unfiltered pool, hard pieces up-weighted by
 *   `hardBias`, placeability guaranteed; the observed stand-in for 16016 / 16010 / 16014). If no
 *   lethal hand exists, deal from the unfiltered pool with the placeability guarantee.
 *
 * Score thresholds are absolute by default, as the game's own tier table is; relative forms are
 * accepted (see `ScoreThreshold`). The JavaScript-side quirks (triples of one piece when the
 * native side returns nothing, single-piece substitutions) are not modelled.
 */

import { type GameState, type Generator, type Hand, type Rng, type ShapeId } from '@blockblast/engine';
import { Sampler, biasHard, findSolvableHand, isPastThreshold, shuffleHand, thresholdToJSON, type ScoreThreshold } from './common.ts';
import { findLethalHand } from './lethal.ts';
import { EARLY_FILTER_IDS, GAME_HARD_PIECE_IDS, LETHAL_SEARCH_POOL, LIVE_POOL } from './pools.ts';

/** Knobs of {@link BlockBlastLikeGenerator}; every default is the observed value where one exists. */
export interface BlockBlastLikeOptions {
  /** Unfiltered dealing pool; default {@link LIVE_POOL} (ids 2–31). */
  readonly pool?: readonly ShapeId[];
  /** Ids removed from the pool in the early game; default {@link EARLY_FILTER_IDS}. */
  readonly filterIds?: readonly ShapeId[];
  /** Pool the lethal search draws from; default {@link LETHAL_SEARCH_POOL} (ids 2–42 minus 41). */
  readonly lethalPool?: readonly ShapeId[];
  /** End of the filtered early game; default 600 (observed: filter removed from 609–635 on). */
  readonly earlyUntil?: ScoreThreshold;
  /** From here the lethal search is requested; default 800 (observed: once at 635, every deal from 814). */
  readonly lethalFrom?: ScoreThreshold;
  /** Probability of requesting the lethal search on a late-game deal; default 1.0 (observed). */
  readonly lethalProbability?: number;
  /** Probability of dealing a found lethal hand; default 0 (observed: found, never dealt). */
  readonly dealLethal?: number;
  /** Which ids count as hard for the hard-but-solvable hand; default {@link GAME_HARD_PIECE_IDS}. */
  readonly hardIds?: readonly ShapeId[];
  /** Weight multiplier on hard pieces for the hard-but-solvable hand; default 3 (not observed). */
  readonly hardBias?: number;
  /** Early-game weight multiplier on pieces that fit the board; default 4 (not observed). */
  readonly fitBias?: number;
  /** Rejection-sampling attempts per placeability guarantee; default 200. */
  readonly maxAttempts?: number;
  /** Node budget of the constructive fallback; default 20,000. */
  readonly maxNodes?: number;
  /** Triples tested per lethal search; default 2,000 (the game uses a 100 ms budget instead). */
  readonly lethalMaxTriples?: number;
  /** Shuffle a dealt lethal hand's slots instead of the game's `[a, b, u]`; default false. */
  readonly shuffleLethalSlots?: boolean;
}

/** Which part of the model produced a deal. */
export type BlockBlastLikeRegime = 'early' | 'mid' | 'late';

/** How the hand of a late-game deal was produced. */
export type LateDealKind = 'lethal' | 'hard-solvable' | 'plain-solvable';

const DEFAULTS = {
  earlyUntil: 600 as ScoreThreshold,
  lethalFrom: 800 as ScoreThreshold,
  lethalProbability: 1,
  dealLethal: 0,
  hardBias: 3,
  fitBias: 4,
  maxAttempts: 200,
  maxNodes: 20_000,
  lethalMaxTriples: 2000,
  shuffleLethalSlots: false,
};

export class BlockBlastLikeGenerator implements Generator {
  readonly name = 'blockblast-like';
  /** Every id this generator can deal (the unfiltered pool, plus the lethal pool when `dealLethal > 0`). */
  readonly pool: readonly ShapeId[];
  readonly fullPool: readonly ShapeId[];
  readonly earlyPool: readonly ShapeId[];
  readonly lethalPool: readonly ShapeId[];
  readonly hardIds: readonly ShapeId[];
  readonly options: Readonly<Required<Omit<BlockBlastLikeOptions, 'pool' | 'filterIds' | 'lethalPool' | 'hardIds'>>>;
  private readonly earlySampler: Sampler;
  private readonly fullSampler: Sampler;
  private readonly hardSampler: Sampler;
  private deals = 0;
  private regimeCounts = { early: 0, mid: 0, late: 0 };
  private lethal = { requested: 0, found: 0, dealt: 0, withheld: 0 };
  private lastRegime: BlockBlastLikeRegime | null = null;
  private lastKind: string | null = null;
  private lastAttempts = 0;
  private lastSearch: unknown = null;
  private constructed = 0;
  private noSolvable = 0;

  constructor(opts: BlockBlastLikeOptions = {}) {
    this.fullPool = [...(opts.pool ?? LIVE_POOL)];
    const filter = new Set(opts.filterIds ?? EARLY_FILTER_IDS);
    this.earlyPool = this.fullPool.filter((id) => !filter.has(id));
    if (this.earlyPool.length === 0) throw new Error('the filter removes the whole pool');
    this.lethalPool = [...(opts.lethalPool ?? LETHAL_SEARCH_POOL)];
    const hard = new Set(opts.hardIds ?? GAME_HARD_PIECE_IDS);
    this.hardIds = this.fullPool.filter((id) => hard.has(id));
    this.options = {
      earlyUntil: opts.earlyUntil ?? DEFAULTS.earlyUntil,
      lethalFrom: opts.lethalFrom ?? DEFAULTS.lethalFrom,
      lethalProbability: opts.lethalProbability ?? DEFAULTS.lethalProbability,
      dealLethal: opts.dealLethal ?? DEFAULTS.dealLethal,
      hardBias: opts.hardBias ?? DEFAULTS.hardBias,
      fitBias: opts.fitBias ?? DEFAULTS.fitBias,
      maxAttempts: opts.maxAttempts ?? DEFAULTS.maxAttempts,
      maxNodes: opts.maxNodes ?? DEFAULTS.maxNodes,
      lethalMaxTriples: opts.lethalMaxTriples ?? DEFAULTS.lethalMaxTriples,
      shuffleLethalSlots: opts.shuffleLethalSlots ?? DEFAULTS.shuffleLethalSlots,
    };
    const o = this.options;
    if (!(o.lethalProbability >= 0 && o.lethalProbability <= 1)) throw new RangeError('lethalProbability must be in [0, 1]');
    if (!(o.dealLethal >= 0 && o.dealLethal <= 1)) throw new RangeError('dealLethal must be in [0, 1]');
    if (!(o.hardBias > 0) || !Number.isFinite(o.hardBias)) throw new RangeError('hardBias must be positive and finite');
    if (!(o.fitBias >= 1) || !Number.isFinite(o.fitBias)) throw new RangeError('fitBias must be a finite number >= 1');
    this.earlySampler = Sampler.uniform(this.earlyPool);
    this.fullSampler = Sampler.uniform(this.fullPool);
    this.hardSampler = new Sampler(biasHard(this.fullSampler.weights, hard, o.hardBias));
    this.pool = o.dealLethal > 0 ? [...new Set([...this.fullPool, ...this.lethalPool])] : this.fullPool;
  }

  /** Which regime a pre-deal state falls in. */
  regimeAt(state: GameState): BlockBlastLikeRegime {
    if (isPastThreshold(state, this.options.lethalFrom)) return 'late';
    if (isPastThreshold(state, this.options.earlyUntil)) return 'mid';
    return 'early';
  }

  /** The pool the placeability guarantee draws from in a regime. */
  poolFor(regime: BlockBlastLikeRegime): readonly ShapeId[] {
    return regime === 'early' ? this.earlyPool : this.fullPool;
  }

  next(state: GameState, rng: Rng): Hand {
    this.deals++;
    const regime = this.regimeAt(state);
    this.regimeCounts[regime]++;
    this.lastRegime = regime;
    this.lastSearch = null;
    if (regime === 'early') return this.dealSolvable(state, this.earlySampler, rng, this.options.fitBias, 'fit-biased-solvable');
    if (regime === 'mid') return this.dealSolvable(state, this.fullSampler, rng, 1, 'plain-solvable');

    if (rng.next() < this.options.lethalProbability) {
      this.lethal.requested++;
      const r = findLethalHand(state.board, this.lethalPool, rng, { maxTriples: this.options.lethalMaxTriples });
      this.lastSearch = { triplesTested: r.triplesTested, placeable: r.placeable, unplaceable: r.unplaceable, found: r.hand !== null, exhausted: r.exhausted };
      if (r.hand !== null) {
        this.lethal.found++;
        if (rng.next() < this.options.dealLethal) {
          this.lethal.dealt++;
          this.lastKind = 'lethal';
          this.lastAttempts = 0;
          return this.options.shuffleLethalSlots ? shuffleHand(r.hand, rng) : r.hand;
        }
        this.lethal.withheld++;
        return this.dealSolvable(state, this.hardSampler, rng, 1, 'hard-solvable');
      }
    }
    return this.dealSolvable(state, this.fullSampler, rng, 1, 'plain-solvable');
  }

  private dealSolvable(state: GameState, sampler: Sampler, rng: Rng, fitBias: number, kind: string): Hand {
    const found = findSolvableHand(state.board, sampler, rng, { fitBias, maxAttempts: this.options.maxAttempts, maxNodes: this.options.maxNodes });
    this.lastKind = kind;
    this.lastAttempts = found.attempts;
    if (found.hand !== null) {
      if (found.constructed) this.constructed++;
      return found.hand;
    }
    // No fully placeable hand exists in this pool: the game ends whatever is dealt.
    this.noSolvable++;
    this.lastKind = `${kind}:none`;
    return sampler.hand(rng);
  }

  reset(): void {
    this.deals = 0;
    this.regimeCounts = { early: 0, mid: 0, late: 0 };
    this.lethal = { requested: 0, found: 0, dealt: 0, withheld: 0 };
    this.lastRegime = null;
    this.lastKind = null;
    this.lastAttempts = 0;
    this.lastSearch = null;
    this.constructed = 0;
    this.noSolvable = 0;
  }

  serializeState(): unknown {
    const o = this.options;
    return {
      name: this.name,
      options: { ...o, earlyUntil: thresholdToJSON(o.earlyUntil), lethalFrom: thresholdToJSON(o.lethalFrom) },
      deals: this.deals,
      regimes: { ...this.regimeCounts },
      lethal: { ...this.lethal },
      lastRegime: this.lastRegime,
      lastKind: this.lastKind,
      lastAttempts: this.lastAttempts,
      lastSearch: this.lastSearch,
      constructed: this.constructed,
      noSolvable: this.noSolvable,
    };
  }
}
