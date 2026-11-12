import { describe, expect, it } from 'vitest';
import { SHAPE_TABLE, board as makeBoard } from '@blockblast/engine';
import { loadPng } from '../src/screen.ts';
import { matchShape, normalizeMask, readSlot, readTray } from '../src/trayReader.ts';
import { blank, PALETTE, paintBoard, paintTrayPiece } from './synthetic.ts';

const fixture = (name: string): string => new URL(`./fixtures/${name}`, import.meta.url).pathname;

describe('readTray on real screenshots', () => {
  it('reads small L, 2x2, H bar 3', () => {
    const t = readTray(loadPng(fixture('empty-board-hand-6-9-5.png')));
    expect(t.hand).toEqual([6, 9, 5]);
    expect(t.slots[0].mask).toEqual(['##', '#.']);
    expect(t.slots[2].grid).toEqual({ rows: 1, cols: 3 });
    // Blob centres sit at the slot centres measured from the game.
    expect(t.slots[0].blob?.cx).toBeCloseTo(225.5, 0);
    expect(t.slots[1].blob?.cx).toBeCloseTo(540.5, 0);
    expect(t.slots[2].blob?.cx).toBeCloseTo(854.5, 0);
  });

  it('reads L (..#/###), H bar 4, V bar 2', () => {
    const t = readTray(loadPng(fixture('row0-hand-33-17-2.png')));
    expect(t.hand).toEqual([33, 17, 2]);
    expect(t.slots[0].mask).toEqual(['..#', '###']);
  });

  it('reads H bar 4, small L (##/.#), H bar 3', () => {
    const t = readTray(loadPng(fixture('midgame-hand-17-15-5.png')));
    expect(t.hand).toEqual([17, 15, 5]);
    expect(t.slots[0].grid).toEqual({ rows: 1, cols: 4 });
    expect(t.slots[1].mask).toEqual(['##', '.#']);
  });
});

describe('mask matching', () => {
  it('matches every table shape exactly (41 resolves to 40)', () => {
    for (const s of SHAPE_TABLE) {
      expect(matchShape(s.rows)).toBe(s.duplicateOf ?? s.id);
    }
  });

  it('returns null for a mask that is not in the table', () => {
    expect(matchShape(['#.#', '.#.', '#.#'])).toBeNull();
    expect(matchShape(['######'])).toBeNull();
  });

  it('normalises away empty border rows and columns', () => {
    expect(normalizeMask(['....', '.##.', '.#..', '....'])).toEqual(['##', '#.']);
    expect(normalizeMask(['..', '..'])).toEqual([]);
  });
});

describe('readTray on synthetic screens', () => {
  it('recognises all 50 distinct shapes in each slot', () => {
    for (const s of SHAPE_TABLE) {
      for (const slot of [0, 1, 2] as const) {
        const img = blank();
        paintBoard(img, makeBoard(0, 0));
        paintTrayPiece(img, slot, s.id, PALETTE[s.id % PALETTE.length] as (typeof PALETTE)[number]);
        const read = readSlot(img, slot);
        expect(read.shapeId, `shape ${s.id} in slot ${slot}: ${read.mask?.join('/')}`).toBe(s.duplicateOf ?? s.id);
      }
    }
  });

  it('reports empty slots and a full hand', () => {
    const img = blank();
    paintBoard(img, makeBoard(0, 0));
    paintTrayPiece(img, 1, 13);
    const t = readTray(img);
    expect(t.hand).toEqual([null, 13, null]);
    expect(t.slots[0].blob).toBeNull();
    paintTrayPiece(img, 0, 22);
    paintTrayPiece(img, 2, 11);
    expect(readTray(img).hand).toEqual([22, 13, 11]);
  });

  it('reports an unknown piece with its mask instead of guessing', () => {
    const img = blank();
    paintBoard(img, makeBoard(0, 0));
    // "#.#" is not in the table: paint a 3-bar and punch out its middle cell with background.
    paintTrayPiece(img, 1, 5);
    const read0 = readSlot(img, 1);
    expect(read0.shapeId).toBe(5);
    const blob = read0.blob;
    if (blob === null) throw new Error('no blob');
    const w = blob.x1 - blob.x0 + 1;
    for (let yy = blob.y0; yy <= blob.y1; yy++) {
      for (let xx = Math.round(blob.x0 + w / 3); xx < Math.round(blob.x0 + (2 * w) / 3); xx++) {
        const i = (yy * img.width + xx) * 4;
        img.data[i] = 59;
        img.data[i + 1] = 83;
        img.data[i + 2] = 148;
      }
    }
    const read = readSlot(img, 1);
    expect(read.shapeId).toBeNull();
    expect(read.unknown).toBe(true);
    expect(read.mask).toEqual(['#.#']);
  });
});
