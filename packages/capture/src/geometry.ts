/**
 * Screen geometry of Block Blast! on the 1080x2400 emulator, measured from screenshots
 * (`docs/findings/phase2-log.md`, 2026-11-10) and refined by `scripts`-free pixel scans
 * in this package's development.
 *
 * All numbers are screen pixels, origin top-left.
 */

import type { Rgb } from './screen.ts';

/** Axis-aligned board frame: the outer edge of the 8x8 cell grid. */
export interface BoardGeometry {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** Cell pitch in px (board width / 8). */
  readonly pitch: number;
}

export const BOARD: BoardGeometry = {
  x0: 58,
  y0: 575,
  x1: 1022,
  y1: 1540,
  pitch: (1022 - 58) / 8, // 120.5
};

/** Centre of board cell (row, col). */
export function cellCenter(row: number, col: number, g: BoardGeometry = BOARD): { x: number; y: number } {
  return { x: g.x0 + (col + 0.5) * g.pitch, y: g.y0 + (row + 0.5) * g.pitch };
}

/**
 * Centre of a shape's bounding box when anchored at (row, col) on the board. This is the point
 * the lifted piece's centre has to reach for the game to snap it there.
 */
export function placementCenter(row: number, col: number, width: number, height: number, g: BoardGeometry = BOARD): { x: number; y: number } {
  return { x: g.x0 + (col + width / 2) * g.pitch, y: g.y0 + (row + height / 2) * g.pitch };
}

/** Empty-cell colour prior (dark navy). The reader refines it from the screenshot. */
export const EMPTY_CELL_COLOR: Rgb = [35, 43, 84];

/** Page background around the tray (medium blue). */
export const BACKGROUND_COLOR: Rgb = [59, 83, 148];

/** Tray search window and slot layout. Pieces are centred in slots ≈315 px apart. */
export interface TrayGeometry {
  /** y range scanned for pieces. */
  readonly yMin: number;
  readonly yMax: number;
  /** x ranges of the three slots (left edge inclusive, right edge exclusive). */
  readonly slots: ReadonlyArray<readonly [number, number]>;
  /** Nominal slot centres. */
  readonly slotCenters: readonly { x: number; y: number }[];
  /** Pitch of one piece cell in the tray (px). */
  readonly cellPitch: number;
}

export const TRAY: TrayGeometry = {
  yMin: 1690,
  yMax: 1950,
  slots: [
    [60, 385],
    [385, 695],
    [695, 1020],
  ],
  slotCenters: [
    { x: 225, y: 1818 },
    { x: 540, y: 1818 },
    { x: 855, y: 1818 },
  ],
  cellPitch: 53.6,
};

/**
 * Probe points that must show the page background on the normal play screen. A dialog, an ad,
 * or the game-over screen changes them.
 */
export const BACKGROUND_PROBES: ReadonlyArray<readonly [number, number]> = [
  [30, 1650],
  [1050, 1650],
  [30, 2300],
  [1050, 2300],
  [540, 1990],
  [540, 520],
];
