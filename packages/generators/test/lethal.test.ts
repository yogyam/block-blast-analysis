import { describe, expect, it } from 'vitest';
import { DEFAULT_POOL, EMPTY_BOARD, TEN_TEN_POOL, UniformGenerator, seedRng, solvabilityDetail } from '@blockblast/engine';
import { LethalGenerator, findLethalHand, hasLethalSignature } from '../src/lethal.ts';
import { LETHAL_BOARD, preDealState, randomBoards } from './helpers.ts';

describe('findLethalHand', () => {
  it('finds the two-fit-one-not hand on the lethal checkerboard and nothing on the empty board', () => {
    const r = findLethalHand(LETHAL_BOARD, TEN_TEN_POOL, seedRng(1));
    expect(r.hand).not.toBeNull();
    expect(r.placeable).toBe(4); // 1x1, both dominoes and the small L (##/#.) fit the top-left gap
    expect(hasLethalSignature(LETHAL_BOARD, r.hand!)).toBe(true);
    for (const id of r.hand!.slice(0, 2)) expect([1, 2, 3, 6]).toContain(id);
    expect([1, 2, 3, 6]).not.toContain(r.hand![2]);
    expect(findLethalHand(EMPTY_BOARD, TEN_TEN_POOL, seedRng(1))).toMatchObject({ hand: null, unplaceable: 0 });
  });

  it('every hand it returns on 300 random boards carries the signature', () => {
    let found = 0;
    const rng = seedRng(2);
    for (const b of randomBoards(seedRng(3), 300, 0.3, 0.7)) {
      const r = findLethalHand(b, DEFAULT_POOL, rng);
      if (r.hand === null) continue;
      found++;
      const d = solvabilityDetail(b, r.hand);
      expect(d.fitsCount).toBe(2);
      expect(d.fitsIndividually[2]).toBe(false); // the game's [a, b, u] order
      expect(d.solvable).toBe(false);
      expect(d.looksPlayableButLethal).toBe(true);
    }
    console.log(`[lethal] ${found}/300 random boards had a lethal hand`);
    expect(found).toBeGreaterThan(50);
  });

  it('respects the triple budget', () => {
    const b = randomBoards(seedRng(4), 1, 0.5, 0.5)[0]!;
    const r = findLethalHand(b, DEFAULT_POOL, seedRng(1), { maxTriples: 1 });
    expect(r.triplesTested).toBeLessThanOrEqual(1);
    if (r.hand === null) expect(r.exhausted).toBe(true);
  });
});

describe('LethalGenerator', () => {
  it('deals the signature when it finds one and falls back to the base otherwise', () => {
    const gen = new LethalGenerator(new UniformGenerator(DEFAULT_POOL), { probability: 1 });
    const rng = seedRng(5);
    gen.reset();
    let dealtLethal = 0;
    let fallbacks = 0;
    for (const b of randomBoards(seedRng(6), 300, 0, 0.7)) {
      const before = gen.serializeState() as { found: number; fallbacks: number };
      const hand = gen.next(preDealState(b), rng);
      const after = gen.serializeState() as { found: number; fallbacks: number; lastSearch: { found: boolean } | null };
      if (after.found > before.found) {
        dealtLethal++;
        expect(hasLethalSignature(b, hand)).toBe(true);
        expect(after.lastSearch?.found).toBe(true);
      } else {
        fallbacks++;
        expect(after.fallbacks).toBe(before.fallbacks + 1);
        for (const id of hand) expect(DEFAULT_POOL).toContain(id);
      }
    }
    expect(dealtLethal).toBeGreaterThan(30);
    expect(fallbacks).toBeGreaterThan(30);
    expect(gen.serializeState()).toMatchObject({ deals: 300, requested: 300, found: dealtLethal, fallbacks });
  });

  it('honours probability, score threshold and slot shuffling', () => {
    const never = new LethalGenerator(new UniformGenerator(TEN_TEN_POOL), { probability: 0 });
    never.next(preDealState(LETHAL_BOARD), seedRng(1));
    expect(never.serializeState()).toMatchObject({ requested: 0, fallbacks: 1 });

    const gated = new LethalGenerator(new UniformGenerator(TEN_TEN_POOL), { probability: 1, scoreThreshold: { fractionOfBest: 0.9 } });
    gated.next(preDealState(LETHAL_BOARD, { score: 800, personalBest: 1000 }), seedRng(1));
    expect(gated.serializeState()).toMatchObject({ requested: 0 });
    gated.next(preDealState(LETHAL_BOARD, { score: 950, personalBest: 1000 }), seedRng(1));
    expect(gated.serializeState()).toMatchObject({ requested: 1, found: 1 });

    const shuffled = new LethalGenerator(new UniformGenerator(TEN_TEN_POOL), { probability: 1, shuffleSlots: true });
    const rng = seedRng(9);
    let unplaceableNotLast = 0;
    for (let i = 0; i < 40; i++) {
      const h = shuffled.next(preDealState(LETHAL_BOARD), rng);
      expect(hasLethalSignature(LETHAL_BOARD, h)).toBe(true);
      if (solvabilityDetail(LETHAL_BOARD, h).fitsIndividually[2]) unplaceableNotLast++;
    }
    expect(unplaceableNotLast).toBeGreaterThan(5);
  });
});
