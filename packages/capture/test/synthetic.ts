/**
 * Synthetic 1080x2400 screens that imitate the game's rendering closely enough to exercise the
 * readers: page background, navy board with grid lines, bevelled coloured cells, tray pieces at
 * the tray pitch with bevel seams between cells.
 */

import { getShape, type Board, type ShapeId } from '@blockblast/engine';
import { BACKGROUND_COLOR, BOARD, EMPTY_CELL_COLOR, TRAY } from '../src/geometry.ts';
import type { Rgb, Screenshot } from '../src/screen.ts';

export const PALETTE: readonly Rgb[] = [
  [41, 98, 236], // blue
  [245, 186, 41], // yellow
  [160, 76, 210], // purple
  [226, 115, 38], // orange
  [214, 52, 60], // red
  [52, 180, 96], // green
  [40, 190, 210], // cyan
];

export function blank(): Screenshot {
  const width = 1080;
  const height = 2400;
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = BACKGROUND_COLOR[0];
    data[i * 4 + 1] = BACKGROUND_COLOR[1];
    data[i * 4 + 2] = BACKGROUND_COLOR[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

export function fillRect(img: Screenshot, x0: number, y0: number, x1: number, y1: number, c: Rgb): void {
  const xa = Math.max(0, Math.round(x0));
  const ya = Math.max(0, Math.round(y0));
  const xb = Math.min(img.width, Math.round(x1));
  const yb = Math.min(img.height, Math.round(y1));
  for (let y = ya; y < yb; y++) {
    for (let x = xa; x < xb; x++) {
      const i = (y * img.width + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
}

function lighter(c: Rgb, k = 1.25): Rgb {
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)].map(Math.round) as unknown as Rgb;
}

function darker(c: Rgb, k = 0.7): Rgb {
  return [c[0] * k, c[1] * k, c[2] * k].map(Math.round) as unknown as Rgb;
}

/** A bevelled block: light top/left bevel, dark bottom/right bevel, flat centre. */
export function block(img: Screenshot, x0: number, y0: number, size: number, c: Rgb, bevel: number): void {
  fillRect(img, x0, y0, x0 + size, y0 + size, lighter(c));
  fillRect(img, x0 + bevel, y0 + bevel, x0 + size, y0 + size, darker(c));
  fillRect(img, x0 + bevel, y0 + bevel, x0 + size - bevel, y0 + size - bevel, c);
}

/** Paint the board frame and the filled cells of `b`. */
export function paintBoard(img: Screenshot, b: Board, colorOf: (row: number, col: number) => Rgb = () => PALETTE[0] as Rgb): void {
  const g = BOARD;
  fillRect(img, g.x0 - 6, g.y0 - 6, g.x1 + 6, g.y1 + 6, [48, 70, 130]);
  fillRect(img, g.x0, g.y0, g.x1, g.y1, EMPTY_CELL_COLOR);
  const line: Rgb = [30, 37, 72];
  for (let i = 1; i < 8; i++) {
    fillRect(img, g.x0 + i * g.pitch - 1, g.y0, g.x0 + i * g.pitch + 1, g.y1, line);
    fillRect(img, g.x0, g.y0 + i * g.pitch - 1, g.x1, g.y0 + i * g.pitch + 1, line);
  }
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const word = r < 4 ? b.lo : b.hi;
      if ((word >>> (((r & 3) << 3) | c)) & 1) {
        block(img, g.x0 + c * g.pitch, g.y0 + r * g.pitch, g.pitch, colorOf(r, c), 14);
      }
    }
  }
}

/** Paint a tray piece centred in a slot at the tray cell pitch. */
export function paintTrayPiece(img: Screenshot, slot: 0 | 1 | 2, shapeId: ShapeId, color: Rgb = PALETTE[1] as Rgb): void {
  const s = getShape(shapeId);
  const pitch = TRAY.cellPitch;
  const centre = TRAY.slotCenters[slot];
  if (centre === undefined) throw new Error('bad slot');
  const left = centre.x - (s.width * pitch) / 2;
  const top = centre.y - (s.height * pitch) / 2;
  for (const [dr, dc] of s.cells) {
    block(img, left + dc * pitch, top + dr * pitch, pitch, color, 6);
  }
}
