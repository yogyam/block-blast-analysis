/**
 * The martingale-CLT statistic of `06-methods.md` §3.1 and the three indicators it drives:
 * "some piece fits" (H2 rescue), "hand not fully placeable" (H4 lethal), "hand has a hard
 * piece" (H3 kill). For an indicator I_t and the fair probability p_t = P_H0(I_t | B_t),
 *
 *     Z = Σ_t (I_t − p_t) / sqrt( Σ_t p_t (1 − p_t) )
 *
 * is asymptotically N(0,1) under H0 because stratum membership and p_t are fixed before the
 * deal. Summation may be restricted to a stratum decided from the pre-deal state.
 */

import { canPlaceAny, fillFraction, HARD_SHAPE_IDS, type ShapeId } from '@blockblast/engine';
import { boardOf, type Game, type HandRecord } from './dataset.ts';
import { normalTwoSidedP, normalSf, normalCdf } from './stats.ts';
import type { NullModel } from './nullmodel.ts';

/** One (indicator, fair-probability) pair. */
export interface MartingaleTerm {
  readonly i: 0 | 1;
  readonly p: number;
}

/** Output of the martingale Z. */
export interface MartingaleResult {
  readonly z: number;
  readonly n: number;
  readonly sumI: number;
  readonly sumP: number;
  /** Σ p(1−p), the martingale variance. */
  readonly varSum: number;
  /** Two-sided p-value. */
  readonly pTwoSided: number;
  /** One-sided p-value for the alternative Z > 0 (more of the indicator than chance). */
  readonly pGreater: number;
  /** One-sided p-value for the alternative Z < 0. */
  readonly pLess: number;
}

/** Compute Z over a list of terms. Empty or zero-variance input gives z = 0, p = 1. */
export function martingaleZ(terms: readonly MartingaleTerm[]): MartingaleResult {
  let sumI = 0;
  let sumP = 0;
  let varSum = 0;
  for (const t of terms) {
    sumI += t.i;
    sumP += t.p;
    varSum += t.p * (1 - t.p);
  }
  const n = terms.length;
  if (varSum <= 0) {
    return { z: 0, n, sumI, sumP, varSum, pTwoSided: 1, pGreater: sumI > sumP ? 0 : 1, pLess: sumI < sumP ? 0 : 1 };
  }
  const z = (sumI - sumP) / Math.sqrt(varSum);
  return { z, n, sumI, sumP, varSum, pTwoSided: normalTwoSidedP(z), pGreater: normalSf(z), pLess: normalCdf(z) };
}

/** A pre-deal stratum predicate (decided from board, score, streak before the hand is seen). */
export type Stratum = (r: HandRecord) => boolean;

/** Every hand. */
export const allHands: Stratum = () => true;

/** Boards filled at or above a fraction θ (the near-full stratum for rescue, §6). */
export function nearFull(theta: number): Stratum {
  return (r) => fillFraction(boardOf(r)) >= theta;
}

/** Turns at or past a fraction of the pre-game personal best (the near-record stratum for H3). */
export function nearRecord(frac: number): Stratum {
  return (r) => r.personal_best > 0 && r.score >= frac * r.personal_best;
}

/** Conjunction of strata. */
export function andStrata(...ss: readonly Stratum[]): Stratum {
  return (r) => ss.every((s) => s(r));
}

/** Does the dealt hand contain a piece that fits somewhere on the board? (I for H2.) */
function handSomeFits(r: HandRecord): 0 | 1 {
  // legal_moves_count > 0 iff some piece fits; equivalently !is_terminal. Recompute defensively.
  if (r.legal_moves_count > 0) return 1;
  if (r.is_terminal) return 0;
  const b = boardOf(r);
  for (const id of r.hand) if (canPlaceAny(b, id)) return 1;
  return 0;
}

/** Does the dealt hand contain a hard piece? (I for H3.) */
function handHasHard(r: HandRecord): 0 | 1 {
  for (const id of r.hand) if (HARD_SHAPE_IDS.has(id)) return 1;
  return 0;
}

/**
 * Terms for "at least one piece fits" (H2 rescue). Z > 0 means the dealer supplied fitting
 * hands more often than a fair dealer would on the same boards.
 */
export function someFitsTerms(games: readonly Game[], model: NullModel, stratum: Stratum = allHands): MartingaleTerm[] {
  const terms: MartingaleTerm[] = [];
  for (const g of games) {
    for (const r of g) {
      if (!stratum(r)) continue;
      terms.push({ i: handSomeFits(r), p: model.pSomeFits(boardOf(r)) });
    }
  }
  return terms;
}

/**
 * Terms for "hand is NOT fully placeable in any order" (H4 lethal), using the logged oracle
 * verdict D_t = !hand_solvable. Z > 0 means more unplaceable hands than a fair dealer — lethal
 * dealing. (Equivalently, mean cumulative hazard < 1; see {@link cumulativeHazard}.)
 *
 * Right-censored (truncated) games break the "exactly one death per game" identity, so by
 * default only turns up to and including each game's first unplaceable hand are counted;
 * everything after a (non-)death in a truncated game is dropped.
 */
export function notPlaceableTerms(games: readonly Game[], model: NullModel): MartingaleTerm[] {
  const terms: MartingaleTerm[] = [];
  for (const g of games) {
    for (const r of g) {
      const d: 0 | 1 = r.hand_solvable ? 0 : 1;
      terms.push({ i: d, p: model.hazard(boardOf(r)).h });
      if (d === 1) break; // first death ends the game's contribution (handles truncation cleanly)
    }
  }
  return terms;
}

/** Terms for "hand contains a hard piece" (H3 kill). Board-independent p = P_H0(hard). */
export function hasHardTerms(games: readonly Game[], model: NullModel, stratum: Stratum = allHands): MartingaleTerm[] {
  const p = model.pHard();
  const terms: MartingaleTerm[] = [];
  for (const g of games) {
    for (const r of g) {
      if (!stratum(r)) continue;
      terms.push({ i: handHasHard(r), p });
    }
  }
  return terms;
}

/** Shape ids the detector treats as hard (re-exported for callers building their own strata). */
export const HARD_IDS: ReadonlySet<ShapeId> = HARD_SHAPE_IDS;
