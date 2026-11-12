/**
 * The exact solvability oracle (`06-methods.md` §4, §9): which pieces fit a board, and
 * whether a whole hand can be placed in some order with line clears applied between
 * placements. Cross-check target: the teardown's `verify_unsolvable.py`
 * (`03-prior-art.md` §1.4): 64-bit bitboard, simultaneous row/column clears, search over
 * all orderings.
 *
 * Note on the fits-set restriction. `06-methods.md` §4 says hands containing a piece
 * outside S(B) (the pieces with a legal placement now) are unplaceable. That is not
 * strictly true: a piece that does not fit now can fit after another piece's placement
 * clears a line (see `test/solvability.test.ts`). The oracle here is exact and does not
 * make that approximation; only the trivially unsolvable hands (no piece fits at all) are
 * short-circuited.
 */

import { canPlace, clearLines, type Board } from './board.ts';
import { getShape, type ShapeId } from './shapes.ts';
import type { Hand } from './types.ts';

/** Memo table shared across searches: key = board words + sorted remaining ids → solvable. */
export type SolvabilityCache = Map<string, boolean>;

/** Create an empty memo table. */
export function createSolvabilityCache(): SolvabilityCache {
  return new Map();
}

/** True iff the shape has at least one legal placement. */
export function canPlaceAny(board: Board, shapeId: ShapeId): boolean {
  const { placements } = getShape(shapeId);
  const { lo, hi } = board;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i] as (typeof placements)[number];
    if (((lo & p.lo) | (hi & p.hi)) === 0) return true;
  }
  return false;
}

/** Number of legal placements of the shape. */
export function countPlacements(board: Board, shapeId: ShapeId): number {
  const { placements } = getShape(shapeId);
  const { lo, hi } = board;
  let n = 0;
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i] as (typeof placements)[number];
    if (((lo & p.lo) | (hi & p.hi)) === 0) n++;
  }
  return n;
}

/** S(B): the subset of `pool` with at least one legal placement on the board. */
export function fitsAnywhereSet(board: Board, pool: Iterable<ShapeId>): Set<ShapeId> {
  const out = new Set<ShapeId>();
  for (const id of pool) if (canPlaceAny(board, id)) out.add(id);
  return out;
}

function memoKey(board: Board, sortedRemaining: readonly ShapeId[]): string {
  return `${board.lo.toString(36)}:${board.hi.toString(36)}|${sortedRemaining.join(',')}`;
}

/**
 * Depth-first search: can every piece in `remaining` (sorted ascending) be placed in some
 * order, clearing lines after each placement? Equivalent to trying all orderings; pieces
 * with equal ids are tried once.
 */
function search(board: Board, remaining: readonly ShapeId[], memo: SolvabilityCache): boolean {
  const n = remaining.length;
  if (n === 0) return true;
  if (n === 1) return canPlaceAny(board, remaining[0] as ShapeId);
  const key = memoKey(board, remaining);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  let solvable = false;
  outer: for (let i = 0; i < n; i++) {
    const id = remaining[i] as ShapeId;
    if (i > 0 && remaining[i - 1] === id) continue; // duplicate piece: same subtree
    const shape = getShape(id);
    const rest = remaining.filter((_, j) => j !== i);
    for (const p of shape.placements) {
      if (!canPlace(board, p)) continue;
      const after = clearLines({ lo: (board.lo | p.lo) >>> 0, hi: (board.hi | p.hi) >>> 0 }).board;
      if (search(after, rest, memo)) {
        solvable = true;
        break outer;
      }
    }
  }
  memo.set(key, solvable);
  return solvable;
}

/**
 * Can all the given pieces (any number; typically a 3-piece hand or the remaining tray) be
 * placed in some order, with line clears applied between placements?
 */
export function isPlaceableInSomeOrder(board: Board, pieces: readonly ShapeId[], memo: SolvabilityCache = new Map()): boolean {
  const sorted = [...pieces].sort((a, b) => a - b);
  return search(board, sorted, memo);
}

/**
 * Whether the full 3-piece hand can be placed in some order. Depth-3 search over the six
 * orderings with memoisation on (board, remaining multiset). Pass a shared `memo` to reuse
 * work across many hands on the same board.
 */
export function isHandSolvable(board: Board, hand: Hand, memo: SolvabilityCache = new Map()): boolean {
  return isPlaceableInSomeOrder(board, hand, memo);
}

/** Per-hand oracle detail used for the "looks playable but is lethal" signature. */
export interface SolvabilityDetail {
  /** Per slot: does that piece fit anywhere on the board as it is now? */
  readonly fitsIndividually: readonly [boolean, boolean, boolean];
  /** How many of the three pieces fit individually (0–3). */
  readonly fitsCount: number;
  /** Does some ordering place all three (clears applied between placements)? */
  readonly solvable: boolean;
  /** Terminal at deal time: nothing fits. */
  readonly terminal: boolean;
  /**
   * The teardown's death signature (`06-methods.md` §3.3 secondary): at least two pieces
   * fit individually, yet no ordering completes the hand.
   */
  readonly looksPlayableButLethal: boolean;
}

/** Compute {@link SolvabilityDetail} for a hand. */
export function solvabilityDetail(board: Board, hand: Hand, memo: SolvabilityCache = new Map()): SolvabilityDetail {
  const fitsIndividually: [boolean, boolean, boolean] = [
    canPlaceAny(board, hand[0]),
    canPlaceAny(board, hand[1]),
    canPlaceAny(board, hand[2]),
  ];
  const fitsCount = fitsIndividually.filter(Boolean).length;
  const solvable = fitsCount === 0 ? false : isHandSolvable(board, hand, memo);
  return {
    fitsIndividually,
    fitsCount,
    solvable,
    terminal: fitsCount === 0,
    looksPlayableButLethal: fitsCount >= 2 && !solvable,
  };
}
