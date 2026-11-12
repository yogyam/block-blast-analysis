import { describe, expect, it } from 'vitest';
import { DEFAULT_POOL, EMPTY_BOARD, TEN_TEN_POOL, UniformGenerator, canPlaceAny, fitsAnywhereSet, isHandSolvable, pHandSolvable, seedRng, uniformWeights } from '@blockblast/engine';
import { GuaranteeOneFitsGenerator, GuaranteeSolvableGenerator } from '../src/guarantee.ts';
import { preDealState, randomBoards } from './helpers.ts';

describe('GuaranteeSolvableGenerator', () => {
  it('never returns an unsolvable hand on 500 random boards when a solvable one exists', () => {
    const gen = new GuaranteeSolvableGenerator(new UniformGenerator(DEFAULT_POOL));
    const rng = seedRng(11);
    const boards = randomBoards(seedRng(12), 500, 0.3, 0.8);
    let unsolvable = 0;
    let constructed = 0;
    gen.reset();
    for (const b of boards) {
      const before = (gen.serializeState() as { constructed: number }).constructed;
      const hand = gen.next(preDealState(b), rng);
      const state = gen.serializeState() as { lastAttempts: number; constructed: number };
      expect(state.lastAttempts).toBeGreaterThanOrEqual(1);
      if (state.constructed > before) constructed++;
      if (isHandSolvable(b, hand)) continue;
      unsolvable++;
      // Only acceptable when no hand from the pool is solvable at all (exact enumeration).
      const p = pHandSolvable(b, uniformWeights(DEFAULT_POOL), { exactThreshold: 64 });
      expect(p.exact).toBe(true);
      expect(p.p).toBe(0);
    }
    console.log(`[guarantee-solvable] 500 boards: ${unsolvable} with no solvable hand in the pool, ${constructed} constructed`);
  });

  it('constructs a solvable hand when rejection sampling is capped at one attempt', () => {
    const gen = new GuaranteeSolvableGenerator(new UniformGenerator(DEFAULT_POOL), { maxAttempts: 1 });
    const rng = seedRng(13);
    gen.reset();
    for (const b of randomBoards(seedRng(14), 200, 0.55, 0.8)) {
      const hand = gen.next(preDealState(b), rng);
      if (isHandSolvable(b, hand)) continue;
      expect(pHandSolvable(b, uniformWeights(DEFAULT_POOL), { exactThreshold: 64 }).p).toBe(0);
    }
    const state = gen.serializeState() as { constructed: number; maxAttemptsSeen: number };
    console.log(`[guarantee-solvable maxAttempts=1] ${state.constructed} of 200 hands constructed`);
    expect(state.maxAttemptsSeen).toBe(1);
    expect(state.constructed).toBeGreaterThan(20);
  });

  it('passes the base hand through untouched when it is already solvable', () => {
    const gen = new GuaranteeSolvableGenerator(new UniformGenerator(TEN_TEN_POOL));
    const plain = new UniformGenerator(TEN_TEN_POOL);
    const s = preDealState(EMPTY_BOARD);
    const a = seedRng(3);
    const b = seedRng(3);
    for (let i = 0; i < 50; i++) expect(gen.next(s, a)).toEqual(plain.next(s, b));
    expect(gen.serializeState()).toMatchObject({ deals: 50, totalAttempts: 50, maxAttemptsSeen: 1, constructed: 0, unsolvable: 0 });
  });
});

describe('GuaranteeOneFitsGenerator', () => {
  it('always deals a hand with a fitting piece when the pool has one', () => {
    const gen = new GuaranteeOneFitsGenerator(new UniformGenerator(TEN_TEN_POOL), { maxAttempts: 5 });
    const rng = seedRng(21);
    gen.reset();
    let fallbacks = 0;
    for (const b of randomBoards(seedRng(22), 500, 0.4, 0.95)) {
      const hand = gen.next(preDealState(b), rng);
      const fits = fitsAnywhereSet(b, TEN_TEN_POOL);
      if (fits.size === 0) continue;
      expect(hand.some((id) => canPlaceAny(b, id))).toBe(true);
      fallbacks = (gen.serializeState() as { fallbacks: number }).fallbacks;
    }
    expect(fallbacks).toBeGreaterThan(0); // the small-piece substitution was exercised
  });
});
