import { EMPTY_BOARD, type Board, board, fromRows } from '../src/board.ts';
import type { Rng } from '../src/rng.ts';
import { getShape, type ShapeId } from '../src/shapes.ts';
import type { GameState, Generator, Hand } from '../src/types.ts';

/** Deals a fixed script of hands, then repeats the last one. */
export class ScriptedGenerator implements Generator {
  readonly name = 'scripted';
  private i = 0;
  private readonly hands: readonly Hand[];
  constructor(hands: readonly Hand[]) {
    this.hands = hands;
  }
  next(_state: GameState, _rng: Rng): Hand {
    const h = this.hands[Math.min(this.i, this.hands.length - 1)];
    if (h === undefined) throw new Error('empty script');
    this.i++;
    return h;
  }
  reset(): void {
    this.i = 0;
  }
  serializeState(): unknown {
    return { i: this.i };
  }
}

/** Random board with each cell filled independently with probability `fill`. */
export function randomBoard(rng: Rng, fill: number): Board {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 32; i++) if (rng.next() < fill) lo |= 1 << i;
  for (let i = 0; i < 32; i++) if (rng.next() < fill) hi |= 1 << i;
  return board(lo, hi);
}

/** Uniform random shape id from a pool. */
export function randomShape(rng: Rng, pool: readonly ShapeId[]): ShapeId {
  return pool[rng.nextInt(pool.length)] as ShapeId;
}

export function randomHand(rng: Rng, pool: readonly ShapeId[]): Hand {
  return [randomShape(rng, pool), randomShape(rng, pool), randomShape(rng, pool)];
}

/**
 * Independent, deliberately naive solvability check: explicit permutations, explicit cell
 * grids, no bit tricks, no memo. Used to cross-check the bitboard oracle.
 */
export function naiveSolvable(b: Board, hand: readonly ShapeId[]): boolean {
  const grid = toGrid(b);
  return naiveSearch(grid, [...hand]);
}

function toGrid(b: Board): boolean[][] {
  const grid: boolean[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: boolean[] = [];
    const word = r < 4 ? b.lo : b.hi;
    for (let c = 0; c < 8; c++) row.push(((word >>> (((r & 3) << 3) | c)) & 1) === 1);
    grid.push(row);
  }
  return grid;
}

function naiveSearch(grid: boolean[][], remaining: ShapeId[]): boolean {
  if (remaining.length === 0) return true;
  for (let i = 0; i < remaining.length; i++) {
    const id = remaining[i] as ShapeId;
    const shape = getShape(id);
    const rest = remaining.filter((_, j) => j !== i);
    for (let r = 0; r + shape.height <= 8; r++) {
      for (let c = 0; c + shape.width <= 8; c++) {
        if (!shape.cells.every(([dr, dc]) => !(grid[r + dr] as boolean[])[c + dc])) continue;
        const next = grid.map((row) => [...row]);
        for (const [dr, dc] of shape.cells) (next[r + dr] as boolean[])[c + dc] = true;
        naiveClear(next);
        if (naiveSearch(next, rest)) return true;
      }
    }
  }
  return false;
}

function naiveClear(grid: boolean[][]): void {
  const fullRows: number[] = [];
  const fullCols: number[] = [];
  for (let r = 0; r < 8; r++) if ((grid[r] as boolean[]).every(Boolean)) fullRows.push(r);
  for (let c = 0; c < 8; c++) if (grid.every((row) => row[c])) fullCols.push(c);
  for (const r of fullRows) for (let c = 0; c < 8; c++) (grid[r] as boolean[])[c] = false;
  for (const c of fullCols) for (let r = 0; r < 8; r++) (grid[r] as boolean[])[c] = false;
}

/** Checkerboard with (0,0)/(0,1) both open so a horizontal domino fits exactly once. */
export const LETHAL_BOARD: Board = fromRows([
  '..#.#.#.',
  '.#.#.#.#',
  '#.#.#.#.',
  '.#.#.#.#',
  '#.#.#.#.',
  '.#.#.#.#',
  '#.#.#.#.',
  '.#.#.#.#',
]);

export const CHECKERBOARD: Board = fromRows([
  '#.#.#.#.',
  '.#.#.#.#',
  '#.#.#.#.',
  '.#.#.#.#',
  '#.#.#.#.',
  '.#.#.#.#',
  '#.#.#.#.',
  '.#.#.#.#',
]);

export { EMPTY_BOARD };
