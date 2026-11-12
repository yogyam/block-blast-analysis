/**
 * Kill(θ): past a score threshold (absolute, or relative to the pre-game personal best), deal
 * i.i.d. from the base's marginal with the hard pieces' odds multiplied by `hardBias`. Still
 * board-independent, so a positive control for H3 (hard-piece odds ratio in the near-record
 * stratum) and, indirectly, H4 (Z < 0), but not for board features in H1.
 */

import { type GameState, type Generator, type Hand, type Rng, type ShapeId } from '@blockblast/engine';
import { Sampler, basePool, baseWeights, biasHard, hardIn, isPastThreshold, thresholdToJSON, type ScoreThreshold } from './common.ts';
import { GAME_HARD_PIECE_IDS } from './pools.ts';

/** Options for {@link KillGenerator}. */
export interface KillOptions {
  /** When the hard bias switches on (see {@link ScoreThreshold}). */
  readonly scoreThreshold: ScoreThreshold;
  /** Multiplier applied to the weight of each hard piece once past the threshold (> 0). */
  readonly hardBias: number;
  /** Which ids count as hard; default the game's own 18-id list {@link GAME_HARD_PIECE_IDS}. */
  readonly hardIds?: readonly ShapeId[];
}

export class KillGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[];
  readonly hardIds: readonly ShapeId[];
  private readonly base: Generator;
  private readonly sampler: Sampler;
  private readonly threshold: ScoreThreshold;
  private readonly hardBias: number;
  private deals = 0;
  private killDeals = 0;

  constructor(base: Generator, opts: KillOptions) {
    if (!(opts.hardBias > 0) || !Number.isFinite(opts.hardBias)) throw new RangeError('hardBias must be a positive finite number');
    this.base = base;
    this.pool = basePool(base);
    this.threshold = opts.scoreThreshold;
    this.hardBias = opts.hardBias;
    const hard = new Set(opts.hardIds ?? GAME_HARD_PIECE_IDS);
    this.hardIds = hardIn(this.pool, hard);
    this.sampler = new Sampler(biasHard(baseWeights(base), hard, opts.hardBias));
    this.name = `kill(${base.name})`;
  }

  next(state: GameState, rng: Rng): Hand {
    this.deals++;
    if (!isPastThreshold(state, this.threshold)) return this.base.next(state, rng);
    this.killDeals++;
    return this.sampler.hand(rng);
  }

  reset(): void {
    this.base.reset();
    this.deals = 0;
    this.killDeals = 0;
  }

  serializeState(): unknown {
    return {
      name: this.name,
      scoreThreshold: thresholdToJSON(this.threshold),
      hardBias: this.hardBias,
      hardIds: this.hardIds,
      deals: this.deals,
      killDeals: this.killDeals,
      base: this.base.serializeState(),
    };
  }
}
