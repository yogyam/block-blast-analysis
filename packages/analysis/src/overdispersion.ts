/**
 * Overdispersion of per-game piece frequencies (`06-methods.md` §3.5), the H6 companion. A dealer
 * that sets a difficulty level once per game (per-game-difficulty) makes games differ from one
 * another more than a single shared multinomial allows, which the per-turn tests miss.
 *
 * Statistic: pooled Pearson T = Σ_g Σ_k (o_gk − n_g p_k)² / (n_g p_k), with p_k the pooled piece
 * proportions. The null re-assigns the observed pieces to games at random, keeping each game's
 * size — the exact permutation null of i.i.d. hands. Overdispersion shows as T above the null.
 */

import { seedRng, shuffleInPlace, type Rng, type ShapeId } from '@blockblast/engine';
import type { Game } from './dataset.ts';
import { normalSf } from './stats.ts';

/** Result of the overdispersion test. */
export interface OverdispersionResult {
  readonly statistic: number;
  readonly nullMean: number;
  readonly nullSd: number;
  /** One-sided empirical permutation p-value for T above the null (overdispersion). */
  readonly p: number;
  /** Studentized one-sided p from z = (T − mean)/sd (no 1/(B+1) floor; for Holm at α = 0.01). */
  readonly zApproxP: number;
  readonly games: number;
  readonly permutations: number;
}

/** Pooled Pearson statistic given each game's piece list and the shared proportions. */
function pearson(gamesPieces: readonly ShapeId[][], pooled: ReadonlyMap<ShapeId, number>, total: number): number {
  let T = 0;
  for (const pieces of gamesPieces) {
    const n = pieces.length;
    if (n === 0) continue;
    const counts = new Map<ShapeId, number>();
    for (const id of pieces) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, pk] of pooled) {
      const expected = (n * pk) / total;
      if (expected <= 0) continue;
      const o = counts.get(id) ?? 0;
      T += ((o - expected) * (o - expected)) / expected;
    }
  }
  return T;
}

/**
 * Permutation test for per-game overdispersion. Each game contributes the pieces of its hands.
 */
export function overdispersionTest(games: readonly Game[], B = 2000, rng: Rng = seedRng('overdisp')): OverdispersionResult {
  const gamesPieces: ShapeId[][] = games.map((g) => {
    const pieces: ShapeId[] = [];
    for (const r of g) pieces.push(r.hand[0], r.hand[1], r.hand[2]);
    return pieces;
  });
  const pooledCounts = new Map<ShapeId, number>();
  let total = 0;
  for (const pieces of gamesPieces) {
    for (const id of pieces) {
      pooledCounts.set(id, (pooledCounts.get(id) ?? 0) + 1);
      total++;
    }
  }
  if (total === 0) return { statistic: 0, nullMean: 0, nullSd: 0, p: 1, zApproxP: 1, games: games.length, permutations: 0 };
  const sizes = gamesPieces.map((p) => p.length);
  const obs = pearson(gamesPieces, pooledCounts, total);

  const pool: ShapeId[] = [];
  for (const pieces of gamesPieces) for (const id of pieces) pool.push(id);

  const nulls: number[] = [];
  for (let b = 0; b < B; b++) {
    shuffleInPlace(pool, rng);
    const permGames: ShapeId[][] = [];
    let cursor = 0;
    for (const sz of sizes) {
      permGames.push(pool.slice(cursor, cursor + sz));
      cursor += sz;
    }
    nulls.push(pearson(permGames, pooledCounts, total));
  }
  const nullMean = nulls.reduce((a, b) => a + b, 0) / B;
  const nullSd = Math.sqrt(nulls.reduce((a, b) => a + (b - nullMean) * (b - nullMean), 0) / Math.max(1, B - 1));
  let ge = 0;
  for (const v of nulls) if (v >= obs - 1e-9) ge++;
  const zApproxP = nullSd > 0 ? normalSf((obs - nullMean) / nullSd) : obs > nullMean ? 0 : 1;
  return { statistic: obs, nullMean, nullSd, p: (1 + ge) / (B + 1), zApproxP, games: games.length, permutations: B };
}
