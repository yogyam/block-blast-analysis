/**
 * Pools and constants read from the live game (`docs/findings/whitebox.md` §4c–4e,
 * `docs/findings/phase2-log.md`). These describe what the real dealer was *observed* to use;
 * the engine's `DEFAULT_POOL` / `TEN_TEN_POOL` remain the candidate universes for analysis.
 */

import { DEFAULT_POOL, TEN_TEN_POOL, type ShapeId } from '@blockblast/engine';

function range(from: number, to: number): ShapeId[] {
  const out: ShapeId[] = [];
  for (let id = from; id <= to; id++) out.push(id);
  return out;
}

/**
 * Shapes the live game removes from the pool in the early game (`filterBlocks` in the native
 * request): both 5-bars, the 3x3, the four big Ls and the three diagonals (41 is the duplicate).
 */
export const EARLY_FILTER_IDS: readonly ShapeId[] = [11, 12, 13, 21, 22, 23, 24, 39, 40, 41];

/** The pool the live random strategy (23001) drew from: ids 2–31. */
export const LIVE_POOL: readonly ShapeId[] = range(2, 31);

/** The early-game pool actually dealt from: {@link LIVE_POOL} minus {@link EARLY_FILTER_IDS}. */
export const LIVE_EARLY_POOL: readonly ShapeId[] = LIVE_POOL.filter((id) => !EARLY_FILTER_IDS.includes(id));

/** The pool the lethal search (algorithm 24001) draws from: ids 2–42 with the duplicate 41 skipped. */
export const LETHAL_SEARCH_POOL: readonly ShapeId[] = range(2, 42).filter((id) => id !== 41);

/**
 * The library's own hard-piece list, 18 ids, read directly from `libtask.so` (stored just before
 * the score-tier table): J/L tetrominoes, the big Ls, the 4- and 5-bars, the 2x2, the rectangles,
 * the 3x3, the T, the S pieces. Broader than the detector's `HARD_SHAPE_IDS` (3x3, 5-bars, big Ls).
 */
export const GAME_HARD_PIECE_IDS: readonly ShapeId[] = [29, 24, 23, 17, 9, 21, 36, 42, 35, 8, 16, 10, 7, 14, 22, 12, 11, 13];

/** Set form of {@link GAME_HARD_PIECE_IDS}. */
export const GAME_HARD_PIECE_SET: ReadonlySet<ShapeId> = new Set(GAME_HARD_PIECE_IDS);

/**
 * The ten-piece "safe" fallback pool used by `selectBlockDealDeathState` and `selectRandomNoDie`:
 * 1x1, 2x2, bars of 2 and 3, the four small Ls.
 */
export const GAME_SAFE_POOL: readonly ShapeId[] = [1, 2, 3, 4, 5, 6, 9, 15, 27, 28];

/**
 * Score-tier boundaries hard-coded in `BlocksWeightLogicComponent::execute`. They select which
 * host-supplied weight entries apply; the weights themselves come from the server and were not
 * observed, so the zoo exposes the tiers as data only (see {@link scoreTier}).
 */
export const GAME_SCORE_TIERS: readonly number[] = [300, 500, 700, 1000, 1400, 1800, 2200, 2500, 3000, 3800, 4500, 5200, 6000, 6800, 7600, 8400];

/** Index of the tier a score falls in: 0 below 300, 1 for [300, 500), ..., 16 at or above 8400. */
export function scoreTier(score: number): number {
  let tier = 0;
  for (const boundary of GAME_SCORE_TIERS) {
    if (score >= boundary) tier++;
    else break;
  }
  return tier;
}

/** Named pools for the CLI and the registry. */
export const POOLS: Readonly<Record<string, readonly ShapeId[]>> = {
  default: DEFAULT_POOL,
  'ten-ten': TEN_TEN_POOL,
  live: LIVE_POOL,
  'live-early': LIVE_EARLY_POOL,
  'lethal-search': LETHAL_SEARCH_POOL,
  safe: GAME_SAFE_POOL,
};

/** Resolve a pool by name (see {@link POOLS}); throws on an unknown name. */
export function resolvePool(name: string): readonly ShapeId[] {
  const pool = POOLS[name];
  if (pool === undefined) throw new Error(`unknown pool "${name}"; known: ${Object.keys(POOLS).join(', ')}`);
  return pool;
}
