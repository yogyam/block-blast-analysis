import { describe, expect, it } from 'vitest';
import { board as makeBoard, fromRows, seedRng, toRows, toString } from '@blockblast/engine';
import { checkScreen, learnEmptyColor, readBoard } from '../src/boardReader.ts';
import { EMPTY_CELL_COLOR } from '../src/geometry.ts';
import { loadPng } from '../src/screen.ts';
import { blank, PALETTE, paintBoard } from './synthetic.ts';

const fixture = (name: string): string => new URL(`./fixtures/${name}`, import.meta.url).pathname;

describe('readBoard on real screenshots', () => {
  it('reads the empty board', () => {
    const img = loadPng(fixture('empty-board-hand-6-9-5.png'));
    const r = readBoard(img);
    expect(r.notation).toBe('.'.repeat(64));
    expect(r.board).toEqual({ lo: 0, hi: 0 });
    expect(r.contestedCells).toBe(0);
    expect(r.ambiguousCells).toBe(0);
    expect(checkScreen(img, r).kind).toBe('play');
  });

  it('reads three pieces placed on row 0 (ids 6 at (0,0), 5 at (0,2), 9 at (0,5))', () => {
    const img = loadPng(fixture('row0-hand-33-17-2.png'));
    const r = readBoard(img);
    expect(toRows(r.board)).toEqual(['#######.', '#....##.', '........', '........', '........', '........', '........', '........']);
    expect(r.contestedCells).toBe(0);
    expect(checkScreen(img, r).kind).toBe('play');
  });

  it('reads a mid-game board (two part rows and a stray cell)', () => {
    const img = loadPng(fixture('midgame-hand-17-15-5.png'));
    const r = readBoard(img);
    expect(toRows(r.board)).toEqual(['######..', '#######.', '....#...', '........', '........', '........', '........', '........']);
    expect(r.contestedCells).toBe(0);
    expect(checkScreen(img, r).kind).toBe('play');
  });

  it('refines the empty colour close to the prior', () => {
    const img = loadPng(fixture('empty-board-hand-6-9-5.png'));
    const c = learnEmptyColor(img);
    expect(Math.abs(c[0] - EMPTY_CELL_COLOR[0]) + Math.abs(c[1] - EMPTY_CELL_COLOR[1]) + Math.abs(c[2] - EMPTY_CELL_COLOR[2])).toBeLessThanOrEqual(6);
  });
});

describe('readBoard on synthetic screens', () => {
  it('recovers a hand-made board exactly, with per-cell colours', () => {
    const b = fromRows(['#..#...#', '.##.....', '........', '#######.', '........', '....#...', '#.#.#.#.', '########']);
    const img = blank();
    paintBoard(img, b, (r, c) => PALETTE[(r * 3 + c) % PALETTE.length] as (typeof PALETTE)[number]);
    const read = readBoard(img);
    expect(toString(read.board)).toBe(toString(b));
    expect(read.contestedCells).toBe(0);
    expect(checkScreen(img, read).kind).toBe('play');
  });

  it('is at least 99% cell-accurate over random boards (expect 100%)', () => {
    const rng = seedRng(7);
    let cells = 0;
    let correct = 0;
    for (let i = 0; i < 40; i++) {
      const lo = rng.nextInt(0x100000000);
      const hi = rng.nextInt(0x100000000);
      const b = makeBoard(lo, hi);
      const img = blank();
      paintBoard(img, b, (r, c) => PALETTE[(r + c) % PALETTE.length] as (typeof PALETTE)[number]);
      const got = toString(readBoard(img).board);
      const want = toString(b);
      for (let k = 0; k < 64; k++) {
        cells++;
        if (got[k] === want[k]) correct++;
      }
    }
    expect(correct / cells).toBeGreaterThanOrEqual(0.99);
    expect(correct).toBe(cells);
  });

  it('flags a dimmed screen as unexpected', () => {
    const img = blank();
    paintBoard(img, makeBoard(0, 0));
    for (let i = 0; i < img.width * img.height; i++) {
      img.data[i * 4] = Math.round((img.data[i * 4] ?? 0) * 0.45);
      img.data[i * 4 + 1] = Math.round((img.data[i * 4 + 1] ?? 0) * 0.45);
      img.data[i * 4 + 2] = Math.round((img.data[i * 4 + 2] ?? 0) * 0.45);
    }
    expect(checkScreen(img).kind).toBe('unexpected');
  });
});
