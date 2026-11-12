/**
 * The turn loop and the pluggable scoring rules.
 *
 * Rules (`01-game-facts.md` §4): 8x8 board; three pieces in the tray, placed one at a time in
 * any order; the tray refills only once all three are placed; no rotation; complete rows and
 * columns clear simultaneously after every placement; no gravity; the game is over when no
 * remaining tray piece fits anywhere (this can happen mid-hand).
 *
 * SCORING IS UNRESOLVED (`01-game-facts.md` §6). The formulas below are candidates from
 * third-party reimplementations, not from the developer, and may themselves be A/B-tested
 * in the live game. Every game must choose its {@link ScoringRule} explicitly; Phase 2 fits
 * the real formula from logged (cells, lines, combo, score delta) tuples.
 */

import { fillCount, isEmpty, placeUnchecked, type Board, EMPTY_BOARD } from './board.ts';
import type { Rng } from './rng.ts';
import { getShape, placementAt, type ShapeId } from './shapes.ts';
import { canPlaceAny } from './solvability.ts';
import type { Generator, GameState, Hand, HandSlots, Placement } from './types.ts';

/** What a scoring rule sees for one placement. */
export interface ScoringInput {
  /** Cells of the piece just placed. */
  readonly cellsPlaced: number;
  /** Rows plus columns cleared by this placement. */
  readonly linesCleared: number;
  readonly rowsCleared: number;
  readonly colsCleared: number;
  /** Combo streak before this placement (consecutive clearing placements). */
  readonly comboBefore: number;
  /** Whether the board is completely empty after the clear ("perfect clear"). */
  readonly boardEmptyAfter: boolean;
  /** Filled cells after the clear. */
  readonly fillAfter: number;
}

/** Points awarded and the streak value carried forward. */
export interface ScoringOutput {
  readonly points: number;
  readonly comboAfter: number;
}

/** A pluggable scoring formula. Each rule also defines its own combo semantics. */
export interface ScoringRule {
  readonly name: string;
  /** Where the formula came from; all current rules are unconfirmed candidates. */
  readonly provenance: string;
  score(input: ScoringInput): ScoringOutput;
}

/**
 * Candidate (a), unsupo/Block-Blast-Solver `GAME_MECHANICS.md` (claimed from the binary,
 * unverified): 1 point per cell placed; a clearing placement adds 10 × lines² × combo, where
 * combo counts consecutive clearing placements (first clear = 1) and resets to 0 on a
 * non-clearing placement. Worked values from the source: 1 line at combo 1 = 10; 2 lines at
 * combo 3 = 120; 4 lines at combo 8 = 1,280.
 */
export const UnsupoScoring: ScoringRule = {
  name: 'unsupo',
  provenance: 'unsupo/Block-Blast-Solver docs/GAME_MECHANICS.md; unconfirmed candidate',
  score({ cellsPlaced, linesCleared, comboBefore }) {
    if (linesCleared === 0) return { points: cellsPlaced, comboAfter: 0 };
    const comboAfter = comboBefore + 1;
    return { points: cellsPlaced + 10 * linesCleared * linesCleared * comboAfter, comboAfter };
  },
};

/**
 * Candidate (b), kittimzhe/blockblast-bench `ScoringConfig` (explicitly an approximation;
 * "official scoring constants are not public"): 1 point per cell placed; line points are
 * progressive, 10·k(k+1)/2 for k lines (10 / 30 / 60 / 100 ...); the n-th consecutive clear
 * multiplies line points by 1 + 0.5·(n−1), capped at ×4; a perfect clear adds a flat 300.
 * The source does not say whether the perfect-clear bonus is multiplied; here it is not.
 */
export const KittimzheScoring: ScoringRule = {
  name: 'kittimzhe',
  provenance: 'kittimzhe/blockblast-bench ScoringConfig; explicit approximation',
  score({ cellsPlaced, linesCleared, comboBefore, boardEmptyAfter }) {
    if (linesCleared === 0) return { points: cellsPlaced, comboAfter: 0 };
    const n = comboBefore + 1;
    const linePoints = (10 * linesCleared * (linesCleared + 1)) / 2;
    const multiplier = Math.min(1 + 0.5 * (n - 1), 4);
    const perfect = boardEmptyAfter ? 300 : 0;
    return { points: Math.floor(cellsPlaced + linePoints * multiplier + perfect), comboAfter: n };
  },
};

/** Trivial baseline: 1 point per cell placed, nothing else. Tracks the combo streak only. */
export const CellsOnlyScoring: ScoringRule = {
  name: 'cells-only',
  provenance: 'trivial baseline',
  score({ cellsPlaced, linesCleared, comboBefore }) {
    return { points: cellsPlaced, comboAfter: linesCleared === 0 ? 0 : comboBefore + 1 };
  },
};

/** All built-in scoring rules by name. */
export const SCORING_RULES: Readonly<Record<string, ScoringRule>> = {
  [UnsupoScoring.name]: UnsupoScoring,
  [KittimzheScoring.name]: KittimzheScoring,
  [CellsOnlyScoring.name]: CellsOnlyScoring,
};

/** Default used by the simulator when nothing is chosen; `createGame` still requires an explicit choice. */
export const DEFAULT_SCORING: ScoringRule = UnsupoScoring;

/** How a game is set up. The scoring rule is mandatory so the choice is always explicit. */
export interface GameConfig {
  readonly generator: Generator;
  readonly scoring: ScoringRule;
  /** Starting board; the empty board unless an A/B arm pre-fills it. */
  readonly initialBoard?: Board;
  /** Pre-game personal best, for score-relative features. */
  readonly personalBest?: number;
}

/** Non-null slots of the tray, in slot order. */
export function remainingHand(state: GameState): ShapeId[] {
  return state.hand.filter((id): id is ShapeId => id !== null);
}

/** The game is over when no remaining piece fits anywhere (true when nothing remains only if the tray is empty by error). */
export function isTerminal(board: Board, remaining: readonly ShapeId[]): boolean {
  for (const id of remaining) if (canPlaceAny(board, id)) return false;
  return true;
}

/** Every legal placement of a shape on the board. */
export function legalPlacements(board: Board, shapeId: ShapeId): Placement[] {
  const shape = getShape(shapeId);
  const out: Placement[] = [];
  for (const p of shape.placements) {
    if (((board.lo & p.lo) | (board.hi & p.hi)) === 0) out.push({ shapeId, row: p.row, col: p.col });
  }
  return out;
}

/** Every legal move for the remaining pieces (duplicate ids contribute once). */
export function legalMoves(board: Board, remaining: readonly ShapeId[]): Placement[] {
  const seen = new Set<ShapeId>();
  const out: Placement[] = [];
  for (const id of remaining) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(...legalPlacements(board, id));
  }
  return out;
}

/** Number of legal moves for the remaining pieces (duplicate ids counted once): the log's `legal_moves_count`. */
export function countLegalMoves(board: Board, remaining: readonly ShapeId[]): number {
  const seen = new Set<ShapeId>();
  let n = 0;
  for (const id of remaining) {
    if (seen.has(id)) continue;
    seen.add(id);
    for (const p of getShape(id).placements) if (((board.lo & p.lo) | (board.hi & p.hi)) === 0) n++;
  }
  return n;
}

/** Whether the placement is legal on the board (shape exists, anchor in bounds, no overlap). */
export function isLegalPlacement(board: Board, placement: Placement): boolean {
  const shape = getShape(placement.shapeId);
  const mask = placementAt(shape, placement.row, placement.col);
  return mask !== undefined && ((board.lo & mask.lo) | (board.hi & mask.hi)) === 0;
}

function freshState(board: Board, hand: Hand, turn: number, prev: Pick<GameState, 'score' | 'combo' | 'personalBest' | 'totalLinesCleared' | 'piecesPlaced'>): GameState {
  return {
    board,
    hand: [hand[0], hand[1], hand[2]],
    dealtHand: hand,
    score: prev.score,
    combo: prev.combo,
    turn,
    personalBest: prev.personalBest,
    placedInTurn: 0,
    linesClearedInTurn: 0,
    totalLinesCleared: prev.totalLinesCleared,
    piecesPlaced: prev.piecesPlaced,
    gameOver: isTerminal(board, hand),
  };
}

/** Start a game: deal the first hand onto the initial board. */
export function createGame(config: GameConfig, rng: Rng): GameState {
  const board = config.initialBoard ?? EMPTY_BOARD;
  const preDeal: GameState = {
    board,
    hand: [null, null, null],
    dealtHand: [0, 0, 0],
    score: 0,
    combo: 0,
    turn: 0,
    personalBest: config.personalBest ?? 0,
    placedInTurn: 0,
    linesClearedInTurn: 0,
    totalLinesCleared: 0,
    piecesPlaced: 0,
    gameOver: false,
  };
  const hand = config.generator.next(preDeal, rng);
  return freshState(board, hand, 0, preDeal);
}

/** Outcome of one placement. */
export interface PlaceOutcome {
  readonly state: GameState;
  readonly points: number;
  readonly linesCleared: number;
  readonly rowMask: number;
  readonly colMask: number;
}

/**
 * Place one piece from the tray (pure; does not deal). Throws on an illegal placement or
 * a piece not in the tray. Lines clear immediately; the combo and score update per the
 * scoring rule; `gameOver` is set if no remaining piece fits.
 */
export function placePiece(state: GameState, placement: Placement, scoring: ScoringRule): PlaceOutcome {
  if (state.gameOver) throw new Error('game is over');
  const slot = state.hand.indexOf(placement.shapeId);
  if (slot < 0) throw new Error(`shape ${placement.shapeId} is not in the tray`);
  const shape = getShape(placement.shapeId);
  const mask = placementAt(shape, placement.row, placement.col);
  if (mask === undefined) throw new RangeError(`anchor (${placement.row}, ${placement.col}) leaves the board for shape ${shape.id}`);
  if (((state.board.lo & mask.lo) | (state.board.hi & mask.hi)) !== 0) {
    throw new Error(`illegal placement of shape ${shape.id} at (${placement.row}, ${placement.col})`);
  }
  const result = placeUnchecked(state.board, mask);
  const rowsCleared = countBits8(result.rowMask);
  const colsCleared = countBits8(result.colMask);
  const scored = scoring.score({
    cellsPlaced: shape.size,
    linesCleared: result.linesCleared,
    rowsCleared,
    colsCleared,
    comboBefore: state.combo,
    boardEmptyAfter: isEmpty(result.board),
    fillAfter: fillCount(result.board),
  });
  const hand = state.hand.map((id, i) => (i === slot ? null : id)) as unknown as HandSlots;
  const remaining = hand.filter((id): id is ShapeId => id !== null);
  const next: GameState = {
    board: result.board,
    hand,
    dealtHand: state.dealtHand,
    score: state.score + scored.points,
    combo: scored.comboAfter,
    turn: state.turn,
    personalBest: state.personalBest,
    placedInTurn: state.placedInTurn + 1,
    linesClearedInTurn: state.linesClearedInTurn + result.linesCleared,
    totalLinesCleared: state.totalLinesCleared + result.linesCleared,
    piecesPlaced: state.piecesPlaced + 1,
    gameOver: remaining.length > 0 && isTerminal(result.board, remaining),
  };
  return { state: next, points: scored.points, linesCleared: result.linesCleared, rowMask: result.rowMask, colMask: result.colMask };
}

/** True iff every slot has been placed and a new hand is due. */
export function needsDeal(state: GameState): boolean {
  return !state.gameOver && state.hand.every((id) => id === null);
}

/** Deal the next hand (the tray must be empty). Increments `turn`; sets `gameOver` if nothing fits. */
export function dealHand(state: GameState, generator: Generator, rng: Rng): GameState {
  if (!needsDeal(state)) throw new Error('cannot deal: tray is not empty or game is over');
  const hand = generator.next(state, rng);
  return freshState(state.board, hand, state.turn + 1, state);
}

/** `placePiece` followed by `dealHand` when the tray empties. */
export function step(state: GameState, placement: Placement, config: GameConfig, rng: Rng): PlaceOutcome {
  const outcome = placePiece(state, placement, config.scoring);
  if (needsDeal(outcome.state)) {
    return { ...outcome, state: dealHand(outcome.state, config.generator, rng) };
  }
  return outcome;
}

function countBits8(x: number): number {
  let n = 0;
  for (let i = 0; i < 8; i++) n += (x >>> i) & 1;
  return n;
}
