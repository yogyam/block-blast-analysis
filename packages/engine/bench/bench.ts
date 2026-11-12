/**
 * Micro-benchmark (not a test). Run with `pnpm --filter @blockblast/engine bench`.
 * Reports fit-checks per second, fits-set evaluations per second, hand-solvability
 * oracle calls per second, and games per second for the built-in agents.
 */

import { canPlace, type Board, board } from '../src/board.ts';
import { GreedyAgent } from '../src/agents/greedy.ts';
import { RandomAgent } from '../src/agents/random.ts';
import { UniformGenerator } from '../src/generators/uniform.ts';
import { pHandSolvable, uniformWeights } from '../src/nullprobs.ts';
import { seedRng, type Rng } from '../src/rng.ts';
import { DEFAULT_POOL, TEN_TEN_POOL, getShape, type ShapeId } from '../src/shapes.ts';
import { createSolvabilityCache, fitsAnywhereSet, isHandSolvable } from '../src/solvability.ts';
import { playGames, summarizeGames } from '../src/simulate.ts';
import type { Agent, Hand } from '../src/types.ts';

function randomBoard(rng: Rng, fill: number): Board {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 32; i++) if (rng.next() < fill) lo |= 1 << i;
  for (let i = 0; i < 32; i++) if (rng.next() < fill) hi |= 1 << i;
  return board(lo, hi);
}

function randomHand(rng: Rng, pool: readonly ShapeId[]): Hand {
  const pick = (): ShapeId => pool[rng.nextInt(pool.length)] as ShapeId;
  return [pick(), pick(), pick()];
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function benchFitChecks(): void {
  const rng = seedRng(1);
  const boards = Array.from({ length: 2000 }, () => randomBoard(rng, 0.3 + 0.5 * rng.next()));
  const shapes = DEFAULT_POOL.map((id) => getShape(id));
  let checks = 0;
  let hits = 0;
  const t0 = performance.now();
  for (let rep = 0; rep < 5; rep++) {
    for (const b of boards) {
      for (const s of shapes) {
        for (const p of s.placements) {
          checks++;
          if (canPlace(b, p)) hits++;
        }
      }
    }
  }
  const dt = (performance.now() - t0) / 1000;
  console.log(`fit checks:            ${fmt(checks / dt)} /s  (${fmt(checks)} checks, ${((100 * hits) / checks).toFixed(1)}% legal)`);

  let sets = 0;
  const t1 = performance.now();
  for (let rep = 0; rep < 10; rep++) for (const b of boards) { fitsAnywhereSet(b, DEFAULT_POOL); sets++; }
  const dt1 = (performance.now() - t1) / 1000;
  console.log(`fitsAnywhereSet (50):  ${fmt(sets / dt1)} /s`);
}

function benchOracle(): void {
  const rng = seedRng(2);
  const cases = Array.from({ length: 3000 }, () => ({ b: randomBoard(rng, 0.4 + 0.5 * rng.next()), h: randomHand(rng, DEFAULT_POOL) }));
  const memo = createSolvabilityCache();
  let solvable = 0;
  const t0 = performance.now();
  for (const { b, h } of cases) if (isHandSolvable(b, h, memo)) solvable++;
  const dt = (performance.now() - t0) / 1000;
  console.log(`isHandSolvable:        ${fmt(cases.length / dt)} /s  (${((100 * solvable) / cases.length).toFixed(1)}% solvable, fill 40–90%)`);

  const w19 = uniformWeights(TEN_TEN_POOL);
  const w50 = uniformWeights(DEFAULT_POOL);
  let exact = 0;
  let evals = 0;
  const t1 = performance.now();
  let n = 0;
  for (let i = 0; i < 200; i++) {
    const b = randomBoard(rng, 0.6 + 0.3 * rng.next());
    const r = pHandSolvable(b, w19, { rng, samples: 5000 });
    n++;
    evals += r.evaluations;
    if (r.exact) exact++;
  }
  const dt1 = (performance.now() - t1) / 1000;
  console.log(`pHandSolvable (19):    ${fmt(n / dt1)} /s  (${exact}/${n} exact, ${fmt(evals / n)} evaluations each, fill 60–90%)`);

  exact = 0;
  evals = 0;
  n = 0;
  const t2 = performance.now();
  for (let i = 0; i < 50; i++) {
    const b = randomBoard(rng, 0.6 + 0.3 * rng.next());
    const r = pHandSolvable(b, w50, { rng, samples: 5000 });
    n++;
    evals += r.evaluations;
    if (r.exact) exact++;
  }
  const dt2 = (performance.now() - t2) / 1000;
  console.log(`pHandSolvable (50):    ${fmt(n / dt2)} /s  (${exact}/${n} exact, ${fmt(evals / n)} evaluations each, fill 60–90%)`);
}

function benchGames(agent: Agent, pool: readonly ShapeId[], label: string, games: number): void {
  const gen = new UniformGenerator(pool);
  const t0 = performance.now();
  const logs = playGames(games, gen, agent, seedRng(3), { maxTurns: 5000 });
  const dt = (performance.now() - t0) / 1000;
  const s = summarizeGames(logs);
  const hands = logs.reduce((a, g) => a + g.turnCount, 0);
  console.log(`${label.padEnd(22)} ${fmt(games / dt)} games/s, ${fmt(hands / dt)} hands/s  (mean ${s.meanTurns.toFixed(1)} hands, mean score ${fmt(s.meanScore)}, truncated ${s.truncated})`);
}

console.log('@blockblast/engine micro-benchmark');
console.log(`node ${process.version}`);
benchFitChecks();
benchOracle();
benchGames(new RandomAgent(), TEN_TEN_POOL, 'random / 19-pool:', 2000);
benchGames(new RandomAgent(), DEFAULT_POOL, 'random / 50-pool:', 2000);
benchGames(new GreedyAgent(), TEN_TEN_POOL, 'greedy / 19-pool:', 50);
benchGames(new GreedyAgent(), DEFAULT_POOL, 'greedy / 50-pool:', 50);
