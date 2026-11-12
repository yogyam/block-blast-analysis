/**
 * Rejection-sampling wrappers that forbid certain deaths. Both are board-aware (positive controls
 * for H1 and, through "fits"/"solvable" indicators, H2 with Z > 0; `GuaranteeSolvable` also makes
 * the H4 hazard Λ exceed 1), while leaving the within-hand structure of the base alone.
 */

import {
  canPlaceAny,
  createSolvabilityCache,
  isHandSolvable,
  type GameState,
  type Generator,
  type Hand,
  type Rng,
  type ShapeId,
} from '@blockblast/engine';
import { basePool, constructSolvableHand, shuffleHand, smallestFittingPiece } from './common.ts';

/** Options for {@link GuaranteeOneFitsGenerator}. */
export interface GuaranteeOneFitsOptions {
  /** Hands drawn from the base before falling back; default 50. */
  readonly maxAttempts?: number;
}

/**
 * Redraw from `base` until at least one piece of the hand fits somewhere on the board. After
 * `maxAttempts` failures, one random slot of the last hand is replaced by the smallest pool piece
 * that fits; if nothing in the pool fits, the last hand is dealt as is (the game is over anyway).
 */
export class GuaranteeOneFitsGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[];
  private readonly base: Generator;
  private readonly maxAttempts: number;
  private deals = 0;
  private lastAttempts = 0;
  private totalAttempts = 0;
  private fallbacks = 0;

  constructor(base: Generator, opts: GuaranteeOneFitsOptions = {}) {
    this.base = base;
    this.pool = basePool(base);
    this.maxAttempts = opts.maxAttempts ?? 50;
    if (!(this.maxAttempts >= 1)) throw new RangeError('maxAttempts must be >= 1');
    this.name = `guarantee-one-fits(${base.name})`;
  }

  next(state: GameState, rng: Rng): Hand {
    const { board } = state;
    let hand: Hand = this.base.next(state, rng);
    let attempts = 1;
    while (!hand.some((id) => canPlaceAny(board, id)) && attempts < this.maxAttempts) {
      hand = this.base.next(state, rng);
      attempts++;
    }
    this.deals++;
    this.lastAttempts = attempts;
    this.totalAttempts += attempts;
    if (hand.some((id) => canPlaceAny(board, id))) return hand;
    const small = smallestFittingPiece(board, this.pool);
    if (small === undefined) return hand; // nothing fits: terminal position whatever we deal
    this.fallbacks++;
    const slot = rng.nextInt(3);
    const ids: ShapeId[] = [hand[0], hand[1], hand[2]];
    ids[slot] = small;
    return [ids[0] as ShapeId, ids[1] as ShapeId, ids[2] as ShapeId];
  }

  reset(): void {
    this.base.reset();
    this.deals = 0;
    this.lastAttempts = 0;
    this.totalAttempts = 0;
    this.fallbacks = 0;
  }

  serializeState(): unknown {
    return {
      name: this.name,
      maxAttempts: this.maxAttempts,
      deals: this.deals,
      lastAttempts: this.lastAttempts,
      totalAttempts: this.totalAttempts,
      fallbacks: this.fallbacks,
      base: this.base.serializeState(),
    };
  }
}

/** Options for {@link GuaranteeSolvableGenerator}. */
export interface GuaranteeSolvableOptions {
  /** Hands drawn from the base before the constructive fallback; default 200. */
  readonly maxAttempts?: number;
  /** Node budget of the constructive fallback; default 20,000. */
  readonly maxNodes?: number;
}

/**
 * Redraw from `base` until the oracle says the hand is fully placeable in some order. After
 * `maxAttempts` failures a solvable hand is constructed directly from the base's pool (slot order
 * shuffled); only when no solvable hand exists at all is the last unsolvable draw dealt.
 * `serializeState()` records how many attempts the last deal needed.
 */
export class GuaranteeSolvableGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[];
  private readonly base: Generator;
  private readonly maxAttempts: number;
  private readonly maxNodes: number;
  private deals = 0;
  private lastAttempts = 0;
  private totalAttempts = 0;
  private maxAttemptsSeen = 0;
  private constructed = 0;
  private unsolvable = 0;

  constructor(base: Generator, opts: GuaranteeSolvableOptions = {}) {
    this.base = base;
    this.pool = basePool(base);
    this.maxAttempts = opts.maxAttempts ?? 200;
    this.maxNodes = opts.maxNodes ?? 20_000;
    if (!(this.maxAttempts >= 1)) throw new RangeError('maxAttempts must be >= 1');
    this.name = `guarantee-solvable(${base.name})`;
  }

  next(state: GameState, rng: Rng): Hand {
    const { board } = state;
    const memo = createSolvabilityCache();
    let hand: Hand = this.base.next(state, rng);
    let attempts = 1;
    while (!isHandSolvable(board, hand, memo) && attempts < this.maxAttempts) {
      hand = this.base.next(state, rng);
      attempts++;
    }
    this.deals++;
    this.lastAttempts = attempts;
    this.totalAttempts += attempts;
    this.maxAttemptsSeen = Math.max(this.maxAttemptsSeen, attempts);
    if (isHandSolvable(board, hand, memo)) return hand;
    const built = constructSolvableHand(board, this.pool, rng, this.maxNodes);
    if (built !== null) {
      this.constructed++;
      return shuffleHand(built, rng);
    }
    this.unsolvable++;
    return hand;
  }

  reset(): void {
    this.base.reset();
    this.deals = 0;
    this.lastAttempts = 0;
    this.totalAttempts = 0;
    this.maxAttemptsSeen = 0;
    this.constructed = 0;
    this.unsolvable = 0;
  }

  serializeState(): unknown {
    return {
      name: this.name,
      maxAttempts: this.maxAttempts,
      deals: this.deals,
      lastAttempts: this.lastAttempts,
      totalAttempts: this.totalAttempts,
      maxAttemptsSeen: this.maxAttemptsSeen,
      constructed: this.constructed,
      unsolvable: this.unsolvable,
      base: this.base.serializeState(),
    };
  }
}
