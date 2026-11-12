/**
 * Mixture: per hand, pick one component generator with probability proportional to its weight and
 * deal from it. Lets the validation protocol combine mechanisms at weak and strong settings.
 */

import { type GameState, type Generator, type Hand, type Rng, type ShapeId } from '@blockblast/engine';

/** One component of a {@link MixtureGenerator}. */
export interface MixtureComponent {
  readonly generator: Generator;
  /** Relative probability of choosing this component per hand (> 0). */
  readonly weight: number;
}

export class MixtureGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[] | undefined;
  readonly components: readonly MixtureComponent[];
  private readonly cumulative: readonly number[];
  private counts: number[];
  private lastIndex: number | null = null;

  constructor(components: readonly MixtureComponent[]) {
    if (components.length === 0) throw new Error('mixture needs at least one component');
    for (const c of components) {
      if (!(c.weight > 0) || !Number.isFinite(c.weight)) throw new RangeError('component weights must be positive and finite');
    }
    this.components = [...components];
    const total = components.reduce((s, c) => s + c.weight, 0);
    let acc = 0;
    this.cumulative = components.map((c) => (acc += c.weight / total));
    this.counts = components.map(() => 0);
    const pools = components.map((c) => c.generator.pool);
    this.pool = pools.every((p) => p !== undefined) ? [...new Set(pools.flatMap((p) => [...(p as readonly ShapeId[])]))] : undefined;
    this.name = `mixture(${components.map((c) => c.generator.name).join('+')})`;
  }

  next(state: GameState, rng: Rng): Hand {
    const u = rng.next();
    let idx = this.cumulative.findIndex((c) => u < c);
    if (idx < 0) idx = this.cumulative.length - 1;
    this.lastIndex = idx;
    (this.counts[idx] as number)++;
    return (this.components[idx] as MixtureComponent).generator.next(state, rng);
  }

  reset(): void {
    for (const c of this.components) c.generator.reset();
    this.counts = this.components.map(() => 0);
    this.lastIndex = null;
  }

  serializeState(): unknown {
    return {
      name: this.name,
      weights: this.components.map((c) => c.weight),
      counts: [...this.counts],
      lastIndex: this.lastIndex,
      components: this.components.map((c) => c.generator.serializeState()),
    };
  }
}
