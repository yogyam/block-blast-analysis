/**
 * Rescue(θ): on boards at or above fill θ, with probability `strength`, replace the base's hand
 * with a solvable one whose pieces are biased toward those that fit. Positive control for H2
 * (Z > 0 on "fits" and "solvable" in the near-full stratum) and H4 (Λ > 1); must not light H3.
 */

import { fillFraction, type GameState, type Generator, type Hand, type Rng, type ShapeId } from '@blockblast/engine';
import { Sampler, basePool, baseWeights, findSolvableHand } from './common.ts';

/** Options for {@link RescueGenerator}. */
export interface RescueOptions {
  /** Board fill fraction (filled cells / 64) at or above which rescue may happen. */
  readonly fillThreshold: number;
  /** Probability of replacing the hand when above the threshold (0–1). */
  readonly strength: number;
  /** Weight multiplier for pieces that fit the board now; default 8. */
  readonly fitBias?: number;
  /** Rejection-sampling attempts for the replacement hand; default 200. */
  readonly maxAttempts?: number;
  /** Node budget of the constructive fallback; default 20,000. */
  readonly maxNodes?: number;
}

export class RescueGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[];
  private readonly base: Generator;
  private readonly sampler: Sampler;
  private readonly opts: Required<RescueOptions>;
  private deals = 0;
  private eligible = 0;
  private rescued = 0;
  private lastAttempts = 0;
  private constructed = 0;

  constructor(base: Generator, opts: RescueOptions) {
    if (!(opts.fillThreshold >= 0 && opts.fillThreshold <= 1)) throw new RangeError('fillThreshold must be in [0, 1]');
    if (!(opts.strength >= 0 && opts.strength <= 1)) throw new RangeError('strength must be in [0, 1]');
    this.base = base;
    this.pool = basePool(base);
    this.sampler = new Sampler(baseWeights(base));
    this.opts = {
      fillThreshold: opts.fillThreshold,
      strength: opts.strength,
      fitBias: opts.fitBias ?? 8,
      maxAttempts: opts.maxAttempts ?? 200,
      maxNodes: opts.maxNodes ?? 20_000,
    };
    this.name = `rescue(${base.name})`;
  }

  next(state: GameState, rng: Rng): Hand {
    this.deals++;
    const hand = this.base.next(state, rng);
    if (fillFraction(state.board) < this.opts.fillThreshold) return hand;
    this.eligible++;
    if (rng.next() >= this.opts.strength) return hand;
    const found = findSolvableHand(state.board, this.sampler, rng, {
      fitBias: this.opts.fitBias,
      maxAttempts: this.opts.maxAttempts,
      maxNodes: this.opts.maxNodes,
    });
    if (found.hand === null) return hand; // no solvable hand exists: nothing to rescue with
    this.rescued++;
    this.lastAttempts = found.attempts;
    if (found.constructed) this.constructed++;
    return found.hand;
  }

  reset(): void {
    this.base.reset();
    this.deals = 0;
    this.eligible = 0;
    this.rescued = 0;
    this.lastAttempts = 0;
    this.constructed = 0;
  }

  serializeState(): unknown {
    return {
      name: this.name,
      ...this.opts,
      deals: this.deals,
      eligible: this.eligible,
      rescued: this.rescued,
      lastAttempts: this.lastAttempts,
      constructed: this.constructed,
      base: this.base.serializeState(),
    };
  }
}
