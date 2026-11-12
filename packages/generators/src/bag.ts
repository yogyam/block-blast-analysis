/**
 * Bag dealer (Tetris "7-bag" style): shuffle the pool, deal its ids sequentially, reshuffle when
 * exhausted. Hands may span two bags. Board-independent, so a negative control for H1–H4, but
 * pieces within and across hands are dependent (no repeats inside a bag), so a positive control
 * for H5 (within-hand dependence, lag-k serial correlation).
 */

import { DEFAULT_POOL, shuffleInPlace, type GameState, type Generator, type Hand, type Rng, type ShapeId } from '@blockblast/engine';

export class BagGenerator implements Generator {
  readonly name = 'bag';
  readonly pool: readonly ShapeId[];
  private bag: ShapeId[] = [];
  private pos = 0;
  private bagsDealt = 0;

  constructor(pool: readonly ShapeId[] = DEFAULT_POOL) {
    if (pool.length === 0) throw new Error('pool must not be empty');
    this.pool = [...pool];
  }

  next(_state: GameState, rng: Rng): Hand {
    return [this.draw(rng), this.draw(rng), this.draw(rng)];
  }

  private draw(rng: Rng): ShapeId {
    if (this.pos >= this.bag.length) {
      this.bag = shuffleInPlace([...this.pool], rng);
      this.pos = 0;
      this.bagsDealt++;
    }
    return this.bag[this.pos++] as ShapeId;
  }

  reset(): void {
    this.bag = [];
    this.pos = 0;
    this.bagsDealt = 0;
  }

  serializeState(): unknown {
    return { name: this.name, bag: [...this.bag], pos: this.pos, bagsDealt: this.bagsDealt };
  }
}
