/**
 * Read the 8x8 occupancy from a screenshot.
 *
 * Each cell is sampled at five points (centre and four points a quarter-pitch in towards the
 * corners, which stay clear of the bevels and the grid lines). A sample is "empty" if it is
 * within `emptyTolerance` of the empty-cell colour, "filled" if it is clearly saturated or
 * bright, and "ambiguous" otherwise. Majority vote per cell. The empty colour starts from the
 * measured prior and is refined to the mean of all samples near it, so a slight tint change
 * (brightness settings, a theme) does not break the reader.
 */

import { board as makeBoard, type Board } from '@blockblast/engine';
import { BACKGROUND_COLOR, BACKGROUND_PROBES, BOARD, EMPTY_CELL_COLOR, type BoardGeometry } from './geometry.ts';
import { chroma, colorDistance, meanColor, pixel, type Rgb, type Screenshot } from './screen.ts';

export interface BoardReadOptions {
  readonly geometry?: BoardGeometry;
  /** L1 distance from the empty colour under which a sample counts as empty. */
  readonly emptyTolerance?: number;
  /** Minimum chroma (max-min channel) for a sample to count as a filled piece colour. */
  readonly minChroma?: number;
  /** Minimum brightness (max channel) that also counts as filled (white/grey pieces). */
  readonly minBright?: number;
}

export interface CellRead {
  readonly row: number;
  readonly col: number;
  readonly filled: boolean;
  /** Votes: samples classed empty / filled / ambiguous. */
  readonly votes: { empty: number; filled: number; ambiguous: number };
  readonly meanColor: Rgb;
}

export interface BoardRead {
  readonly board: Board;
  /** 64-char notation, row 0 first. */
  readonly notation: string;
  readonly cells: readonly CellRead[];
  /** Empty-cell colour actually used (refined from the prior). */
  readonly emptyColor: Rgb;
  /** Cells whose vote was not unanimous. */
  readonly contestedCells: number;
  /** Cells where ambiguous samples outnumber both other classes. */
  readonly ambiguousCells: number;
}

const SAMPLE_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [-0.25, -0.25],
  [0.25, -0.25],
  [-0.25, 0.25],
  [0.25, 0.25],
];

type SampleClass = 'empty' | 'filled' | 'ambiguous';

function classify(c: Rgb, empty: Rgb, tol: number, minChroma: number, minBright: number): SampleClass {
  if (colorDistance(c, empty) <= tol) return 'empty';
  if (chroma(c) >= minChroma || Math.max(c[0], c[1], c[2]) >= minBright) return 'filled';
  return 'ambiguous';
}

/** Refine the empty-cell colour: mean of all samples within `tol` of the prior. */
export function learnEmptyColor(img: Screenshot, g: BoardGeometry = BOARD, prior: Rgb = EMPTY_CELL_COLOR, tol = 45): Rgb {
  const near: Rgb[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      for (const [dx, dy] of SAMPLE_OFFSETS) {
        const p = pixel(img, g.x0 + (c + 0.5 + dx) * g.pitch, g.y0 + (r + 0.5 + dy) * g.pitch);
        if (colorDistance(p, prior) <= tol) near.push(p);
      }
    }
  }
  return near.length >= 10 ? meanColor(near) : prior;
}

/** Read the board occupancy. Pure: works on any decoded screenshot. */
export function readBoard(img: Screenshot, opts: BoardReadOptions = {}): BoardRead {
  const g = opts.geometry ?? BOARD;
  const tol = opts.emptyTolerance ?? 60;
  const minChroma = opts.minChroma ?? 45;
  const minBright = opts.minBright ?? 150;
  const empty = learnEmptyColor(img, g);

  const cells: CellRead[] = [];
  let lo = 0;
  let hi = 0;
  let contested = 0;
  let ambiguousCells = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const votes = { empty: 0, filled: 0, ambiguous: 0 };
      const samples: Rgb[] = [];
      for (const [dx, dy] of SAMPLE_OFFSETS) {
        const p = pixel(img, g.x0 + (c + 0.5 + dx) * g.pitch, g.y0 + (r + 0.5 + dy) * g.pitch);
        samples.push(p);
        votes[classify(p, empty, tol, minChroma, minBright)]++;
      }
      const filled = votes.filled > votes.empty;
      if (votes.ambiguous > votes.filled && votes.ambiguous > votes.empty) ambiguousCells++;
      if (votes.empty !== SAMPLE_OFFSETS.length && votes.filled !== SAMPLE_OFFSETS.length) contested++;
      if (filled) {
        const bit = 1 << (((r & 3) << 3) | c);
        if (r < 4) lo |= bit;
        else hi |= bit;
      }
      cells.push({ row: r, col: c, filled, votes, meanColor: meanColor(samples) });
    }
  }
  const b = makeBoard(lo, hi);
  let notation = '';
  for (const cell of cells) notation += cell.filled ? '#' : '.';
  return { board: b, notation, cells, emptyColor: empty, contestedCells: contested, ambiguousCells };
}

export type ScreenKind = 'play' | 'unexpected';

export interface ScreenCheck {
  readonly kind: ScreenKind;
  /** Why it was judged unexpected (empty for 'play'). */
  readonly reasons: readonly string[];
  readonly backgroundHits: number;
}

/**
 * Is this the normal play screen? Background probes around the board and tray must show the
 * page blue, and the board reader must not be confused. Dialogs, ads, the game-over and revive
 * screens all dim or cover these areas.
 */
export function checkScreen(img: Screenshot, boardRead?: BoardRead): ScreenCheck {
  const reasons: string[] = [];
  let hits = 0;
  for (const [x, y] of BACKGROUND_PROBES) {
    if (colorDistance(pixel(img, x, y), BACKGROUND_COLOR) <= 40) hits++;
  }
  if (hits < BACKGROUND_PROBES.length - 1) reasons.push(`background probes: ${hits}/${BACKGROUND_PROBES.length} match`);
  const br = boardRead ?? readBoard(img);
  if (br.ambiguousCells > 2) reasons.push(`${br.ambiguousCells} ambiguous board cells`);
  if (colorDistance(br.emptyColor, EMPTY_CELL_COLOR) > 30) reasons.push(`empty colour drifted to ${br.emptyColor.join(',')}`);
  return { kind: reasons.length === 0 ? 'play' : 'unexpected', reasons, backgroundHits: hits };
}
