/**
 * Read the three tray slots: find the coloured blob in each slot window, infer its cell grid
 * from the bounding box (≈53.6 px per cell), sample each cell's centre to build the mask, and
 * match the mask exactly against the engine's shape table. Unknown masks are reported, never
 * guessed.
 */

import { SHAPE_TABLE, type ShapeId } from '@blockblast/engine';
import { BACKGROUND_COLOR, TRAY, type TrayGeometry } from './geometry.ts';
import { colorDistance, pixel, type Rgb, type Screenshot } from './screen.ts';

export interface Blob {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly cx: number;
  readonly cy: number;
  readonly pixels: number;
}

export interface SlotRead {
  readonly slot: 0 | 1 | 2;
  /** Matched shape id, or null when the slot is empty or the mask is unknown. */
  readonly shapeId: ShapeId | null;
  /** True when a piece is present but no table shape matches; `mask` then holds what was seen. */
  readonly unknown: boolean;
  /** Mask rows (`#`/`.`), top-left normalised; null for an empty slot. */
  readonly mask: readonly string[] | null;
  readonly blob: Blob | null;
  /** Inferred grid of the piece in cells. */
  readonly grid: { rows: number; cols: number } | null;
}

export interface TrayRead {
  readonly slots: readonly [SlotRead, SlotRead, SlotRead];
  /** Shape id per slot, null for empty or unknown. */
  readonly hand: readonly [ShapeId | null, ShapeId | null, ShapeId | null];
}

export interface TrayReadOptions {
  readonly geometry?: TrayGeometry;
  /** L1 distance from the page background above which a pixel belongs to a piece. */
  readonly threshold?: number;
  /** Minimum piece pixels (at the scan stride) for a slot to count as occupied. */
  readonly minPixels?: number;
}

const STRIDE = 2;

/** Bounding box of pixels unlike the background in a window; null if too few. */
export function findBlob(img: Screenshot, xMin: number, xMax: number, yMin: number, yMax: number, threshold: number, minPixels: number): Blob | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let n = 0;
  for (let y = yMin; y < yMax; y += STRIDE) {
    for (let x = xMin; x < xMax; x += STRIDE) {
      if (colorDistance(pixel(img, x, y), BACKGROUND_COLOR) > threshold) {
        n++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (n < minPixels) return null;
  // Refine the edges at full resolution (the stride can miss the outermost pixel).
  x1 = Math.min(xMax - 1, x1 + STRIDE - 1);
  y1 = Math.min(yMax - 1, y1 + STRIDE - 1);
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, pixels: n };
}

/** Sample a 3x3 patch around (x, y) and report whether the majority is piece-coloured. */
function patchIsPiece(img: Screenshot, x: number, y: number, threshold: number): boolean {
  let hits = 0;
  for (let dy = -6; dy <= 6; dy += 6) {
    for (let dx = -6; dx <= 6; dx += 6) {
      if (colorDistance(pixel(img, x + dx, y + dy), BACKGROUND_COLOR) > threshold) hits++;
    }
  }
  return hits >= 5;
}

/** Build the cell mask of a blob given its inferred grid. */
export function blobMask(img: Screenshot, blob: Blob, rows: number, cols: number, threshold: number): string[] {
  const w = blob.x1 - blob.x0 + 1;
  const h = blob.y1 - blob.y0 + 1;
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      const x = blob.x0 + ((c + 0.5) * w) / cols;
      const y = blob.y0 + ((r + 0.5) * h) / rows;
      line += patchIsPiece(img, x, y, threshold) ? '#' : '.';
    }
    out.push(line);
  }
  return out;
}

/** Trim empty border rows/columns so the mask is anchored at its top-left. */
export function normalizeMask(mask: readonly string[]): string[] {
  let rows = mask.filter((r) => r.includes('#'));
  if (rows.length === 0) return [];
  const width = rows[0]?.length ?? 0;
  let first = width;
  let last = -1;
  for (const r of rows) {
    const a = r.indexOf('#');
    const b = r.lastIndexOf('#');
    if (a >= 0 && a < first) first = a;
    if (b > last) last = b;
  }
  rows = rows.map((r) => r.slice(first, last + 1));
  return rows;
}

/** Exact match of a normalised mask against the shape table; lowest id wins (so 40 over 41). */
export function matchShape(mask: readonly string[]): ShapeId | null {
  const key = mask.join('/');
  for (const s of SHAPE_TABLE) {
    if (s.rows.join('/') === key) return s.id;
  }
  return null;
}

function inferCells(px: number, pitch: number): number {
  return Math.max(1, Math.min(5, Math.round(px / pitch)));
}

/** Read one slot window. */
export function readSlot(img: Screenshot, slot: 0 | 1 | 2, opts: TrayReadOptions = {}): SlotRead {
  const g = opts.geometry ?? TRAY;
  const threshold = opts.threshold ?? 70;
  const minPixels = opts.minPixels ?? 150;
  const range = g.slots[slot];
  if (range === undefined) throw new RangeError(`no slot ${slot}`);
  const blob = findBlob(img, range[0], range[1], g.yMin, g.yMax, threshold, minPixels);
  if (blob === null) return { slot, shapeId: null, unknown: false, mask: null, blob: null, grid: null };
  const cols = inferCells(blob.x1 - blob.x0 + 1, g.cellPitch);
  const rows = inferCells(blob.y1 - blob.y0 + 1, g.cellPitch);
  const mask = normalizeMask(blobMask(img, blob, rows, cols, threshold));
  const shapeId = mask.length === 0 ? null : matchShape(mask);
  return { slot, shapeId, unknown: shapeId === null, mask, blob, grid: { rows, cols } };
}

/** Read all three slots. */
export function readTray(img: Screenshot, opts: TrayReadOptions = {}): TrayRead {
  const slots: [SlotRead, SlotRead, SlotRead] = [readSlot(img, 0, opts), readSlot(img, 1, opts), readSlot(img, 2, opts)];
  return { slots, hand: [slots[0].shapeId, slots[1].shapeId, slots[2].shapeId] };
}

/** Human-readable one-liner for logs. */
export function describeTray(t: TrayRead): string {
  return t.slots
    .map((s) => {
      if (s.blob === null) return `[${s.slot}] empty`;
      if (s.shapeId !== null) return `[${s.slot}] #${s.shapeId} ${s.mask?.join('/')}`;
      return `[${s.slot}] UNKNOWN ${s.mask?.join('/')} (${s.grid?.rows}x${s.grid?.cols}, ${s.blob.pixels}px)`;
    })
    .join('  ');
}

/** For tests and calibration: the colour at a blob's centre. */
export function blobColor(img: Screenshot, blob: Blob): Rgb {
  return pixel(img, blob.cx, blob.cy);
}
