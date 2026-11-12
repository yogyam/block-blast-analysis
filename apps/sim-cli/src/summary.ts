/**
 * Aggregate a JSONL file of {@link SimRow}s: game length, score, solvability, the lethal
 * signature, and hard-piece share (both the detector's 7-id class and the game's 18-id list).
 */

import { HARD_SHAPE_IDS, board, createSolvabilityCache, isHandSolvable, type Hand } from '@blockblast/engine';
import { GAME_HARD_PIECE_SET, hasLethalSignature } from '@blockblast/generators';
import type { SimRow } from './run.ts';

/** The subset of a row the summary needs; `hand_solvable` and `score_after` are optional. */
export type SummaryRow = Pick<SimRow, 'game_id' | 'board_lo' | 'board_hi' | 'hand' | 'is_terminal' | 'pieces_placed' | 'score' | 'legal_moves_count'> &
  Partial<Pick<SimRow, 'hand_solvable' | 'score_after' | 'generator' | 'agent'>>;

export interface Summary {
  readonly games: number;
  readonly hands: number;
  /** Hands dealt per game, the terminal hand included. */
  readonly meanGameLength: number;
  readonly sdGameLength: number;
  /** Mean of each game's last `score_after` (falls back to the last pre-deal score). */
  readonly meanFinalScore: number;
  readonly maxFinalScore: number;
  /** Fraction of dealt hands the oracle calls fully placeable in some order. */
  readonly solvableShare: number;
  /** Fraction of hands with exactly two individually placeable pieces and no solving order. */
  readonly lethalSignatureShare: number;
  /** Fraction of hands where nothing fits at deal time. */
  readonly terminalShare: number;
  /** Fraction of games that ended after 1–2 placements of the last hand. */
  readonly endedMidHandShare: number;
  /** Share of dealt pieces in the detector's hard class (3x3, 5-bars, big Ls). */
  readonly hardShareDetector: number;
  /** Share of dealt pieces in the game's own 18-id hard list. */
  readonly hardShareGame: number;
  readonly meanLegalMoves: number;
  readonly generators: readonly string[];
  readonly agents: readonly string[];
}

/** Summarise rows (any order; grouped by `game_id`). */
export function summarizeRows(rows: Iterable<SummaryRow>): Summary {
  const memo = createSolvabilityCache();
  const perGame = new Map<string, { hands: number; lastScore: number; lastTurnTerminal: boolean; lastPieces: number }>();
  let hands = 0;
  let solvable = 0;
  let lethal = 0;
  let terminal = 0;
  let hardDet = 0;
  let hardGame = 0;
  let legal = 0;
  const generators = new Set<string>();
  const agents = new Set<string>();
  for (const r of rows) {
    hands++;
    const b = board(r.board_lo, r.board_hi);
    const hand: Hand = [r.hand[0], r.hand[1], r.hand[2]];
    const isSolvable = r.hand_solvable ?? (r.is_terminal ? false : isHandSolvable(b, hand, memo));
    if (isSolvable) solvable++;
    if (!isSolvable && hasLethalSignature(b, hand, memo)) lethal++;
    if (r.is_terminal) terminal++;
    for (const id of hand) {
      if (HARD_SHAPE_IDS.has(id)) hardDet++;
      if (GAME_HARD_PIECE_SET.has(id)) hardGame++;
    }
    legal += r.legal_moves_count;
    if (r.generator !== undefined) generators.add(r.generator);
    if (r.agent !== undefined) agents.add(r.agent);
    const g = perGame.get(r.game_id) ?? { hands: 0, lastScore: 0, lastTurnTerminal: false, lastPieces: 0 };
    g.hands++;
    const after = r.score_after ?? r.score;
    if (after >= g.lastScore) {
      g.lastScore = after;
      g.lastTurnTerminal = r.is_terminal;
      g.lastPieces = r.pieces_placed;
    }
    perGame.set(r.game_id, g);
  }
  const games = perGame.size;
  let sumLen = 0;
  let sumLen2 = 0;
  let sumScore = 0;
  let maxScore = 0;
  let mid = 0;
  for (const g of perGame.values()) {
    sumLen += g.hands;
    sumLen2 += g.hands * g.hands;
    sumScore += g.lastScore;
    maxScore = Math.max(maxScore, g.lastScore);
    if (!g.lastTurnTerminal && g.lastPieces > 0 && g.lastPieces < 3) mid++;
  }
  const meanLen = games === 0 ? 0 : sumLen / games;
  const varLen = games === 0 ? 0 : Math.max(0, sumLen2 / games - meanLen * meanLen);
  const share = (n: number, d: number): number => (d === 0 ? 0 : n / d);
  return {
    games,
    hands,
    meanGameLength: meanLen,
    sdGameLength: Math.sqrt(varLen),
    meanFinalScore: share(sumScore, games),
    maxFinalScore: maxScore,
    solvableShare: share(solvable, hands),
    lethalSignatureShare: share(lethal, hands),
    terminalShare: share(terminal, hands),
    endedMidHandShare: share(mid, games),
    hardShareDetector: share(hardDet, 3 * hands),
    hardShareGame: share(hardGame, 3 * hands),
    meanLegalMoves: share(legal, hands),
    generators: [...generators].sort(),
    agents: [...agents].sort(),
  };
}

/** Parse JSONL text into rows (blank lines skipped). */
export function parseJsonl(text: string): SummaryRow[] {
  const out: SummaryRow[] = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (s.length === 0) continue;
    out.push(JSON.parse(s) as SummaryRow);
  }
  return out;
}

/** Human-readable summary. */
export function formatSummary(s: Summary): string {
  const pct = (x: number): string => `${(100 * x).toFixed(2)}%`;
  return [
    `generator(s): ${s.generators.join(', ') || '?'}   agent(s): ${s.agents.join(', ') || '?'}`,
    `games: ${s.games}   hands: ${s.hands}`,
    `mean game length: ${s.meanGameLength.toFixed(2)} hands (sd ${s.sdGameLength.toFixed(2)})`,
    `mean final score: ${s.meanFinalScore.toFixed(1)} (max ${s.maxFinalScore})`,
    `hands solvable: ${pct(s.solvableShare)}   lethal signature (two fit, one not, no order): ${pct(s.lethalSignatureShare)}`,
    `terminal at deal: ${pct(s.terminalShare)}   games ended mid-hand: ${pct(s.endedMidHandShare)}`,
    `hard-piece share: ${pct(s.hardShareDetector)} (detector class: 3x3, 5-bars, big Ls)   ${pct(s.hardShareGame)} (game's 18-id list)`,
    `mean legal moves at deal: ${s.meanLegalMoves.toFixed(1)}`,
  ].join('\n');
}
