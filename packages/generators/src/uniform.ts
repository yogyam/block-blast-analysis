/**
 * The null dealers. `UniformGenerator` is the engine's own (re-exported so the zoo is complete);
 * `WeightedGenerator` is the same i.i.d. draw with a fixed non-uniform marginal, the negative
 * control for H1–H4 in `06-methods.md` §7 (board-independent, so no adaptivity test may fire).
 */

import { UniformGenerator, type ShapeId, type Weights } from '@blockblast/engine';

export { UniformGenerator };

/** I.i.d. dealer with a fixed, non-uniform marginal; the pool is the set of positively weighted ids. */
export class WeightedGenerator extends UniformGenerator {
  constructor(weights: Weights) {
    const pool: ShapeId[] = [];
    for (const [id, w] of weights) if (w > 0 && Number.isFinite(w)) pool.push(id);
    if (pool.length === 0) throw new Error('weights must contain at least one positive entry');
    super(pool, weights);
  }
}
