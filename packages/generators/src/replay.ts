/**
 * Replay: deal a logged sequence of hands verbatim. Lets the simulator re-run a captured game
 * (or feed a detector a scripted sequence) through the engine. Ignores the board and the RNG.
 */

import { isShapeId, type GameState, type Generator, type Hand, type Rng, type ShapeId } from '@blockblast/engine';

/** Options for {@link ReplayGenerator}. */
export interface ReplayOptions {
  /** Start over when the sequence is exhausted instead of throwing; default false. */
  readonly loop?: boolean;
}

export class ReplayGenerator implements Generator {
  readonly name = 'replay';
  readonly pool: readonly ShapeId[];
  readonly hands: readonly Hand[];
  private readonly loop: boolean;
  private index = 0;
  private loops = 0;

  constructor(hands: ReadonlyArray<readonly [ShapeId, ShapeId, ShapeId]>, opts: ReplayOptions = {}) {
    if (hands.length === 0) throw new Error('replay needs at least one hand');
    this.hands = hands.map((h, i) => {
      if (h.length !== 3 || !h.every((id) => Number.isInteger(id) && isShapeId(id))) {
        throw new Error(`hand ${i} is not a triple of shape ids: ${JSON.stringify(h)}`);
      }
      return [h[0], h[1], h[2]] as Hand;
    });
    this.loop = opts.loop ?? false;
    this.pool = [...new Set(this.hands.flat())].sort((a, b) => a - b);
  }

  next(_state: GameState, _rng: Rng): Hand {
    if (this.index >= this.hands.length) {
      if (!this.loop) throw new Error(`replay exhausted after ${this.hands.length} hands`);
      this.index = 0;
      this.loops++;
    }
    const h = this.hands[this.index++] as Hand;
    return [h[0], h[1], h[2]];
  }

  reset(): void {
    this.index = 0;
    this.loops = 0;
  }

  serializeState(): unknown {
    return { name: this.name, index: this.index, loops: this.loops, total: this.hands.length, loop: this.loop };
  }
}
