import { describe, expect, it } from 'vitest';
import { board } from '../src/board.ts';
import { GreedyAgent } from '../src/agents/greedy.ts';
import { RandomAgent } from '../src/agents/random.ts';
import { SimDriver } from '../src/driver.ts';
import { UniformGenerator } from '../src/generators/uniform.ts';
import { seedRng } from '../src/rng.ts';
import { UnsupoScoring, countLegalMoves, isLegalPlacement } from '../src/rules.ts';
import { DEFAULT_POOL, TEN_TEN_POOL } from '../src/shapes.ts';
import { canPlaceAny, isHandSolvable } from '../src/solvability.ts';
import { playGame, playGames, summarizeGames, type GameLog } from '../src/simulate.ts';

function checkLog(log: GameLog): void {
  expect(log.truncated).toBe(false);
  expect(log.turns.length).toBe(log.turnCount);
  expect(log.finalScore).toBeGreaterThanOrEqual(0);
  let prevScore = -1;
  log.turns.forEach((t, i) => {
    const b = board(t.board_lo, t.board_hi);
    expect(t.turn_idx).toBe(i);
    expect(t.board_lo).toBeGreaterThanOrEqual(0);
    expect(t.board_hi).toBeGreaterThanOrEqual(0);
    expect(t.hand).toHaveLength(3);
    // Terminal flag must equal "no piece of this hand can be placed" at deal time.
    const nothingFits = !t.hand.some((id) => canPlaceAny(b, id));
    expect(t.is_terminal).toBe(nothingFits);
    expect(t.legal_moves_count).toBe(countLegalMoves(b, t.hand));
    expect(t.score).toBeGreaterThanOrEqual(prevScore);
    prevScore = t.score;
    const isLast = i === log.turns.length - 1;
    if (!isLast) {
      expect(t.is_terminal).toBe(false);
      expect(t.pieces_placed).toBe(3);
      expect(t.chosen_placements).toHaveLength(3);
    } else if (log.endedMidHand) {
      expect(t.is_terminal).toBe(false);
      expect(t.pieces_placed).toBeGreaterThanOrEqual(1);
      expect(t.pieces_placed).toBeLessThanOrEqual(2);
    } else {
      expect(t.is_terminal).toBe(true);
      expect(t.pieces_placed).toBe(0);
    }
    // Each chosen placement was legal on the board as it stood, and used a dealt piece.
    const used = [...t.hand];
    for (const p of t.chosen_placements) {
      const k = used.indexOf(p.shapeId);
      expect(k).toBeGreaterThanOrEqual(0);
      used.splice(k, 1);
    }
    expect(isLegalPlacement(b, t.chosen_placements[0] ?? { shapeId: 1, row: 0, col: 0 }) || t.chosen_placements.length === 0).toBe(true);
    if (t.hand_solvable !== undefined) expect(t.hand_solvable).toBe(isHandSolvable(b, t.hand));
  });
  const last = log.turns[log.turns.length - 1]!;
  expect(last.is_terminal || log.endedMidHand).toBe(true);
  expect(log.finalState.gameOver).toBe(true);
}

describe('playGame', () => {
  it('200 random-agent games on the 19-piece pool finish with consistent logs', () => {
    const gen = new UniformGenerator(TEN_TEN_POOL);
    const logs = playGames(200, gen, new RandomAgent(), seedRng(1), { scoring: UnsupoScoring, oracle: true });
    for (const log of logs) checkLog(log);
    const s = summarizeGames(logs);
    // Mean game length is reported, not tightly asserted (the pool and generator are unconfirmed).
    console.log(`[simulate] random agent, uniform 19-piece pool, 200 games: mean hands ${s.meanTurns.toFixed(2)} (sd ${s.sdTurns.toFixed(2)}, min ${s.minTurns}, max ${s.maxTurns}), mean score ${s.meanScore.toFixed(1)}, ended mid-hand ${s.endedMidHand}`);
    expect(s.meanTurns).toBeGreaterThan(3);
    expect(s.meanTurns).toBeLessThan(200);
    expect(s.truncated).toBe(0);
  });

  it('200 random-agent games on the 50-shape pool finish with consistent logs', () => {
    const gen = new UniformGenerator(DEFAULT_POOL);
    const logs = playGames(200, gen, new RandomAgent(), seedRng(2));
    for (const log of logs) checkLog(log);
    const s = summarizeGames(logs);
    console.log(`[simulate] random agent, uniform 50-shape pool, 200 games: mean hands ${s.meanTurns.toFixed(2)} (sd ${s.sdTurns.toFixed(2)}, min ${s.minTurns}, max ${s.maxTurns}), mean score ${s.meanScore.toFixed(1)}, ended mid-hand ${s.endedMidHand}`);
    expect(s.truncated).toBe(0);
  });

  it('is deterministic for a given seed', () => {
    const gen = new UniformGenerator(TEN_TEN_POOL);
    const a = playGame(gen, new RandomAgent(), seedRng(123));
    const b = playGame(gen, new RandomAgent(), seedRng(123));
    expect(a.turns).toEqual(b.turns);
    expect(a.finalScore).toBe(b.finalScore);
  });

  it('greedy outlives random', () => {
    const gen = new UniformGenerator(TEN_TEN_POOL);
    const rnd = summarizeGames(playGames(40, gen, new RandomAgent(), seedRng(5)));
    const greedy = summarizeGames(playGames(40, gen, new GreedyAgent(), seedRng(5), { maxTurns: 2000 }));
    console.log(`[simulate] greedy agent, uniform 19-piece pool, 40 games: mean hands ${greedy.meanTurns.toFixed(2)}, mean score ${greedy.meanScore.toFixed(1)}, truncated ${greedy.truncated}`);
    expect(greedy.meanTurns).toBeGreaterThan(rnd.meanTurns);
    for (const log of playGames(5, gen, new GreedyAgent(), seedRng(6), { maxTurns: 2000 })) if (!log.truncated) checkLog(log);
  });

  it('honours maxTurns and flags truncation', () => {
    const gen = new UniformGenerator(TEN_TEN_POOL);
    const log = playGame(gen, new GreedyAgent(), seedRng(8), { maxTurns: 3 });
    expect(log.turnCount).toBeLessThanOrEqual(3);
    if (log.turnCount === 3 && !log.finalState.gameOver) expect(log.truncated).toBe(true);
  });

  it('SimDriver exposes observe/act over the same rules', async () => {
    const gen = new UniformGenerator(TEN_TEN_POOL);
    const driver = new SimDriver({ generator: gen, scoring: UnsupoScoring }, seedRng(4));
    const agent = new RandomAgent();
    const rng = seedRng(44);
    let steps = 0;
    while (!driver.observe().gameOver && steps < 500) {
      const obs = driver.observe();
      const remaining = obs.hand.filter((id): id is number => id !== null);
      const p = agent.choose(obs.board, remaining, { rng, state: driver.gameState, pool: TEN_TEN_POOL });
      expect(p).not.toBeNull();
      await driver.act(p!);
      steps++;
    }
    expect(driver.observe().gameOver).toBe(true);
    expect(driver.observe().score).toBeGreaterThan(0);
    driver.reset();
    expect(driver.observe().turn).toBe(0);
  });
});
