/**
 * Run whole games and log them in the per-hand schema of `06-methods.md` §10 (the fields the
 * simulator can know; capture-only fields such as `ad_ecpm` are added by the capture package).
 */

import type { Board } from './board.ts';
import type { Rng } from './rng.ts';
import { countLegalMoves, createGame, DEFAULT_SCORING, dealHand, placePiece, remainingHand, type GameConfig, type ScoringRule } from './rules.ts';
import { DEFAULT_POOL, type ShapeId } from './shapes.ts';
import { createSolvabilityCache, isHandSolvable, type SolvabilityCache } from './solvability.ts';
import type { Agent, GameState, Generator, Hand, Placement } from './types.ts';

/** One dealt hand, logged at deal time plus what the player then did with it. */
export interface TurnLog {
  /** Index of the hand within the game, 0-based. */
  readonly turn_idx: number;
  /** Board words at the moment of dealing. */
  readonly board_lo: number;
  readonly board_hi: number;
  /** The dealt triple, slot order left to right. */
  readonly hand: Hand;
  /** No piece of this hand can be placed (at deal time). */
  readonly is_terminal: boolean;
  /** Pre-deal values. */
  readonly score: number;
  readonly personal_best: number;
  readonly combo_streak: number;
  /** Legal (piece, anchor) pairs at deal time, duplicate ids counted once. */
  readonly legal_moves_count: number;
  /** What the player did with this hand, in order. */
  readonly chosen_placements: Placement[];
  /** Lines cleared by this hand. */
  lines_cleared: number;
  /** Pieces of this hand actually placed (3 unless the game ended mid-hand). */
  pieces_placed: number;
  /** Oracle: the hand could be fully placed in some order (D_t = !hand_solvable). Only when requested. */
  readonly hand_solvable?: boolean;
}

/** A finished (or truncated) game. */
export interface GameLog {
  readonly turns: TurnLog[];
  readonly finalScore: number;
  /** Number of hands dealt, including the terminal one. */
  readonly turnCount: number;
  readonly piecesPlaced: number;
  readonly totalLinesCleared: number;
  /** True if the game ended because `maxTurns` was reached, not by a terminal position. */
  readonly truncated: boolean;
  /** True if the game ended after placing some but not all of the last hand. */
  readonly endedMidHand: boolean;
  readonly generator: string;
  readonly agent: string;
  readonly scoring: string;
  readonly finalState: GameState;
}

/** Options for {@link playGame}. */
export interface PlayOptions {
  /** Scoring rule; default {@link DEFAULT_SCORING} (UnsupoScoring), an unconfirmed candidate. */
  readonly scoring?: ScoringRule;
  /** Stop after this many hands; default 10,000. */
  readonly maxTurns?: number;
  readonly initialBoard?: Board;
  readonly personalBest?: number;
  /** Pool for the agent context; default the generator's pool, else {@link DEFAULT_POOL}. */
  readonly pool?: readonly ShapeId[];
  /** Also log `hand_solvable` per hand via the oracle. Off by default (costs a search per hand). */
  readonly oracle?: boolean;
  /** Memo shared with the oracle across games. */
  readonly memo?: SolvabilityCache;
}

const DEFAULT_MAX_TURNS = 10_000;

/**
 * Play one game to its natural end (or `maxTurns`). Throws if the agent returns `null`
 * while legal moves exist.
 */
export function playGame(generator: Generator, agent: Agent, rng: Rng, opts: PlayOptions = {}): GameLog {
  const scoring = opts.scoring ?? DEFAULT_SCORING;
  const config: GameConfig = {
    generator,
    scoring,
    ...(opts.initialBoard === undefined ? {} : { initialBoard: opts.initialBoard }),
    ...(opts.personalBest === undefined ? {} : { personalBest: opts.personalBest }),
  };
  const pool = opts.pool ?? generator.pool ?? DEFAULT_POOL;
  const maxTurns = opts.maxTurns ?? DEFAULT_MAX_TURNS;
  const memo = opts.oracle ? (opts.memo ?? createSolvabilityCache()) : undefined;

  generator.reset();
  let state = createGame(config, rng);
  const turns: TurnLog[] = [];
  let truncated = false;

  for (;;) {
    const log = startTurn(state, memo);
    turns.push(log);
    if (state.gameOver) break;

    while (!state.gameOver) {
      const remaining = remainingHand(state);
      if (remaining.length === 0) break;
      const placement = agent.choose(state.board, remaining, { rng, state, pool });
      if (placement === null) {
        throw new Error(`agent ${agent.name} returned null with legal moves available (turn ${state.turn})`);
      }
      const outcome = placePiece(state, placement, scoring);
      log.chosen_placements.push(placement);
      log.lines_cleared += outcome.linesCleared;
      log.pieces_placed += 1;
      state = outcome.state;
    }
    if (state.gameOver) break;
    if (turns.length >= maxTurns) {
      truncated = true;
      break;
    }
    state = dealHand(state, generator, rng);
  }

  const last = turns[turns.length - 1];
  return {
    turns,
    finalScore: state.score,
    turnCount: turns.length,
    piecesPlaced: state.piecesPlaced,
    totalLinesCleared: state.totalLinesCleared,
    truncated,
    endedMidHand: !truncated && last !== undefined && last.pieces_placed > 0,
    generator: generator.name,
    agent: agent.name,
    scoring: scoring.name,
    finalState: state,
  };
}

function startTurn(state: GameState, memo: SolvabilityCache | undefined): TurnLog {
  const base = {
    turn_idx: state.turn,
    board_lo: state.board.lo,
    board_hi: state.board.hi,
    hand: state.dealtHand,
    is_terminal: state.gameOver,
    score: state.score,
    personal_best: state.personalBest,
    combo_streak: state.combo,
    legal_moves_count: countLegalMoves(state.board, state.dealtHand),
    chosen_placements: [] as Placement[],
    lines_cleared: 0,
    pieces_placed: 0,
  };
  if (memo === undefined) return base;
  return { ...base, hand_solvable: state.gameOver ? false : isHandSolvable(state.board, state.dealtHand, memo) };
}

/** Aggregate statistics over many games. */
export interface GamesSummary {
  readonly games: number;
  readonly meanTurns: number;
  readonly sdTurns: number;
  readonly minTurns: number;
  readonly maxTurns: number;
  readonly meanScore: number;
  readonly meanPiecesPlaced: number;
  readonly truncated: number;
  readonly endedMidHand: number;
}

/** Summarise a batch of game logs. */
export function summarizeGames(logs: readonly GameLog[]): GamesSummary {
  const n = logs.length;
  if (n === 0) throw new Error('no games to summarise');
  let sumT = 0;
  let sumT2 = 0;
  let sumS = 0;
  let sumP = 0;
  let minT = Infinity;
  let maxT = -Infinity;
  let truncated = 0;
  let mid = 0;
  for (const g of logs) {
    sumT += g.turnCount;
    sumT2 += g.turnCount * g.turnCount;
    sumS += g.finalScore;
    sumP += g.piecesPlaced;
    minT = Math.min(minT, g.turnCount);
    maxT = Math.max(maxT, g.turnCount);
    if (g.truncated) truncated++;
    if (g.endedMidHand) mid++;
  }
  const meanTurns = sumT / n;
  const variance = Math.max(0, sumT2 / n - meanTurns * meanTurns);
  return {
    games: n,
    meanTurns,
    sdTurns: Math.sqrt(variance),
    minTurns: minT,
    maxTurns: maxT,
    meanScore: sumS / n,
    meanPiecesPlaced: sumP / n,
    truncated,
    endedMidHand: mid,
  };
}

/** Play `n` games with independent forks of `rng`. */
export function playGames(n: number, generator: Generator, agent: Agent, rng: Rng, opts: PlayOptions = {}): GameLog[] {
  const logs: GameLog[] = [];
  for (let i = 0; i < n; i++) logs.push(playGame(generator, agent, rng.fork(), opts));
  return logs;
}
