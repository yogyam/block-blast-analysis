/**
 * The game's own shape table, ids 1–51, transcribed from `docs/research/03-prior-art.md` §1.3
 * (the Ayoships evidence bundle's `source/shape-table.js`, decoded from the Block Blast
 * Android 10.8.2 main script). Pieces are never rotated by the game, so every orientation
 * is its own id.
 *
 * Id 41 duplicates id 40 and the game's generator skips it (`if (41 != d)`); it is kept
 * here so ids line up with the table, flagged `duplicateOf: 40`, and excluded from
 * {@link DEFAULT_POOL}.
 *
 * OPEN QUESTION (Phase 2): the table defines which shapes EXIST, not which are dealt in
 * Classic mode or with what weights. Two candidate pools are exported:
 *
 * - {@link DEFAULT_POOL}: every regular shape (1–40, 42–51; 50 shapes). The maximal
 *   candidate universe per `06-methods.md` §9; the analysis set is the subset observed
 *   in Classic-mode logs.
 * - {@link TEN_TEN_POOL}: the classic 19-piece 1010!-style set used by kittimzhe and
 *   1010RL (`01-game-facts.md` §5, candidate A). Player reports of T, S/Z, U and plus
 *   pieces suggest Classic deals more than this, but nothing is confirmed.
 *
 * Experiments must choose a pool explicitly; which pool Classic mode deals is unknown
 * until Phase 2 confirms it from logs.
 *
 * Shape convention: `rows` are top-to-bottom strings, `#` = cell, `.` = gap. Width is the
 * row length, height is the number of rows. Ids 35 ("3x2") and 36 ("2x3") follow
 * `01-game-facts.md` §5, which pairs 35 with `XXX/XXX` (3 wide, 2 tall) and 36 with
 * `XX/XX/XX` (2 wide, 3 tall).
 */

import type { BoardMask } from './board.ts';

/** Identifier of a shape in the game's table (1–51 for regular shapes). */
export type ShapeId = number;

/** Difficulty class used by the detector's conditional-logit features (`06-methods.md` §3.2). */
export type Hardness = 'hard' | 'normal';

/** A legal anchor position with its precomputed board mask. */
export interface PlacementMask extends BoardMask {
  /** Row of the shape's top-left bounding-box corner. */
  readonly row: number;
  /** Column of the shape's top-left bounding-box corner. */
  readonly col: number;
}

/** A shape with its precomputed placement masks. */
export interface Shape {
  readonly id: ShapeId;
  /** Short human-readable name (not from the game; ours). */
  readonly name: string;
  /** Bounding-box width in cells. */
  readonly width: number;
  /** Bounding-box height in cells. */
  readonly height: number;
  /** Occupied cells as [row, col] offsets from the top-left of the bounding box, row-major. */
  readonly cells: ReadonlyArray<readonly [number, number]>;
  /** Number of occupied cells. */
  readonly size: number;
  /** The ASCII rows the shape was transcribed from. */
  readonly rows: readonly string[];
  readonly hardness: Hardness;
  /** Set when this id is a duplicate of another entry (only id 41 → 40). */
  readonly duplicateOf?: ShapeId;
  /**
   * Every legal anchor, row-major: index = row * (9 - width) + col.
   * Length is (9 - width) * (9 - height).
   */
  readonly placements: readonly PlacementMask[];
}

/**
 * Ids classed as "hard" for the detector: 3x3 (13), the 5-bars (11, 22) and the four
 * big Ls (12, 21, 23, 24). Matches the hardness feature in `06-methods.md` §3.2.
 */
export const HARD_SHAPE_IDS: ReadonlySet<ShapeId> = new Set([13, 11, 22, 12, 21, 23, 24]);

/** Raw transcription: [id, name, rows]. */
const RAW_TABLE: ReadonlyArray<readonly [ShapeId, string, readonly string[]]> = [
  [1, '1x1', ['#']],
  [2, 'V bar 2', ['#', '#']],
  [3, 'H bar 2', ['##']],
  [4, 'V bar 3', ['#', '#', '#']],
  [5, 'H bar 3', ['###']],
  [6, 'small L (##/#.)', ['##', '#.']],
  [7, 'V bar 4', ['#', '#', '#', '#']],
  [8, 'L (#../###)', ['#..', '###']],
  [9, '2x2', ['##', '##']],
  [10, 'T (.#./###)', ['.#.', '###']],
  [11, 'H bar 5', ['#####']],
  [12, 'big L (###/..#/..#)', ['###', '..#', '..#']],
  [13, '3x3', ['###', '###', '###']],
  [14, 'S (.##/##.)', ['.##', '##.']],
  [15, 'small L (##/.#)', ['##', '.#']],
  [16, 'S vert (#./##/.#)', ['#.', '##', '.#']],
  [17, 'H bar 4', ['####']],
  [18, 'Z (##./.##)', ['##.', '.##']],
  [19, 'Z vert (.#/##/#.)', ['.#', '##', '#.']],
  [20, 'T (#./##/#.)', ['#.', '##', '#.']],
  [21, 'big L (###/#../#..)', ['###', '#..', '#..']],
  [22, 'V bar 5', ['#', '#', '#', '#', '#']],
  [23, 'big L (#../#../###)', ['#..', '#..', '###']],
  [24, 'big L (..#/..#/###)', ['..#', '..#', '###']],
  [25, 'T (.#/##/.#)', ['.#', '##', '.#']],
  [26, 'T (###/.#.)', ['###', '.#.']],
  [27, 'small L (#./##)', ['#.', '##']],
  [28, 'small L (.#/##)', ['.#', '##']],
  [29, 'J (.#/.#/##)', ['.#', '.#', '##']],
  [30, 'L (###/..#)', ['###', '..#']],
  [31, 'L (##/#./#.)', ['##', '#.', '#.']],
  [32, 'L (##/.#/.#)', ['##', '.#', '.#']],
  [33, 'L (..#/###)', ['..#', '###']],
  [34, 'L (###/#..)', ['###', '#..']],
  [35, '3x2 (###/###)', ['###', '###']],
  [36, '2x3 (##/##/##)', ['##', '##', '##']],
  [37, 'diag 2 (#./.#)', ['#.', '.#']],
  [38, 'diag 2 (.#/#.)', ['.#', '#.']],
  [39, 'diag 3 \\', ['#..', '.#.', '..#']],
  [40, 'diag 3 /', ['..#', '.#.', '#..']],
  [41, 'diag 3 / (duplicate of 40)', ['..#', '.#.', '#..']],
  [42, 'L (#./#./##)', ['#.', '#.', '##']],
  [43, 'big T (..#/###/..#)', ['..#', '###', '..#']],
  [44, 'U (#.#/###)', ['#.#', '###']],
  [45, 'U (##/#./##)', ['##', '#.', '##']],
  [46, 'U (###/#.#)', ['###', '#.#']],
  [47, 'U (##/.#/##)', ['##', '.#', '##']],
  [48, 'big T (.#./.#./###)', ['.#.', '.#.', '###']],
  [49, 'big T (#../###/#..)', ['#..', '###', '#..']],
  [50, 'big T (###/.#./.#.)', ['###', '.#.', '.#.']],
  [51, 'plus', ['.#.', '###', '.#.']],
];

/** Explicit duplicate flags (id → original). */
const DUPLICATES: ReadonlyMap<ShapeId, ShapeId> = new Map([[41, 40]]);

function cellsFromRows(rows: readonly string[]): Array<readonly [number, number]> {
  const cells: Array<readonly [number, number]> = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      if (ch === '#') cells.push([r, c]);
      else if (ch !== '.') throw new Error(`bad shape character ${JSON.stringify(ch)}`);
    }
  });
  return cells;
}

function buildPlacements(cells: ReadonlyArray<readonly [number, number]>, width: number, height: number): PlacementMask[] {
  const out: PlacementMask[] = [];
  for (let row = 0; row + height <= 8; row++) {
    for (let col = 0; col + width <= 8; col++) {
      let lo = 0;
      let hi = 0;
      for (const [dr, dc] of cells) {
        const r = row + dr;
        const bit = 1 << (((r & 3) << 3) | (col + dc));
        if (r < 4) lo |= bit;
        else hi |= bit;
      }
      out.push({ row, col, lo: lo >>> 0, hi: hi >>> 0 });
    }
  }
  return out;
}

function buildShape(id: ShapeId, name: string, rows: readonly string[]): Shape {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (width === 0 || rows.some((r) => r.length !== width)) {
    throw new Error(`shape ${id}: rows must be non-empty and equal width`);
  }
  const cells = cellsFromRows(rows);
  const duplicateOf = DUPLICATES.get(id);
  const shape: Shape = {
    id,
    name,
    width,
    height,
    cells,
    size: cells.length,
    rows,
    hardness: HARD_SHAPE_IDS.has(id) ? 'hard' : 'normal',
    placements: buildPlacements(cells, width, height),
    ...(duplicateOf === undefined ? {} : { duplicateOf }),
  };
  return shape;
}

/** All 51 table entries in id order (index 0 is id 1). */
export const SHAPE_TABLE: readonly Shape[] = RAW_TABLE.map(([id, name, rows]) => buildShape(id, name, rows));

/** Lookup by id. */
export const SHAPES: ReadonlyMap<ShapeId, Shape> = new Map(SHAPE_TABLE.map((s) => [s.id, s]));

/** Get a shape by id, throwing on unknown ids. */
export function getShape(id: ShapeId): Shape {
  const s = SHAPES.get(id);
  if (s === undefined) throw new RangeError(`unknown shape id ${id}`);
  return s;
}

/** Whether an id is in the table. */
export function isShapeId(id: number): boolean {
  return SHAPES.has(id);
}

/**
 * The placement mask for a shape anchored (top-left of bounding box) at (row, col),
 * or `undefined` if that anchor would leave the board.
 */
export function placementAt(shape: Shape, row: number, col: number): PlacementMask | undefined {
  if (row < 0 || col < 0 || row + shape.height > 8 || col + shape.width > 8) return undefined;
  return shape.placements[row * (9 - shape.width) + col];
}

/**
 * All regular shapes except the duplicate 41: ids 1–40 and 42–51 (50 shapes).
 * The maximal candidate universe for Classic mode (see file header).
 */
export const DEFAULT_POOL: readonly ShapeId[] = SHAPE_TABLE.filter((s) => s.duplicateOf === undefined).map((s) => s.id);

/**
 * The classic 19-piece 1010!-style set (kittimzhe/blockblast-bench, 1010RL):
 * 1x1; bars 2–5 in both orientations; 2x2; 3x3; four small Ls; four big Ls.
 * A candidate, not a confirmed Classic pool (see file header).
 */
export const TEN_TEN_POOL: readonly ShapeId[] = [
  1, // 1x1
  3, 5, 17, 11, // H bars 2, 3, 4, 5
  2, 4, 7, 22, // V bars 2, 3, 4, 5
  9, // 2x2
  13, // 3x3
  6, 15, 27, 28, // small L
  12, 21, 23, 24, // big L
];

/** Hard shapes within a pool. */
export function hardShapesIn(pool: readonly ShapeId[]): ShapeId[] {
  return pool.filter((id) => HARD_SHAPE_IDS.has(id));
}

/** Render a shape's rows for logs. */
export function renderShape(shape: Shape): string {
  return shape.rows.join('\n');
}
