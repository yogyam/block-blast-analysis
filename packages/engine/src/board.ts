/**
 * 8x8 occupancy board stored as two unsigned 32-bit words.
 *
 * - `lo` holds rows 0–3, `hi` holds rows 4–7.
 * - Within a word, cell (row, col) is bit `((row & 3) << 3) | col`, i.e. row-major,
 *   bit 0 = column 0 of the word's first row.
 * - Both words are always normalised to unsigned (`>>> 0`) so that boards with the
 *   same contents compare equal numerically and hash identically.
 *
 * This is the representation fixed by `docs/research/06-methods.md` §1 and §10
 * (`board_lo`, `board_hi`) and recommended by `scouting/04-methodology-review.md` §F.
 */

/** Immutable 8x8 occupancy grid as two unsigned 32-bit words. */
export interface Board {
  /** Rows 0–3, bit `row*8 + col`. */
  readonly lo: number;
  /** Rows 4–7, bit `(row-4)*8 + col`. */
  readonly hi: number;
}

/** A pair of words to be OR'd into / tested against a board (a piece at an anchor, a clear mask, ...). */
export interface BoardMask {
  readonly lo: number;
  readonly hi: number;
}

/** Side length of the board. */
export const BOARD_SIZE = 8;
/** Number of cells on the board. */
export const BOARD_CELLS = 64;

/** Byte with all 8 column bits set (one full row). */
const ROW_FULL = 0xff;
/** Multiplying an 8-bit column byte by this replicates it across the 4 rows of a word. */
const COLUMN_SPREAD = 0x01010101;

/** Build a board from two words, normalising both to unsigned 32-bit. */
export function board(lo: number, hi: number): Board {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}

/** The empty board. */
export const EMPTY_BOARD: Board = Object.freeze({ lo: 0, hi: 0 });

/** The completely filled board. */
export const FULL_BOARD: Board = Object.freeze({ lo: 0xffffffff, hi: 0xffffffff });

/** Return a fresh empty board. */
export function emptyBoard(): Board {
  return EMPTY_BOARD;
}

/** Number of set bits in a 32-bit word. */
export function popcount32(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}

/** Number of set bits across both words of a mask or board. */
export function popcount(m: BoardMask): number {
  return popcount32(m.lo) + popcount32(m.hi);
}

/** Number of filled cells. */
export function fillCount(b: Board): number {
  return popcount(b);
}

/** Fraction of cells filled, in [0, 1]. */
export function fillFraction(b: Board): number {
  return fillCount(b) / BOARD_CELLS;
}

/** True iff no cell is filled. */
export function isEmpty(b: Board): boolean {
  return b.lo === 0 && b.hi === 0;
}

/** True iff the two boards have identical contents. */
export function boardsEqual(a: Board, b: Board): boolean {
  return a.lo === b.lo && a.hi === b.hi;
}

function assertCell(row: number, col: number): void {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) {
    throw new RangeError(`cell (${row}, ${col}) is outside the 8x8 board`);
  }
}

/** Bit index of (row, col) within its word. */
export function bitIndex(row: number, col: number): number {
  return ((row & 3) << 3) | col;
}

/** The single-cell mask for (row, col). */
export function cellMask(row: number, col: number): BoardMask {
  assertCell(row, col);
  const bit = (1 << bitIndex(row, col)) >>> 0;
  return row < 4 ? { lo: bit, hi: 0 } : { lo: 0, hi: bit };
}

/** Whether cell (row, col) is filled. */
export function getCell(b: Board, row: number, col: number): boolean {
  assertCell(row, col);
  const word = row < 4 ? b.lo : b.hi;
  return ((word >>> bitIndex(row, col)) & 1) === 1;
}

/** Return a copy of the board with cell (row, col) set to `filled`. */
export function setCell(b: Board, row: number, col: number, filled: boolean): Board {
  const m = cellMask(row, col);
  if (filled) return board(b.lo | m.lo, b.hi | m.hi);
  return board(b.lo & ~m.lo, b.hi & ~m.hi);
}

/** The 8-bit occupancy byte of a row (bit c = column c). */
export function rowByte(b: Board, row: number): number {
  if (!Number.isInteger(row) || row < 0 || row > 7) throw new RangeError(`row ${row} out of range`);
  const word = row < 4 ? b.lo : b.hi;
  return (word >>> ((row & 3) << 3)) & ROW_FULL;
}

/** The 8-bit occupancy byte of a column (bit r = row r). */
export function colByte(b: Board, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col > 7) throw new RangeError(`col ${col} out of range`);
  let out = 0;
  for (let r = 0; r < 8; r++) {
    const word = r < 4 ? b.lo : b.hi;
    out |= ((word >>> (((r & 3) << 3) | col)) & 1) << r;
  }
  return out;
}

/** Number of filled cells in a row. */
export function rowCount(b: Board, row: number): number {
  return popcount32(rowByte(b, row));
}

/** Number of filled cells in a column. */
export function colCount(b: Board, col: number): number {
  return popcount32(colByte(b, col));
}

/**
 * 8-bit mask of the rows that are completely full (bit r = row r).
 */
export function fullRowsMask(b: Board): number {
  let mask = 0;
  for (let r = 0; r < 4; r++) {
    if (((b.lo >>> (r << 3)) & ROW_FULL) === ROW_FULL) mask |= 1 << r;
    if (((b.hi >>> (r << 3)) & ROW_FULL) === ROW_FULL) mask |= 1 << (r + 4);
  }
  return mask;
}

/**
 * 8-bit mask of the columns that are completely full (bit c = column c).
 * Bit-parallel: AND all eight row bytes together.
 */
export function fullColsMask(b: Board): number {
  const { lo, hi } = b;
  return lo & (lo >>> 8) & (lo >>> 16) & (lo >>> 24) & hi & (hi >>> 8) & (hi >>> 16) & (hi >>> 24) & ROW_FULL;
}

/** True iff the piece mask overlaps no filled cell. */
export function canPlace(b: Board, piece: BoardMask): boolean {
  return ((b.lo & piece.lo) | (b.hi & piece.hi)) === 0;
}

/** Result of clearing complete lines. */
export interface ClearResult {
  /** Board after the clear. */
  readonly board: Board;
  /** 8-bit mask of cleared rows (bit r = row r). */
  readonly rowMask: number;
  /** 8-bit mask of cleared columns (bit c = column c). */
  readonly colMask: number;
  /** Rows cleared plus columns cleared (an intersection cell counts as two lines). */
  readonly linesCleared: number;
}

/**
 * Clear every complete row and every complete column simultaneously, as the real game
 * does (`01-game-facts.md` §4; `verify_unsolvable.py` in `03-prior-art.md` §1.4).
 * Nothing falls; cleared cells simply empty.
 */
export function clearLines(b: Board): ClearResult {
  const rowMask = fullRowsMask(b);
  const colMask = fullColsMask(b);
  if (rowMask === 0 && colMask === 0) {
    return { board: b, rowMask: 0, colMask: 0, linesCleared: 0 };
  }
  let clearLo = 0;
  let clearHi = 0;
  for (let r = 0; r < 4; r++) {
    if ((rowMask >>> r) & 1) clearLo |= ROW_FULL << (r << 3);
    if ((rowMask >>> (r + 4)) & 1) clearHi |= ROW_FULL << (r << 3);
  }
  const colSpread = (colMask * COLUMN_SPREAD) >>> 0;
  clearLo |= colSpread;
  clearHi |= colSpread;
  return {
    board: board(b.lo & ~clearLo, b.hi & ~clearHi),
    rowMask,
    colMask,
    linesCleared: popcount32(rowMask) + popcount32(colMask),
  };
}

/** Result of placing a piece: the cleared board plus what was cleared. */
export interface PlaceResult extends ClearResult {
  /** Board immediately after the piece was added, before clearing. */
  readonly beforeClear: Board;
}

/**
 * Place a piece mask (which must be legal; see {@link canPlace}) and clear complete lines.
 * Throws if the piece overlaps a filled cell.
 */
export function place(b: Board, piece: BoardMask): PlaceResult {
  if (!canPlace(b, piece)) {
    throw new Error('illegal placement: piece overlaps a filled cell');
  }
  return placeUnchecked(b, piece);
}

/** {@link place} without the legality check, for hot loops that have already tested it. */
export function placeUnchecked(b: Board, piece: BoardMask): PlaceResult {
  const beforeClear = board(b.lo | piece.lo, b.hi | piece.hi);
  const cleared = clearLines(beforeClear);
  return { ...cleared, beforeClear };
}

/**
 * String key identifying the board contents, for memo tables and logs.
 * Format: `<lo>:<hi>` in base 36.
 */
export function boardKey(b: Board): string {
  return `${b.lo.toString(36)}:${b.hi.toString(36)}`;
}

/** Inverse of {@link boardKey}. */
export function boardFromKey(key: string): Board {
  const sep = key.indexOf(':');
  if (sep < 0) throw new Error(`malformed board key: ${key}`);
  const lo = parseInt(key.slice(0, sep), 36);
  const hi = parseInt(key.slice(sep + 1), 36);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new Error(`malformed board key: ${key}`);
  return board(lo, hi);
}

/** Character used for a filled cell in string notation. */
export const FILLED_CHAR = '#';
/** Character used for an empty cell in string notation. */
export const EMPTY_CHAR = '.';

/**
 * Parse a 64-character row-major notation (row 0 first, `#` filled, `.` empty).
 * Whitespace and `/` are ignored, so `"####..../..."` and multi-line strings work.
 */
export function fromString(s: string): Board {
  const cells = s.replace(/[\s/|]/g, '');
  if (cells.length !== BOARD_CELLS) {
    throw new Error(`board notation must have 64 cells, got ${cells.length}`);
  }
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < BOARD_CELLS; i++) {
    const ch = cells[i];
    if (ch === FILLED_CHAR) {
      if (i < 32) lo |= 1 << i;
      else hi |= 1 << (i - 32);
    } else if (ch !== EMPTY_CHAR) {
      throw new Error(`unexpected character ${JSON.stringify(ch)} at cell ${i}`);
    }
  }
  return board(lo, hi);
}

/** 64-character row-major notation (row 0 first, `#` filled, `.` empty). */
export function toString(b: Board): string {
  let out = '';
  for (let i = 0; i < 32; i++) out += (b.lo >>> i) & 1 ? FILLED_CHAR : EMPTY_CHAR;
  for (let i = 0; i < 32; i++) out += (b.hi >>> i) & 1 ? FILLED_CHAR : EMPTY_CHAR;
  return out;
}

/** Parse eight 8-character row strings such as `"#..#...."` (row 0 first). */
export function fromRows(rows: readonly string[]): Board {
  if (rows.length !== BOARD_SIZE) throw new Error(`expected 8 rows, got ${rows.length}`);
  for (const [i, row] of rows.entries()) {
    if (row.length !== BOARD_SIZE) throw new Error(`row ${i} must have 8 cells, got ${row.length}`);
  }
  return fromString(rows.join(''));
}

/** The board as eight 8-character row strings (row 0 first). */
export function toRows(b: Board): string[] {
  const s = toString(b);
  const rows: string[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) rows.push(s.slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE));
  return rows;
}

/** Multi-line rendering for test failures and logs. */
export function render(b: Board): string {
  return toRows(b).join('\n');
}

/**
 * Count holes: empty cells whose four orthogonal neighbours are all filled or off-board.
 * A simple feature for heuristics (a hole can only be filled by a 1x1 piece).
 */
export function countHoles(b: Board): number {
  let holes = 0;
  let above = 0; // empty byte of the previous row; off-board counts as a wall (0 = no empties)
  for (let r = 0; r < BOARD_SIZE; r++) {
    const empty = ~rowByte(b, r) & ROW_FULL;
    const below = r < 7 ? ~rowByte(b, r + 1) & ROW_FULL : 0;
    const openSide = ((empty << 1) & ROW_FULL) | (empty >>> 1);
    holes += popcount32(empty & ~openSide & ~above & ~below);
    above = empty;
  }
  return holes;
}

/**
 * Enumerate the filled cells as [row, col] pairs in row-major order.
 */
export function filledCells(b: Board): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const byte = rowByte(b, r);
    for (let c = 0; c < BOARD_SIZE; c++) if ((byte >>> c) & 1) out.push([r, c]);
  }
  return out;
}
