/**
 * The null generator: three independent draws from a fixed marginal F over a pool
 * (`06-methods.md` §1, H0). With no weights the marginal is uniform. This is the only
 * generator inside the engine; the zoo (bag, rescue, kill, lethal, ...) lives in
 * `@blockblast/generators`.
 */

import { normaliseWeights, sampleShape, uniformWeights, type Weights } from '../nullprobs.ts';
import type { Rng } from '../rng.ts';
import { DEFAULT_POOL, type ShapeId } from '../shapes.ts';
import type { GameState, Generator, Hand } from '../types.ts';

/** I.i.d. dealer over a pool, uniform or weighted. Stateless; `reset()` is a no-op. */
export class UniformGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[];
  readonly weights: Weights;
  private readonly ids: readonly ShapeId[];
  private readonly probs: readonly number[];

  /**
   * @param pool shapes that can be dealt (default {@link DEFAULT_POOL})
   * @param weights optional unnormalised marginal; shapes missing from it get weight 0
   */
  constructor(pool: readonly ShapeId[] = DEFAULT_POOL, weights?: Weights) {
    if (pool.length === 0) throw new Error('pool must not be empty');
    const w = weights ?? uniformWeights(pool);
    const restricted = new Map<ShapeId, number>();
    for (const id of pool) restricted.set(id, w.get(id) ?? 0);
    const { ids, probs } = normaliseWeights(restricted);
    this.pool = [...pool];
    this.weights = restricted;
    this.ids = ids;
    this.probs = probs;
    this.name = weights === undefined ? 'uniform' : 'weighted';
  }

  next(_state: GameState, rng: Rng): Hand {
    return [sampleShape(this.ids, this.probs, rng), sampleShape(this.ids, this.probs, rng), sampleShape(this.ids, this.probs, rng)];
  }

  reset(): void {
    // stateless
  }

  serializeState(): unknown {
    return { name: this.name, pool: this.pool, weights: Object.fromEntries(this.weights) };
  }
}
