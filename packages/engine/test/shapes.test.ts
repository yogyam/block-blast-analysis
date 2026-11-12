import { describe, expect, it } from 'vitest';
import { popcount, toRows, board } from '../src/board.ts';
import { DEFAULT_POOL, HARD_SHAPE_IDS, SHAPES, SHAPE_TABLE, TEN_TEN_POOL, getShape, placementAt } from '../src/shapes.ts';

/**
 * Independent transcription of 03-prior-art.md §1.3: id → [cells, width, height].
 * Width/height read off the ASCII art in the table.
 */
const EXPECTED: Record<number, [cells: number, w: number, h: number]> = {
  1: [1, 1, 1],
  2: [2, 1, 2],
  3: [2, 2, 1],
  4: [3, 1, 3],
  5: [3, 3, 1],
  6: [3, 2, 2],
  7: [4, 1, 4],
  8: [4, 3, 2],
  9: [4, 2, 2],
  10: [4, 3, 2],
  11: [5, 5, 1],
  12: [5, 3, 3],
  13: [9, 3, 3],
  14: [4, 3, 2],
  15: [3, 2, 2],
  16: [4, 2, 3],
  17: [4, 4, 1],
  18: [4, 3, 2],
  19: [4, 2, 3],
  20: [4, 2, 3],
  21: [5, 3, 3],
  22: [5, 1, 5],
  23: [5, 3, 3],
  24: [5, 3, 3],
  25: [4, 2, 3],
  26: [4, 3, 2],
  27: [3, 2, 2],
  28: [3, 2, 2],
  29: [4, 2, 3],
  30: [4, 3, 2],
  31: [4, 2, 3],
  32: [4, 2, 3],
  33: [4, 3, 2],
  34: [4, 3, 2],
  35: [6, 3, 2],
  36: [6, 2, 3],
  37: [2, 2, 2],
  38: [2, 2, 2],
  39: [3, 3, 3],
  40: [3, 3, 3],
  41: [3, 3, 3],
  42: [4, 2, 3],
  43: [5, 3, 3],
  44: [5, 3, 2],
  45: [5, 2, 3],
  46: [5, 3, 2],
  47: [5, 2, 3],
  48: [5, 3, 3],
  49: [5, 3, 3],
  50: [5, 3, 3],
  51: [5, 3, 3],
};

describe('shape table integrity', () => {
  it('has 51 entries with ids 1..51 in order', () => {
    expect(SHAPE_TABLE).toHaveLength(51);
    SHAPE_TABLE.forEach((s, i) => expect(s.id).toBe(i + 1));
    expect(SHAPES.size).toBe(51);
    expect(() => getShape(52)).toThrow(RangeError);
    expect(() => getShape(0)).toThrow(RangeError);
  });

  it('cell counts, widths and heights match the table', () => {
    for (const s of SHAPE_TABLE) {
      const exp = EXPECTED[s.id];
      expect(exp, `id ${s.id} missing from expected table`).toBeDefined();
      const [cells, w, h] = exp!;
      expect(s.size, `id ${s.id} cells`).toBe(cells);
      expect(s.cells, `id ${s.id} cells array`).toHaveLength(cells);
      expect(s.width, `id ${s.id} width`).toBe(w);
      expect(s.height, `id ${s.id} height`).toBe(h);
    }
  });

  it('total cell count across ids 1–51 matches the table column sum', () => {
    const total = Object.values(EXPECTED).reduce((a, [c]) => a + c, 0);
    expect(SHAPE_TABLE.reduce((a, s) => a + s.size, 0)).toBe(total);
    expect(total).toBe(208);
  });

  it('cells lie inside the bounding box and touch every row and column of it', () => {
    for (const s of SHAPE_TABLE) {
      const rows = new Set<number>();
      const cols = new Set<number>();
      for (const [r, c] of s.cells) {
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThan(s.height);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(s.width);
        rows.add(r);
        cols.add(c);
      }
      expect(rows.size).toBe(s.height);
      expect(cols.size).toBe(s.width);
    }
  });

  it('spot-checks a few shapes against the ASCII art', () => {
    expect(getShape(8).rows).toEqual(['#..', '###']);
    expect(getShape(12).rows).toEqual(['###', '..#', '..#']);
    expect(getShape(16).rows).toEqual(['#.', '##', '.#']);
    expect(getShape(43).rows).toEqual(['..#', '###', '..#']);
    expect(getShape(51).rows).toEqual(['.#.', '###', '.#.']);
    expect(getShape(39).rows).toEqual(['#..', '.#.', '..#']);
    expect(getShape(40).rows).toEqual(['..#', '.#.', '#..']);
  });

  it('41 duplicates 40 and is excluded from the default pool', () => {
    const a = getShape(40);
    const b = getShape(41);
    expect(b.duplicateOf).toBe(40);
    expect(a.duplicateOf).toBeUndefined();
    expect(b.cells).toEqual(a.cells);
    expect(b.width).toBe(a.width);
    expect(b.height).toBe(a.height);
    expect(DEFAULT_POOL).not.toContain(41);
    expect(DEFAULT_POOL).toHaveLength(50);
    expect(DEFAULT_POOL).toEqual([...Array.from({ length: 40 }, (_, i) => i + 1), ...Array.from({ length: 10 }, (_, i) => i + 42)]);
    expect(SHAPE_TABLE.filter((s) => s.duplicateOf !== undefined)).toHaveLength(1);
  });

  it('placement-mask counts are (9−w)(9−h), row-major, with popcount = size', () => {
    for (const s of SHAPE_TABLE) {
      expect(s.placements, `id ${s.id}`).toHaveLength((9 - s.width) * (9 - s.height));
      let i = 0;
      for (let row = 0; row + s.height <= 8; row++) {
        for (let col = 0; col + s.width <= 8; col++) {
          const p = s.placements[i++]!;
          expect(p.row).toBe(row);
          expect(p.col).toBe(col);
          expect(popcount(p)).toBe(s.size);
          expect(placementAt(s, row, col)).toBe(p);
        }
      }
      // All masks distinct.
      expect(new Set(s.placements.map((p) => `${p.lo}:${p.hi}`)).size).toBe(s.placements.length);
    }
  });

  it('a placement mask renders the shape at its anchor', () => {
    const s = getShape(16); // #./##/.#
    const p = placementAt(s, 2, 6)!;
    expect(toRows(board(p.lo, p.hi))).toEqual(['........', '........', '......#.', '......##', '.......#', '........', '........', '........']);
  });

  it('hardness classes are the 3x3, the 5-bars and the big Ls', () => {
    expect([...HARD_SHAPE_IDS].sort((a, b) => a - b)).toEqual([11, 12, 13, 21, 22, 23, 24]);
    for (const s of SHAPE_TABLE) expect(s.hardness).toBe(HARD_SHAPE_IDS.has(s.id) ? 'hard' : 'normal');
  });

  it('the 19-piece pool is the 1010! catalogue', () => {
    expect(TEN_TEN_POOL).toHaveLength(19);
    expect(new Set(TEN_TEN_POOL).size).toBe(19);
    const sizes = TEN_TEN_POOL.map((id) => getShape(id).size).sort((a, b) => a - b);
    // 1x1; eight bars 2..5 (sizes 2,2,3,3,4,4,5,5); 2x2 (4); 3x3 (9); 4 small L (3); 4 big L (5)
    expect(sizes).toEqual([1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5, 9]);
    expect(TEN_TEN_POOL).toContain(13);
    for (const id of [6, 15, 27, 28, 12, 21, 23, 24, 11, 22]) expect(TEN_TEN_POOL).toContain(id);
    for (const id of TEN_TEN_POOL) expect(DEFAULT_POOL).toContain(id);
  });
});
