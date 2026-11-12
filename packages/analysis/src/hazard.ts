/**
 * The game-level cumulative hazard of `06-methods.md` §3.3: Λ_g = Σ_{t in g} h_t, where
 * h_t is the fair dealer's per-turn hazard. For games played to a natural death, each game has
 * exactly one unplaceable hand, so E[Σ D_t] = E[Λ] = 1 under H0. Mean Λ > 1 is rescue (the
 * player survives past turns where a fair dealer would often have killed them); mean Λ < 1 is
 * lethal dealing. This is the essay's picture of H4; the primary test is the martingale Z on D.
 */

import { boardOf, type Game } from './dataset.ts';
import { mean, normalTwoSidedP, sd } from './stats.ts';
import type { NullModel } from './nullmodel.ts';

/** One point of a Λ-vs-Exp(1) QQ plot. */
export interface QqPoint {
  /** Theoretical Exp(1) quantile at plotting position (i − 0.5)/G. */
  readonly theoretical: number;
  /** Observed Λ for the game at that rank. */
  readonly observed: number;
}

/** Result of the cumulative-hazard analysis. */
export interface HazardResult {
  /** Per-game Λ, in input game order. */
  readonly lambda: readonly number[];
  readonly games: number;
  readonly meanLambda: number;
  readonly sdLambda: number;
  /**
   * Observed unsolvable hands per game (Σ D_t). Equals mean Λ in expectation under H0 by the
   * martingale identity, for ANY agent — unlike "mean Λ = 1", which holds only for a player
   * that never dies on a solvable hand. rescue pushes mean Λ above observed deaths, lethal
   * pushes it below; the martingale Z on D is the formal test.
   */
  readonly meanObservedDeaths: number;
  /** z = (meanΛ − 1)·sqrt(G)/sd(Λ); ~ N(0,1) under H0. */
  readonly z: number;
  readonly pTwoSided: number;
  /** Games that reached a natural death (one unplaceable hand); the rest are right-censored. */
  readonly completed: number;
  readonly censored: number;
  /** Sorted Λ paired with Exp(1) quantiles, for a QQ plot. */
  readonly qq: readonly QqPoint[];
}

/**
 * Compute Λ per game and test mean Λ = 1. Each game accumulates hazard up to and including its
 * first unplaceable hand; a game with no unplaceable hand (truncated by `maxTurns`) is counted
 * as right-censored and still contributes its accumulated Λ (a conservative lower bound on its
 * true Λ, so the test is conservative for rescue).
 */
export function cumulativeHazard(games: readonly Game[], model: NullModel): HazardResult {
  const lambda: number[] = [];
  let completed = 0;
  let censored = 0;
  let deaths = 0;
  for (const g of games) {
    let lam = 0;
    let died = false;
    for (const r of g) {
      lam += model.hazard(boardOf(r)).h;
      if (!r.hand_solvable) {
        died = true;
        break;
      }
    }
    lambda.push(lam);
    if (died) {
      completed++;
      deaths++;
    } else censored++;
  }
  const G = lambda.length;
  if (G === 0) {
    return { lambda, games: 0, meanLambda: 0, sdLambda: 0, meanObservedDeaths: 0, z: 0, pTwoSided: 1, completed, censored, qq: [] };
  }
  const meanLambda = mean(lambda);
  const sdLambda = sd(lambda);
  const z = sdLambda > 0 ? ((meanLambda - 1) * Math.sqrt(G)) / sdLambda : 0;
  const sorted = [...lambda].sort((a, b) => a - b);
  const qq: QqPoint[] = sorted.map((observed, i) => ({ theoretical: -Math.log(1 - (i + 0.5) / G), observed }));
  return { lambda, games: G, meanLambda, sdLambda, meanObservedDeaths: deaths / G, z, pTwoSided: normalTwoSidedP(z), completed, censored, qq };
}
