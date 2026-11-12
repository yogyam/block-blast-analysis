import { describe, expect, it } from 'vitest';
import { fromRows, place, placementAt, getShape } from '@blockblast/engine';
import {
  Calibration,
  DEFAULT_FINGER_MODEL,
  dragPath,
  explainBoardChange,
  fingerForPlacement,
  fingerForTarget,
  fitAxis,
  pieceForFinger,
} from '../src/drag.ts';
import { cellCenter, placementCenter } from '../src/geometry.ts';
import { observedLinesCleared } from '../src/player.ts';

const SLOT1 = { x: 540, y: 1818 };
const SLOT2 = { x: 855, y: 1818 };

describe('finger model', () => {
  it('reproduces the phase-2 calibration drop: finger (540,1486) centres a 2x2 on rows 3-4, cols 3-4', () => {
    const target = placementCenter(3, 3, 2, 2);
    expect(target).toEqual({ x: 58 + 4 * 120.5, y: 575 + 4 * 120.5 });
    const f = fingerForTarget(SLOT1, target, DEFAULT_FINGER_MODEL);
    expect(f.x).toBe(540);
    expect(Math.abs(f.y - 1486)).toBeLessThanOrEqual(4);
  });

  it('matches the held-piece measurement: finger (555,1300) from slot 2 floats the piece at about (404,772)', () => {
    const p = pieceForFinger(SLOT2, { x: 555, y: 1300 }, DEFAULT_FINGER_MODEL);
    expect(Math.abs(p.x - 404)).toBeLessThanOrEqual(8);
    expect(Math.abs(p.y - 772)).toBeLessThanOrEqual(8);
  });

  it('inverts: fingerForTarget then pieceForFinger returns the target (to rounding)', () => {
    for (const [r, c] of [
      [0, 0],
      [7, 7],
      [3, 4],
      [6, 1],
    ] as const) {
      const target = cellCenter(r, c);
      const f = fingerForTarget(SLOT2, target, DEFAULT_FINGER_MODEL);
      const back = pieceForFinger(SLOT2, f, DEFAULT_FINGER_MODEL);
      expect(Math.abs(back.x - target.x)).toBeLessThan(1.6);
      expect(Math.abs(back.y - target.y)).toBeLessThan(1.6);
    }
  });

  it('keeps every finger position for every anchor on screen', () => {
    for (const s of [getShape(1), getShape(11), getShape(22), getShape(13)]) {
      for (const p of s.placements) {
        for (const pickup of [{ x: 225, y: 1818 }, SLOT1, SLOT2]) {
          const { finger } = fingerForPlacement(pickup, s.id, p.row, p.col, DEFAULT_FINGER_MODEL);
          expect(finger.x).toBeGreaterThan(0);
          expect(finger.x).toBeLessThan(1080);
          expect(finger.y).toBeGreaterThan(0);
          expect(finger.y).toBeLessThan(2400);
        }
      }
    }
  });

  it('applies the retry offset in finger space', () => {
    const t = cellCenter(2, 2);
    const a = fingerForTarget(SLOT1, t, DEFAULT_FINGER_MODEL);
    const b = fingerForTarget(SLOT1, t, DEFAULT_FINGER_MODEL, { x: 25, y: -25 });
    expect(b.x - a.x).toBe(25);
    expect(b.y - a.y).toBe(-25);
  });

  it('dragPath ends exactly at the destination', () => {
    const path = dragPath({ x: 540, y: 1818 }, { x: 195, y: 1248 }, 10);
    expect(path).toHaveLength(10);
    expect(path[9]).toEqual({ x: 195, y: 1248 });
  });
});

describe('fitAxis', () => {
  it('recovers slope and intercept from clean data', () => {
    const pairs = [-600, -300, 0, 200, 450].map((d) => [d, 1.515 * d - 259] as const);
    const f = fitAxis(pairs, { k: 1.5, c: -250 });
    expect(f.k).toBeCloseTo(1.515, 3);
    expect(f.c).toBeCloseTo(-259, 3);
  });

  it('keeps the prior slope when the spread is small and only moves the intercept', () => {
    const f = fitAxis([[-100, -410]], { k: 1.515, c: -259 });
    expect(f.k).toBe(1.515);
    expect(f.c).toBeCloseTo(-410 + 151.5, 3);
  });

  it('rejects an implausible slope and falls back to the prior', () => {
    const f = fitAxis(
      [
        [-500, -100],
        [0, -300],
      ],
      { k: 1.515, c: -259 },
    );
    expect(f.k).toBe(1.515);
  });
});

describe('Calibration (in memory)', () => {
  it('refits from recorded landings', () => {
    const cal = new Calibration(null);
    const pickup = SLOT1;
    for (const [r, c] of [
      [0, 0],
      [0, 7],
      [7, 0],
      [7, 7],
      [3, 4],
    ] as const) {
      const target = cellCenter(r, c);
      const finger = fingerForTarget(pickup, target, DEFAULT_FINGER_MODEL);
      cal.add({ ts: 't', slot: 1, shapeId: 1, pickup, finger, offset: { x: 0, y: 0 }, target, landed: target, intended: { row: r, col: c }, actual: { row: r, col: c } });
    }
    expect(cal.model.kx).toBeCloseTo(DEFAULT_FINGER_MODEL.kx, 2);
    expect(cal.model.ky).toBeCloseTo(DEFAULT_FINGER_MODEL.ky, 2);
    expect(Math.abs(cal.model.liftY - DEFAULT_FINGER_MODEL.liftY)).toBeLessThan(3);
    expect(cal.observations).toHaveLength(5);
  });
});

describe('board change explanation', () => {
  it('finds where a piece landed, including through a line clear', () => {
    const before = fromRows(['#######.', '#....##.', '........', '........', '........', '........', '........', '........']);
    const mask = placementAt(getShape(2), 0, 7); // vertical 2-bar in the last column: completes row 0
    if (mask === undefined) throw new Error('mask');
    const after = place(before, mask);
    expect(after.linesCleared).toBe(1);
    expect(explainBoardChange(before, after.board, 2)).toEqual({ row: 0, col: 7 });
    expect(explainBoardChange(before, before, 2)).toBeNull();
    expect(observedLinesCleared(before, mask, after.board)).toBe(1);
  });
});
