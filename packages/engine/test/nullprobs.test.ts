import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, FULL_BOARD, fillCount, setCell } from '../src/board.ts';
import { normaliseWeights, pHandSolvable, pHardPiece, pSomeFits, uniformWeights, weightOf } from '../src/nullprobs.ts';
import { seedRng } from '../src/rng.ts';
import { DEFAULT_POOL, HARD_SHAPE_IDS, TEN_TEN_POOL, type ShapeId } from '../src/shapes.ts';
import { fitsAnywhereSet, isHandSolvable } from '../src/solvability.ts';
import { CHECKERBOARD, LETHAL_BOARD, randomBoard } from './helpers.ts';

describe('exact indicator probabilities', () => {
  it('pSomeFits = 1 − (1 − W(S))³', () => {
    const w = uniformWeights(TEN_TEN_POOL);
    expect(pSomeFits(EMPTY_BOARD, w)).toBeCloseTo(1, 12);
    expect(pSomeFits(FULL_BOARD, w)).toBe(0);
    // Checkerboard: only the 1x1 fits out of 19.
    expect(pSomeFits(CHECKERBOARD, w)).toBeCloseTo(1 - (18 / 19) ** 3, 12);
    // Default pool: 1x1 and the four diagonals fit out of 50.
    const fits = fitsAnywhereSet(CHECKERBOARD, DEFAULT_POOL);
    expect(fits.size).toBe(5);
    expect(pSomeFits(CHECKERBOARD, uniformWeights(DEFAULT_POOL))).toBeCloseTo(1 - (45 / 50) ** 3, 12);
  });

  it('respects non-uniform weights and ignores zero weights', () => {
    const w = new Map<ShapeId, number>([
      [1, 3],
      [13, 1],
      [9, 0],
    ]);
    expect(normaliseWeights(w).ids).toEqual([1, 13]);
    expect(pSomeFits(CHECKERBOARD, w)).toBeCloseTo(1 - (1 / 4) ** 3, 12);
    expect(weightOf(new Set([13]), w)).toBeCloseTo(0.25, 12);
    expect(pSomeFits(CHECKERBOARD, new Map([[13, 1]]))).toBe(0);
    expect(() => normaliseWeights(new Map([[13, 0]]))).toThrow();
    expect(() => normaliseWeights(new Map([[999, 1]]))).toThrow(RangeError);
  });

  it('pHardPiece = 1 − (1 − W(hard))³', () => {
    const hardIn19 = TEN_TEN_POOL.filter((id) => HARD_SHAPE_IDS.has(id)).length;
    expect(hardIn19).toBe(7);
    expect(pHardPiece(uniformWeights(TEN_TEN_POOL))).toBeCloseTo(1 - (12 / 19) ** 3, 12);
    expect(pHardPiece(uniformWeights(DEFAULT_POOL))).toBeCloseTo(1 - (43 / 50) ** 3, 12);
    expect(pHardPiece(new Map([[1, 1]]))).toBe(0);
    expect(pHardPiece(new Map([[13, 1]]))).toBe(1);
  });
});

describe('pHandSolvable', () => {
  it('is 0 when nothing fits and 1 on the empty board', () => {
    const w = uniformWeights(TEN_TEN_POOL);
    expect(pHandSolvable(FULL_BOARD, w)).toMatchObject({ p: 0, exact: true, fitsCount: 0 });
    const empty = pHandSolvable(EMPTY_BOARD, w, { exactThreshold: 100 });
    expect(empty.exact).toBe(true);
    expect(empty.p).toBeCloseTo(1, 12);
    expect(empty.fitsCount).toBe(19);
    expect(empty.evaluations).toBe(1330); // C(21,3) multisets
  });

  it('exact enumeration matches brute force over all ordered hands', () => {
    const w = uniformWeights(TEN_TEN_POOL);
    for (const b of [LETHAL_BOARD, setCell(FULL_BOARD, 0, 7, false), randomBoard(seedRng(77), 0.62)]) {
      const r = pHandSolvable(b, w, { exactThreshold: 100 });
      expect(r.exact).toBe(true);
      let hits = 0;
      for (const a of TEN_TEN_POOL) for (const c of TEN_TEN_POOL) for (const d of TEN_TEN_POOL) if (isHandSolvable(b, [a, c, d])) hits++;
      expect(r.p).toBeCloseTo(hits / 19 ** 3, 12);
    }
  });

  it('exact enumeration does not assume non-fitting pieces are unplaceable', () => {
    // Full except (0,7): only the 1x1 fits, yet [1, 3, 3] is solvable via clears.
    const b = setCell(FULL_BOARD, 0, 7, false);
    const w = new Map<ShapeId, number>([
      [1, 1],
      [3, 1],
    ]);
    const r = pHandSolvable(b, w);
    expect(r.exact).toBe(true);
    // Unsolvable multisets: {3,3,3} only (prob 1/8). All others contain a 1x1 and succeed.
    expect(r.p).toBeCloseTo(7 / 8, 12);
  });

  it('weights change the answer', () => {
    const b = LETHAL_BOARD;
    const only1 = pHandSolvable(b, new Map([[1, 1]]));
    expect(only1.p).toBe(1); // three 1x1s always fit (32 empties, no clears needed)
    const mixed = pHandSolvable(b, new Map([[1, 1], [13, 1]]));
    expect(mixed.exact).toBe(true);
    expect(mixed.p).toBeCloseTo(1 / 8, 12); // only {1,1,1} is solvable
  });

  it('Monte Carlo agrees with exact within 3 SE on random boards', () => {
    const rng = seedRng(31337);
    const w = uniformWeights(TEN_TEN_POOL);
    let tested = 0;
    let attempts = 0;
    while (tested < 6 && attempts < 200) {
      attempts++;
      const b = randomBoard(rng, 0.5 + 0.2 * rng.next());
      const exact = pHandSolvable(b, w, { exactThreshold: 19 });
      if (!exact.exact || exact.p < 0.05 || exact.p > 0.95) continue;
      const mc = pHandSolvable(b, w, { exactThreshold: -1, samples: 20_000, rng: rng.fork() });
      expect(mc.exact).toBe(false);
      expect(mc.se).toBeDefined();
      expect(mc.evaluations).toBe(20_000);
      const se = mc.se ?? 0;
      expect(se).toBeGreaterThan(0);
      expect(Math.abs(mc.p - exact.p), `board fill ${fillCount(b)} exact ${exact.p} mc ${mc.p} se ${se}`).toBeLessThanOrEqual(3 * se);
      tested++;
    }
    expect(tested).toBe(6);
  });

  it('switches to Monte Carlo above the threshold and requires an rng there', () => {
    const w = uniformWeights(TEN_TEN_POOL);
    expect(() => pHandSolvable(EMPTY_BOARD, w)).toThrow(/rng/);
    const r = pHandSolvable(EMPTY_BOARD, w, { rng: seedRng(1), samples: 500 });
    expect(r.exact).toBe(false);
    expect(r.p).toBe(1);
    expect(r.se).toBe(0);
  });
});
