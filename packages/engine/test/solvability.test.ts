import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, FULL_BOARD, fromRows, setCell } from '../src/board.ts';
import { seedRng } from '../src/rng.ts';
import { DEFAULT_POOL, TEN_TEN_POOL } from '../src/shapes.ts';
import {
  canPlaceAny,
  countPlacements,
  createSolvabilityCache,
  fitsAnywhereSet,
  isHandSolvable,
  isPlaceableInSomeOrder,
  solvabilityDetail,
} from '../src/solvability.ts';
import { CHECKERBOARD, LETHAL_BOARD, naiveSolvable, randomBoard, randomHand } from './helpers.ts';

describe('fit checks', () => {
  it('canPlaceAny / countPlacements', () => {
    expect(canPlaceAny(EMPTY_BOARD, 13)).toBe(true);
    expect(canPlaceAny(FULL_BOARD, 1)).toBe(false);
    expect(canPlaceAny(CHECKERBOARD, 1)).toBe(true);
    expect(canPlaceAny(CHECKERBOARD, 3)).toBe(false);
    expect(canPlaceAny(CHECKERBOARD, 37)).toBe(true); // diagonal cells share parity: (0,1) and (1,2) are both empty
    expect(canPlaceAny(CHECKERBOARD, 9)).toBe(false);
    expect(countPlacements(EMPTY_BOARD, 13)).toBe(36);
    expect(countPlacements(CHECKERBOARD, 1)).toBe(32);
  });

  it('fitsAnywhereSet restricts to the pool', () => {
    const fits = fitsAnywhereSet(CHECKERBOARD, TEN_TEN_POOL);
    expect([...fits]).toEqual([1]);
    const fitsAll = fitsAnywhereSet(CHECKERBOARD, DEFAULT_POOL);
    expect(fitsAll.has(1)).toBe(true);
    expect(fitsAll.has(37)).toBe(true);
    expect(fitsAll.has(38)).toBe(true);
    expect(fitsAll.has(39)).toBe(true);
    expect(fitsAll.has(40)).toBe(true);
    expect(fitsAll.size).toBe(5);
    expect(fitsAnywhereSet(EMPTY_BOARD, DEFAULT_POOL).size).toBe(50);
    expect(fitsAnywhereSet(FULL_BOARD, DEFAULT_POOL).size).toBe(0);
  });
});

describe('hand solvability', () => {
  it('trivial boards', () => {
    expect(isHandSolvable(EMPTY_BOARD, [13, 13, 13])).toBe(true);
    expect(isHandSolvable(EMPTY_BOARD, [11, 22, 13])).toBe(true);
    expect(isHandSolvable(FULL_BOARD, [1, 1, 1])).toBe(false);
    expect(isPlaceableInSomeOrder(EMPTY_BOARD, [])).toBe(true);
    expect(isPlaceableInSomeOrder(FULL_BOARD, [])).toBe(true);
  });

  it('lethal signature: two pieces fit individually, no ordering completes the hand', () => {
    // LETHAL_BOARD is a checkerboard with (0,0) and (0,1) both empty: 1x1 fits, the H domino
    // fits exactly once, the 3x3 never fits, and no placement completes a line.
    const d = solvabilityDetail(LETHAL_BOARD, [1, 3, 13]);
    expect(d.fitsIndividually).toEqual([true, true, false]);
    expect(d.fitsCount).toBe(2);
    expect(d.solvable).toBe(false);
    expect(d.terminal).toBe(false);
    expect(d.looksPlayableButLethal).toBe(true);
    expect(naiveSolvable(LETHAL_BOARD, [1, 3, 13])).toBe(false);
    // With a 1x1 instead of the 3x3, it becomes solvable.
    const ok = solvabilityDetail(LETHAL_BOARD, [1, 3, 1]);
    expect(ok.solvable).toBe(true);
    expect(ok.looksPlayableButLethal).toBe(false);
  });

  it('a piece that does not fit now can still be placed after a clear (order matters)', () => {
    // Full board except (0,7). The dominoes do not fit, but the 1x1 clears row 0 and column 7.
    const b = setCell(FULL_BOARD, 0, 7, false);
    expect(canPlaceAny(b, 3)).toBe(false);
    expect(canPlaceAny(b, 1)).toBe(true);
    const d = solvabilityDetail(b, [3, 1, 3]);
    expect(d.fitsCount).toBe(1);
    expect(d.solvable).toBe(true);
    expect(naiveSolvable(b, [3, 1, 3])).toBe(true);
    // Nothing fits at all: unsolvable without searching.
    expect(solvabilityDetail(b, [3, 9, 13]).terminal).toBe(true);
    expect(solvabilityDetail(b, [3, 9, 13]).solvable).toBe(false);
  });

  it('solvable only through a specific ordering', () => {
    // Row 0 has 3 empties at the left; everything else is full. H bar 3 must go first
    // (clearing row 0 and columns 0–2); the 2x2s only fit afterwards.
    const b = fromRows(['...#####', '########', '########', '########', '########', '########', '########', '########']);
    expect(canPlaceAny(b, 9)).toBe(false);
    expect(isHandSolvable(b, [9, 5, 9])).toBe(true);
    expect(isHandSolvable(b, [9, 9, 9])).toBe(false);
    expect(isHandSolvable(b, [5, 5, 5])).toBe(true); // bar clears, then row 0 + cols 0–2 are open
  });

  it('agrees with an independent naive search on random boards and hands', () => {
    const rng = seedRng(2024);
    const memo = createSolvabilityCache();
    let solvable = 0;
    const trials = 400;
    for (let i = 0; i < trials; i++) {
      const fill = 0.35 + 0.55 * rng.next();
      const b = randomBoard(rng, fill);
      const pool = rng.next() < 0.5 ? TEN_TEN_POOL : DEFAULT_POOL;
      const hand = randomHand(rng, pool);
      const expected = naiveSolvable(b, hand);
      expect(isHandSolvable(b, hand, memo), `trial ${i}`).toBe(expected);
      expect(isHandSolvable(b, hand), `trial ${i} (fresh memo)`).toBe(expected);
      if (expected) solvable++;
    }
    expect(solvable).toBeGreaterThan(50);
    expect(solvable).toBeLessThan(trials - 50);
  });

  it('the memo is keyed on board and multiset, so hand order does not matter', () => {
    const rng = seedRng(9);
    const memo = createSolvabilityCache();
    for (let i = 0; i < 50; i++) {
      const b = randomBoard(rng, 0.6);
      const [a, c, d] = randomHand(rng, DEFAULT_POOL);
      const r1 = isHandSolvable(b, [a, c, d], memo);
      expect(isHandSolvable(b, [d, c, a], memo)).toBe(r1);
      expect(isHandSolvable(b, [c, a, d], memo)).toBe(r1);
    }
  });
});
