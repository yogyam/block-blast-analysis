import { describe, expect, it } from 'vitest';
import {
  BOARD_CELLS,
  EMPTY_BOARD,
  FULL_BOARD,
  board,
  boardFromKey,
  boardKey,
  boardsEqual,
  canPlace,
  cellMask,
  clearLines,
  colCount,
  countHoles,
  fillCount,
  filledCells,
  fromRows,
  fromString,
  fullColsMask,
  fullRowsMask,
  getCell,
  place,
  popcount32,
  rowCount,
  setCell,
  toRows,
  toString,
} from '../src/board.ts';
import { getShape, placementAt } from '../src/shapes.ts';
import { seedRng } from '../src/rng.ts';
import { randomBoard } from './helpers.ts';

describe('board representation', () => {
  it('uses bit row*8+col within each word, lo = rows 0–3, hi = rows 4–7', () => {
    expect(setCell(EMPTY_BOARD, 0, 0, true)).toEqual({ lo: 1, hi: 0 });
    expect(setCell(EMPTY_BOARD, 0, 7, true)).toEqual({ lo: 1 << 7, hi: 0 });
    expect(setCell(EMPTY_BOARD, 1, 0, true)).toEqual({ lo: 1 << 8, hi: 0 });
    expect(setCell(EMPTY_BOARD, 3, 7, true)).toEqual({ lo: 2147483648, hi: 0 });
    expect(setCell(EMPTY_BOARD, 4, 0, true)).toEqual({ lo: 0, hi: 1 });
    expect(setCell(EMPTY_BOARD, 7, 7, true)).toEqual({ lo: 0, hi: 2147483648 });
  });

  it('keeps words unsigned', () => {
    const b = board(-1, -1);
    expect(b.lo).toBe(0xffffffff);
    expect(b.hi).toBe(0xffffffff);
    expect(boardsEqual(b, FULL_BOARD)).toBe(true);
    expect(fillCount(b)).toBe(BOARD_CELLS);
  });

  it('round-trips the 64-char notation', () => {
    const rng = seedRng(1);
    for (let i = 0; i < 200; i++) {
      const b = randomBoard(rng, rng.next());
      const s = toString(b);
      expect(s).toHaveLength(64);
      expect(fromString(s)).toEqual(b);
      expect(fillCount(b)).toBe(s.split('#').length - 1);
    }
  });

  it('round-trips the 8-row notation and ignores separators', () => {
    const rows = ['#..#....', '........', '#######.', '........', '....#...', '........', '.......#', '########'];
    const b = fromRows(rows);
    expect(toRows(b)).toEqual(rows);
    expect(fromString(rows.join('/'))).toEqual(b);
    expect(fromString(rows.join('\n'))).toEqual(b);
    expect(getCell(b, 0, 0)).toBe(true);
    expect(getCell(b, 0, 1)).toBe(false);
    expect(getCell(b, 6, 7)).toBe(true);
    expect(rowCount(b, 2)).toBe(7);
    expect(rowCount(b, 7)).toBe(8);
    expect(colCount(b, 0)).toBe(3);
    expect(filledCells(b).slice(0, 2)).toEqual([[0, 0], [0, 3]]);
  });

  it('rejects malformed notation', () => {
    expect(() => fromString('#'.repeat(63))).toThrow();
    expect(() => fromString('x' + '.'.repeat(63))).toThrow();
    expect(() => fromRows(['#'])).toThrow();
    expect(() => getCell(EMPTY_BOARD, 8, 0)).toThrow(RangeError);
    expect(() => cellMask(0, -1)).toThrow(RangeError);
  });

  it('round-trips the hash key', () => {
    const rng = seedRng(2);
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const b = randomBoard(rng, 0.5);
      const k = boardKey(b);
      expect(boardFromKey(k)).toEqual(b);
      seen.add(k);
    }
    expect(seen.size).toBe(100);
    expect(boardKey(FULL_BOARD)).not.toBe(boardKey(EMPTY_BOARD));
  });

  it('popcount32 agrees with a bit loop', () => {
    const rng = seedRng(3);
    for (let i = 0; i < 100; i++) {
      const x = rng.nextUint32();
      let n = 0;
      for (let k = 0; k < 32; k++) n += (x >>> k) & 1;
      expect(popcount32(x)).toBe(n);
    }
    expect(popcount32(0xffffffff)).toBe(32);
  });
});

describe('placement legality', () => {
  it('3x3 has 36 anchors and none hang off the edge', () => {
    const s = getShape(13);
    expect(s.placements).toHaveLength(36);
    expect(placementAt(s, 5, 5)).toBeDefined();
    expect(placementAt(s, 6, 5)).toBeUndefined();
    expect(placementAt(s, 5, 6)).toBeUndefined();
    expect(placementAt(s, -1, 0)).toBeUndefined();
    const corner = placementAt(s, 5, 5);
    expect(corner).toBeDefined();
    if (corner) {
      expect(toRows(board(corner.lo, corner.hi))).toEqual([
        '........',
        '........',
        '........',
        '........',
        '........',
        '.....###',
        '.....###',
        '.....###',
      ]);
    }
  });

  it('every anchor of every shape fits the empty board and not the full board', () => {
    for (let id = 1; id <= 51; id++) {
      for (const p of getShape(id).placements) {
        expect(canPlace(EMPTY_BOARD, p)).toBe(true);
        expect(canPlace(FULL_BOARD, p)).toBe(false);
      }
    }
  });

  it('a single filled cell blocks exactly the anchors covering it', () => {
    const s = getShape(9); // 2x2
    const b = setCell(EMPTY_BOARD, 7, 7, true);
    const legal = s.placements.filter((p) => canPlace(b, p));
    expect(legal).toHaveLength(49 - 1);
    expect(canPlace(b, placementAt(s, 6, 6)!)).toBe(false);
    expect(canPlace(b, placementAt(s, 6, 5)!)).toBe(true);
  });

  it('place() throws on overlap', () => {
    const s = getShape(1);
    const b = setCell(EMPTY_BOARD, 2, 2, true);
    expect(() => place(b, placementAt(s, 2, 2)!)).toThrow();
  });
});

describe('line clearing', () => {
  it('clears a row and a column simultaneously on a cross', () => {
    const b = fromRows(['...#....', '...#....', '...#....', '###.####', '...#....', '...#....', '...#....', '...#....']);
    expect(fullRowsMask(b)).toBe(0);
    expect(fullColsMask(b)).toBe(0);
    const r = place(b, placementAt(getShape(1), 3, 3)!);
    expect(r.rowMask).toBe(1 << 3);
    expect(r.colMask).toBe(1 << 3);
    expect(r.linesCleared).toBe(2);
    expect(r.board).toEqual(EMPTY_BOARD);
    expect(fillCount(r.beforeClear)).toBe(15);
  });

  it('clears multiple rows and columns and counts intersections once per line', () => {
    const b = fromRows(['########', '#.#.#.#.', '########', '#.#.#.#.', '#.#.#.#.', '#.#.#.#.', '#.#.#.#.', '#.#.#.#.']);
    const r = clearLines(b);
    expect(r.rowMask).toBe(0b101);
    expect(r.colMask).toBe(0b01010101);
    expect(r.linesCleared).toBe(6);
    expect(r.board).toEqual(EMPTY_BOARD);
  });

  it('clears the full board as 16 lines', () => {
    const r = clearLines(FULL_BOARD);
    expect(r.linesCleared).toBe(16);
    expect(r.board).toEqual(EMPTY_BOARD);
  });

  it('leaves incomplete lines alone and nothing falls', () => {
    const b = fromRows(['#######.', '........', '........', '........', '........', '........', '........', '.......#']);
    const r = clearLines(b);
    expect(r.linesCleared).toBe(0);
    expect(r.board).toEqual(b);
  });

  it('fullColsMask agrees with colCount', () => {
    const rng = seedRng(4);
    for (let i = 0; i < 200; i++) {
      const b = randomBoard(rng, 0.85);
      const mask = fullColsMask(b);
      for (let c = 0; c < 8; c++) expect((mask >>> c) & 1).toBe(colCount(b, c) === 8 ? 1 : 0);
      const rows = fullRowsMask(b);
      for (let r = 0; r < 8; r++) expect((rows >>> r) & 1).toBe(rowCount(b, r) === 8 ? 1 : 0);
    }
  });
});

describe('holes', () => {
  it('counts enclosed empty cells, treating edges as walls', () => {
    expect(countHoles(EMPTY_BOARD)).toBe(0);
    expect(countHoles(FULL_BOARD)).toBe(0);
    const one = setCell(FULL_BOARD, 3, 3, false);
    expect(countHoles(one)).toBe(1);
    const corner = setCell(FULL_BOARD, 0, 0, false);
    expect(countHoles(corner)).toBe(1);
    const pair = setCell(one, 3, 4, false);
    expect(countHoles(pair)).toBe(0);
  });
});
