import { describe, expect, it } from 'vitest';
import { DEFAULT_POOL, EMPTY_BOARD, FULL_BOARD, TEN_TEN_POOL, UniformGenerator, getShape, seedRng, type Hand } from '@blockblast/engine';
import { BagGenerator } from '../src/bag.ts';
import { Sampler, findSolvableHand, isPastThreshold } from '../src/common.ts';
import { MixtureGenerator } from '../src/mixture.ts';
import { PerGameDifficultyGenerator } from '../src/perGame.ts';
import { GAME_HARD_PIECE_SET, LIVE_EARLY_POOL, LIVE_POOL, resolvePool, scoreTier } from '../src/pools.ts';
import { ReplayGenerator } from '../src/replay.ts';
import { SlotBiasedGenerator } from '../src/slotBiased.ts';
import { WeightedGenerator } from '../src/uniform.ts';
import { preDealState, randomBoards } from './helpers.ts';

const S0 = preDealState(EMPTY_BOARD);

describe('WeightedGenerator', () => {
  it('draws with the given marginal and exposes the positively weighted pool', () => {
    const gen = new WeightedGenerator(new Map([[1, 1], [9, 3], [13, 0]]));
    expect(gen.pool).toEqual([1, 9]);
    const rng = seedRng(1);
    let nines = 0;
    const n = 10_000;
    for (let i = 0; i < n; i++) for (const id of gen.next(S0, rng)) if (id === 9) nines++;
    expect(nines / (3 * n)).toBeGreaterThan(0.73);
    expect(nines / (3 * n)).toBeLessThan(0.77);
  });
});

describe('BagGenerator', () => {
  it('deals every pool id exactly once per bag, hands spanning bags', () => {
    const gen = new BagGenerator(TEN_TEN_POOL);
    const rng = seedRng(2);
    gen.reset();
    const ids: number[] = [];
    for (let i = 0; i < 38; i++) ids.push(...gen.next(S0, rng)); // 114 ids = 6 bags of 19
    const sortedPool = [...TEN_TEN_POOL].sort((a, b) => a - b);
    for (let b = 0; b < 6; b++) {
      expect(ids.slice(b * 19, (b + 1) * 19).sort((a, c) => a - c)).toEqual(sortedPool);
    }
    const state = gen.serializeState() as { bagsDealt: number; pos: number };
    expect(state.bagsDealt).toBe(6);
    expect(state.pos).toBe(19);
  });

  it('reset restarts the bag', () => {
    const gen = new BagGenerator([1, 2, 3]);
    const first = gen.next(S0, seedRng(9));
    gen.reset();
    expect(gen.next(S0, seedRng(9))).toEqual(first);
  });
});

describe('ReplayGenerator', () => {
  const hands: Array<readonly [number, number, number]> = [[1, 2, 3], [4, 5, 6], [9, 9, 9]];
  it('reproduces its input, throws when exhausted, loops when asked', () => {
    const gen = new ReplayGenerator(hands);
    const rng = seedRng(1);
    expect([gen.next(S0, rng), gen.next(S0, rng), gen.next(S0, rng)]).toEqual(hands);
    expect(() => gen.next(S0, rng)).toThrow(/exhausted/);
    gen.reset();
    expect(gen.next(S0, rng)).toEqual([1, 2, 3]);
    const looped = new ReplayGenerator(hands, { loop: true });
    for (let i = 0; i < 7; i++) looped.next(S0, rng);
    expect(looped.next(S0, rng)).toEqual([4, 5, 6]);
    expect(looped.serializeState()).toMatchObject({ loops: 2, index: 2, total: 3 });
    expect(gen.pool).toEqual([1, 2, 3, 4, 5, 6, 9]);
  });
  it('rejects malformed hands', () => {
    expect(() => new ReplayGenerator([[1, 2] as unknown as [number, number, number]])).toThrow(/triple/);
    expect(() => new ReplayGenerator([[1, 2, 99]])).toThrow(/triple/);
    expect(() => new ReplayGenerator([])).toThrow();
  });
});

describe('SlotBiasedGenerator', () => {
  it('puts the smallest piece in the left slot', () => {
    const gen = new SlotBiasedGenerator(new UniformGenerator(DEFAULT_POOL));
    const rng = seedRng(3);
    for (let i = 0; i < 500; i++) {
      const h = gen.next(S0, rng);
      const sizes = h.map((id) => getShape(id).size);
      expect(sizes[0]).toBeLessThanOrEqual(sizes[1] as number);
      expect(sizes[1]).toBeLessThanOrEqual(sizes[2] as number);
    }
    expect(gen.serializeState()).toMatchObject({ deals: 500, sorted: 500 });
  });
  it('sorts only a fraction of hands at partial strength', () => {
    const gen = new SlotBiasedGenerator(new UniformGenerator(DEFAULT_POOL), { strength: 0.3 });
    const rng = seedRng(4);
    for (let i = 0; i < 2000; i++) gen.next(S0, rng);
    const { sorted } = gen.serializeState() as { sorted: number };
    expect(sorted / 2000).toBeGreaterThan(0.25);
    expect(sorted / 2000).toBeLessThan(0.35);
  });
});

describe('MixtureGenerator', () => {
  it('chooses components by weight, resets them, and unions their pools', () => {
    const a = new BagGenerator([1, 2, 3]);
    const b = new UniformGenerator([9, 13]);
    const gen = new MixtureGenerator([{ generator: a, weight: 1 }, { generator: b, weight: 3 }]);
    expect(gen.pool).toEqual([1, 2, 3, 9, 13]);
    const rng = seedRng(5);
    for (let i = 0; i < 4000; i++) gen.next(S0, rng);
    const { counts } = gen.serializeState() as { counts: number[] };
    expect((counts[1] as number) / 4000).toBeGreaterThan(0.72);
    expect((counts[1] as number) / 4000).toBeLessThan(0.78);
    gen.reset();
    expect((a.serializeState() as { bagsDealt: number }).bagsDealt).toBe(0);
    expect((gen.serializeState() as { counts: number[] }).counts).toEqual([0, 0]);
  });
});

describe('PerGameDifficultyGenerator', () => {
  it('fixes one hard multiplier per game and it moves the hard share', () => {
    const gen = new PerGameDifficultyGenerator(new UniformGenerator(TEN_TEN_POOL), { levels: [1, 10] });
    const rng = seedRng(6);
    const share = new Map<number, { hard: number; total: number }>();
    for (let game = 0; game < 200; game++) {
      gen.reset();
      expect(gen.currentMultiplier).toBeNull();
      let multiplier: number | null = null;
      for (let t = 0; t < 10; t++) {
        const h = gen.next(S0, rng);
        multiplier ??= gen.currentMultiplier;
        expect(gen.currentMultiplier).toBe(multiplier); // never changes within a game
        const s = share.get(multiplier as number) ?? { hard: 0, total: 0 };
        for (const id of h) {
          s.total++;
          if (GAME_HARD_PIECE_SET.has(id)) s.hard++;
        }
        share.set(multiplier as number, s);
      }
    }
    expect([...share.keys()].sort()).toEqual([1, 10]);
    const low = share.get(1) as { hard: number; total: number };
    const high = share.get(10) as { hard: number; total: number };
    expect(low.hard / low.total).toBeGreaterThan(0.4); // 10 of 19 pool ids are on the game's list
    expect(low.hard / low.total).toBeLessThan(0.65);
    expect(high.hard / high.total).toBeGreaterThan(low.hard / low.total + 0.25);
  });
});

describe('helpers and constants', () => {
  it('scoreTier follows the game tier table', () => {
    expect(scoreTier(0)).toBe(0);
    expect(scoreTier(299)).toBe(0);
    expect(scoreTier(300)).toBe(1);
    expect(scoreTier(999)).toBe(3);
    expect(scoreTier(8400)).toBe(16);
    expect(scoreTier(1e6)).toBe(16);
  });
  it('live pools match the observed filter', () => {
    expect(LIVE_POOL).toHaveLength(30);
    expect(LIVE_EARLY_POOL).toHaveLength(23);
    for (const id of [11, 12, 13, 21, 22, 23, 24]) expect(LIVE_EARLY_POOL).not.toContain(id);
    expect(resolvePool('ten-ten')).toBe(TEN_TEN_POOL);
    expect(() => resolvePool('nope')).toThrow(/unknown pool/);
  });
  it('isPastThreshold supports absolute and relative forms', () => {
    const s = preDealState(EMPTY_BOARD, { score: 930, personalBest: 1000 });
    expect(isPastThreshold(s, 930)).toBe(true);
    expect(isPastThreshold(s, 931)).toBe(false);
    expect(isPastThreshold(s, { absolute: 900 })).toBe(true);
    expect(isPastThreshold(s, { fractionOfBest: 0.93 })).toBe(true);
    expect(isPastThreshold(s, { fractionOfBest: 0.94 })).toBe(false);
    expect(isPastThreshold(s, { offsetFromBest: -70 })).toBe(true);
    expect(isPastThreshold(s, { offsetFromBest: 1000 })).toBe(false);
  });
  it('Sampler.scaled re-weights and findSolvableHand handles the edge boards', () => {
    const s = Sampler.uniform([1, 9]).scaled((id) => (id === 9 ? 0 : 1));
    expect(s.ids).toEqual([1]);
    expect(findSolvableHand(FULL_BOARD, Sampler.uniform(TEN_TEN_POOL), seedRng(1)).hand).toBeNull();
    const r = findSolvableHand(EMPTY_BOARD, Sampler.uniform(TEN_TEN_POOL), seedRng(1), { fitBias: 4 });
    expect(r.attempts).toBe(1);
    expect(r.constructed).toBe(false);
    expect((r.hand as Hand).length).toBe(3);
    // A board where almost nothing fits forces the constructive fallback.
    const tight = randomBoards(seedRng(77), 1, 0.8, 0.8)[0];
    const sampler = Sampler.uniform(DEFAULT_POOL);
    const rr = findSolvableHand(tight as typeof EMPTY_BOARD, sampler, seedRng(2), { maxAttempts: 1 });
    expect(rr.attempts).toBeLessThanOrEqual(1);
  });
});
