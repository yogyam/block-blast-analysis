/**
 * SlotBiased: deal from the base, then (with probability `strength`) sort the hand so the left
 * slot holds the smallest piece. Changes nothing about which pieces are dealt, only their order:
 * a positive control for the slot-position test in H5 and a negative control for everything else.
 */

import { getShape, type GameState, type Generator, type Hand, type Rng, type ShapeId } from '@blockblast/engine';

/** Options for {@link SlotBiasedGenerator}. */
export interface SlotBiasedOptions {
  /** Probability that a hand is sorted (0–1); default 1. */
  readonly strength?: number;
}

/** Sort key: cell count, then id. */
export function sizeOrder(a: ShapeId, b: ShapeId): number {
  return getShape(a).size - getShape(b).size || a - b;
}

export class SlotBiasedGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[] | undefined;
  private readonly base: Generator;
  private readonly strength: number;
  private deals = 0;
  private sorted = 0;

  constructor(base: Generator, opts: SlotBiasedOptions = {}) {
    this.strength = opts.strength ?? 1;
    if (!(this.strength >= 0 && this.strength <= 1)) throw new RangeError('strength must be in [0, 1]');
    this.base = base;
    this.pool = base.pool;
    this.name = `slot-biased(${base.name})`;
  }

  next(state: GameState, rng: Rng): Hand {
    this.deals++;
    const hand = this.base.next(state, rng);
    if (rng.next() >= this.strength) return hand;
    this.sorted++;
    const ids = [hand[0], hand[1], hand[2]].sort(sizeOrder);
    return [ids[0] as ShapeId, ids[1] as ShapeId, ids[2] as ShapeId];
  }

  reset(): void {
    this.base.reset();
    this.deals = 0;
    this.sorted = 0;
  }

  serializeState(): unknown {
    return { name: this.name, strength: this.strength, deals: this.deals, sorted: this.sorted, base: this.base.serializeState() };
  }
}
