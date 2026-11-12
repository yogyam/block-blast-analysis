/**
 * The conditional-logit piece features g_k(board, context) of `06-methods.md` §3.2. Each is a
 * function of the board, the alternative shape k, and the pre-deal context (score relative to
 * personal best, seconds since the last hand, combo streak). Board-only features are cached per
 * board; the three "hardness × context" interactions are cheap scalars.
 */

import {
  boardKey,
  canPlaceAny,
  cellMask,
  colCount,
  countPlacements,
  fillFraction,
  getShape,
  HARD_SHAPE_IDS,
  placeUnchecked,
  rowCount,
  type Board,
  type ShapeId,
} from '@blockblast/engine';

/** Pre-deal context for the interaction features. */
export interface FeatureContext {
  /** score / personal_best, or 0 when there is no recorded best. */
  readonly scoreRelBest: number;
  /** Seconds since the previous hand (0 in simulation). */
  readonly seconds: number;
  readonly combo: number;
}

/** Names of the features, in the order {@link pieceFeatures} returns them. */
export const FEATURE_NAMES: readonly string[] = [
  'fitsAnywhere',
  'logPlacements',
  'maxLinesClearable',
  'completesNearFullLine',
  'sizeXfill',
  'hardXscoreRelBest',
  'hardXseconds',
  'hardXcombo',
];

/** Context from a record's pre-deal fields. */
export function contextOf(r: { score: number; personal_best: number; combo_streak: number; seconds_since_last_hand?: number }): FeatureContext {
  return {
    scoreRelBest: r.personal_best > 0 ? r.score / r.personal_best : 0,
    seconds: r.seconds_since_last_hand ?? 0,
    combo: r.combo_streak,
  };
}

/** Maximum lines a single placement of shape k can clear on the board (0 if it does not fit). */
function maxLinesClearable(board: Board, k: ShapeId): number {
  const { placements } = getShape(k);
  let best = 0;
  for (const p of placements) {
    if (((board.lo & p.lo) | (board.hi & p.hi)) !== 0) continue;
    const after = placeUnchecked(board, p);
    if (after.linesCleared > best) best = after.linesCleared;
  }
  return best;
}

/** Does some legal placement of k fill the single empty cell of a row or column already at 7/8? */
function completesNearFullLine(board: Board, k: ShapeId): number {
  const targets: Array<readonly [number, number]> = [];
  for (let r = 0; r < 8; r++) {
    if (rowCount(board, r) === 7) {
      for (let c = 0; c < 8; c++) {
        const m = cellMask(r, c);
        if (((board.lo & m.lo) | (board.hi & m.hi)) === 0) targets.push([r, c]);
      }
    }
  }
  for (let c = 0; c < 8; c++) {
    if (colCount(board, c) === 7) {
      for (let r = 0; r < 8; r++) {
        const m = cellMask(r, c);
        if (((board.lo & m.lo) | (board.hi & m.hi)) === 0) targets.push([r, c]);
      }
    }
  }
  if (targets.length === 0) return 0;
  const { placements } = getShape(k);
  for (const p of placements) {
    if (((board.lo & p.lo) | (board.hi & p.hi)) !== 0) continue;
    for (const [r, c] of targets) {
      const cm = cellMask(r, c);
      if (((cm.lo & p.lo) | (cm.hi & p.hi)) !== 0) return 1; // this placement covers a 7/8 gap
    }
  }
  return 0;
}

/** The five board-only features for one alternative. */
function boardFeatures(board: Board, k: ShapeId, fill: number): number[] {
  const size = getShape(k).size;
  return [
    canPlaceAny(board, k) ? 1 : 0,
    Math.log1p(countPlacements(board, k)),
    maxLinesClearable(board, k),
    completesNearFullLine(board, k),
    size * fill,
  ];
}

/** Caches the board-only feature vectors per (board, alternative). */
export class FeatureCache {
  private readonly pool: readonly ShapeId[];
  private readonly cache = new Map<string, number[][]>();

  constructor(pool: readonly ShapeId[]) {
    this.pool = pool;
  }

  /** Board-only features for every alternative in the pool, index-aligned with the pool. */
  board(board: Board): number[][] {
    const key = boardKey(board);
    let v = this.cache.get(key);
    if (v === undefined) {
      const fill = fillFraction(board);
      v = this.pool.map((k) => boardFeatures(board, k, fill));
      this.cache.set(key, v);
    }
    return v;
  }
}

/** Number of features (length of a {@link pieceFeatures} vector). */
export const FEATURE_COUNT = FEATURE_NAMES.length;

/** Full feature vector for alternative k given its cached board features and the context. */
export function assembleFeatures(boardFeat: readonly number[], k: ShapeId, ctx: FeatureContext): number[] {
  const hard = HARD_SHAPE_IDS.has(k) ? 1 : 0;
  return [
    boardFeat[0] as number,
    boardFeat[1] as number,
    boardFeat[2] as number,
    boardFeat[3] as number,
    boardFeat[4] as number,
    hard * ctx.scoreRelBest,
    hard * ctx.seconds,
    hard * ctx.combo,
  ];
}
