/**
 * Run games and emit one row per dealt hand in the `06-methods.md` §10 schema (the fields a
 * simulator can know), plus `generator`, `generator_state_json` (the generator's serialised
 * state right after the deal) and `score_after` (score once the hand was played, so a game's
 * final score is the last row's `score_after`).
 */

import {
  DEFAULT_SCORING,
  GreedyAgent,
  RandomAgent,
  SCORING_RULES,
  playGame,
  seedRng,
  type Agent,
  type GameLog,
  type GameState,
  type Generator,
  type Hand,
  type Placement,
  type Rng,
  type ScoringRule,
  type ShapeId,
} from '@blockblast/engine';
import { buildGenerator, resolvePool, type GeneratorSpec } from '@blockblast/generators';

/** One JSONL row. */
export interface SimRow {
  readonly game_id: string;
  readonly turn_idx: number;
  readonly board_lo: number;
  readonly board_hi: number;
  readonly hand: [ShapeId, ShapeId, ShapeId];
  readonly is_terminal: boolean;
  readonly pieces_placed: number;
  readonly score: number;
  readonly personal_best: number;
  readonly combo_streak: number;
  readonly legal_moves_count: number;
  readonly chosen_placements: Placement[];
  readonly lines_cleared: number;
  readonly generator: string;
  readonly generator_state_json: string;
  readonly hand_solvable: boolean;
  readonly agent: string;
  readonly score_after: number;
}

/** Agents the CLI knows. */
export const AGENTS: Readonly<Record<string, () => Agent>> = {
  random: () => new RandomAgent(),
  greedy: () => new GreedyAgent(),
};

/** Options for {@link runSim}. */
export interface RunOptions {
  readonly generator: GeneratorSpec | string;
  readonly agent: string;
  readonly games: number;
  readonly seed: number | string;
  /** Pool name (see `POOLS` in `@blockblast/generators`) or explicit ids; default `live`. */
  readonly pool?: string | readonly ShapeId[];
  /** Scoring rule name (`unsupo`, `kittimzhe`, `cells-only`); default unsupo. */
  readonly scoring?: string;
  readonly personalBest?: number;
  readonly maxTurns?: number;
}

/** Totals returned by {@link runSim}. */
export interface RunResult {
  readonly games: number;
  readonly hands: number;
  readonly truncated: number;
  readonly generator: string;
  readonly agent: string;
  readonly scoring: string;
  readonly pool: readonly ShapeId[];
}

/** Wraps a generator and snapshots its serialised state after every deal. */
class RecordingGenerator implements Generator {
  readonly name: string;
  readonly pool: readonly ShapeId[] | undefined;
  readonly inner: Generator;
  states: string[] = [];

  constructor(inner: Generator) {
    this.inner = inner;
    this.name = inner.name;
    this.pool = inner.pool;
  }

  next(state: GameState, rng: Rng): Hand {
    const hand = this.inner.next(state, rng);
    this.states.push(JSON.stringify(this.inner.serializeState()));
    return hand;
  }

  reset(): void {
    this.inner.reset();
    this.states = [];
  }

  serializeState(): unknown {
    return this.inner.serializeState();
  }
}

function resolveScoring(name: string | undefined): ScoringRule {
  if (name === undefined) return DEFAULT_SCORING;
  const rule = SCORING_RULES[name];
  if (rule === undefined) throw new Error(`unknown scoring rule "${name}"; known: ${Object.keys(SCORING_RULES).join(', ')}`);
  return rule;
}

/** Rows of one finished game. */
export function rowsOf(log: GameLog, states: readonly string[], gameId: string, agent: string): SimRow[] {
  return log.turns.map((t, i) => ({
    game_id: gameId,
    turn_idx: t.turn_idx,
    board_lo: t.board_lo,
    board_hi: t.board_hi,
    hand: [t.hand[0], t.hand[1], t.hand[2]],
    is_terminal: t.is_terminal,
    pieces_placed: t.pieces_placed,
    score: t.score,
    personal_best: t.personal_best,
    combo_streak: t.combo_streak,
    legal_moves_count: t.legal_moves_count,
    chosen_placements: t.chosen_placements,
    lines_cleared: t.lines_cleared,
    generator: log.generator,
    generator_state_json: states[i] ?? 'null',
    hand_solvable: t.hand_solvable ?? false,
    agent,
    score_after: log.turns[i + 1]?.score ?? log.finalScore,
  }));
}

/**
 * Play `games` games with independent RNG forks of `seed` and hand each game's rows to `onGame`.
 * Deterministic for a given (generator spec, agent, pool, seed).
 */
export function runSim(opts: RunOptions, onGame: (rows: SimRow[], log: GameLog, index: number) => void): RunResult {
  if (!Number.isInteger(opts.games) || opts.games < 0) throw new RangeError('games must be a non-negative integer');
  const pool = typeof opts.pool === 'string' ? resolvePool(opts.pool) : (opts.pool ?? resolvePool('live'));
  const makeAgent = AGENTS[opts.agent];
  if (makeAgent === undefined) throw new Error(`unknown agent "${opts.agent}"; known: ${Object.keys(AGENTS).join(', ')}`);
  const agent = makeAgent();
  const scoring = resolveScoring(opts.scoring);
  const generator = new RecordingGenerator(buildGenerator(opts.generator, pool));
  const rng = seedRng(opts.seed);
  let hands = 0;
  let truncated = 0;
  for (let i = 0; i < opts.games; i++) {
    const log = playGame(generator, agent, rng.fork(), {
      scoring,
      oracle: true,
      pool,
      ...(opts.personalBest === undefined ? {} : { personalBest: opts.personalBest }),
      ...(opts.maxTurns === undefined ? {} : { maxTurns: opts.maxTurns }),
    });
    hands += log.turnCount;
    if (log.truncated) truncated++;
    onGame(rowsOf(log, generator.states, `${String(opts.seed)}-${i}`, agent.name), log, i);
  }
  return { games: opts.games, hands, truncated, generator: generator.name, agent: agent.name, scoring: scoring.name, pool };
}
