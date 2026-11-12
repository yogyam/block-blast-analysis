/**
 * PerGameDifficulty: once per game, pick a multiplier for the hard pieces' weights from `levels`,
 * then deal i.i.d. from the base's marginal so re-weighted. Invisible to per-turn tests (each game
 * is a fixed i.i.d. dealer), visible to the H6 companion (Dirichlet-multinomial overdispersion of
 * per-game piece frequencies). `reset()` carries no RNG, so the draw happens on the first deal
 * after a reset, from the game's own RNG stream.
 */

import { type GameState, type Generator, type Hand, type Rng, type ShapeId } from '@blockblast/engine';
import { Sampler, basePool, baseWeights, biasHard, hardIn } from './common.ts';
import { GAME_HARD_PIECE_IDS } from './pools.ts';

/** A difficulty level: multiplier on hard-piece weights, with an optional selection weight. */
export interface DifficultyLevel {
  readonly multiplier: number;
  /** Relative probability of choosing this level; default 1. */
  readonly weight?: number;
}

/** Options for {@link PerGameDifficultyGenerator}. */
export interface PerGameDifficultyOptions {
  /** Candidate hard-piece multipliers, bare numbers (equiprobable) or weighted levels. */
  readonly levels: ReadonlyArray<number | DifficultyLevel>;
  /** Which ids count as hard; default {@link GAME_HARD_PIECE_IDS}. */
  readonly hardIds?: readonly ShapeId[];
}

export class PerGameDifficultyGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[];
  readonly levels: readonly Required<DifficultyLevel>[];
  readonly hardIds: readonly ShapeId[];
  private readonly base: Generator;
  private readonly samplers: readonly Sampler[];
  private readonly cumulative: readonly number[];
  private levelIndex: number | null = null;
  private gamesStarted = 0;

  constructor(base: Generator, opts: PerGameDifficultyOptions) {
    if (opts.levels.length === 0) throw new Error('levels must not be empty');
    this.base = base;
    this.pool = basePool(base);
    const hard = new Set(opts.hardIds ?? GAME_HARD_PIECE_IDS);
    this.hardIds = hardIn(this.pool, hard);
    this.levels = opts.levels.map((l) => (typeof l === 'number' ? { multiplier: l, weight: 1 } : { multiplier: l.multiplier, weight: l.weight ?? 1 }));
    for (const l of this.levels) {
      if (!(l.multiplier > 0) || !Number.isFinite(l.multiplier)) throw new RangeError('level multipliers must be positive and finite');
      if (!(l.weight > 0) || !Number.isFinite(l.weight)) throw new RangeError('level weights must be positive and finite');
    }
    const weights = baseWeights(base);
    this.samplers = this.levels.map((l) => new Sampler(biasHard(weights, hard, l.multiplier)));
    const total = this.levels.reduce((s, l) => s + l.weight, 0);
    let acc = 0;
    this.cumulative = this.levels.map((l) => (acc += l.weight / total));
    this.name = `per-game-difficulty(${base.name})`;
  }

  /** The multiplier in force for the current game, or null before the first deal. */
  get currentMultiplier(): number | null {
    return this.levelIndex === null ? null : (this.levels[this.levelIndex] as Required<DifficultyLevel>).multiplier;
  }

  next(_state: GameState, rng: Rng): Hand {
    if (this.levelIndex === null) {
      const u = rng.next();
      let idx = this.cumulative.findIndex((c) => u < c);
      if (idx < 0) idx = this.cumulative.length - 1;
      this.levelIndex = idx;
      this.gamesStarted++;
    }
    return (this.samplers[this.levelIndex] as Sampler).hand(rng);
  }

  reset(): void {
    this.base.reset();
    this.levelIndex = null;
  }

  serializeState(): unknown {
    return {
      name: this.name,
      levels: this.levels,
      hardIds: this.hardIds,
      levelIndex: this.levelIndex,
      multiplier: this.currentMultiplier,
      gamesStarted: this.gamesStarted,
      base: this.base.serializeState(),
    };
  }
}
