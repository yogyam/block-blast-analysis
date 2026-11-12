import { describe, expect, it } from 'vitest';
import { GreedyAgent, HARD_SHAPE_IDS, TEN_TEN_POOL, UniformGenerator, playGames, seedRng } from '@blockblast/engine';
import { KillGenerator } from '../src/kill.ts';
import { GAME_HARD_PIECE_SET } from '../src/pools.ts';
import { EMPTY_BOARD, preDealState } from './helpers.ts';

function hardShare(ids: readonly number[], hard: ReadonlySet<number>): number {
  return ids.filter((id) => hard.has(id)).length / ids.length;
}

describe('KillGenerator', () => {
  it('raises the hard-piece share past the score threshold in simulated games', () => {
    const threshold = 30;
    const gen = new KillGenerator(new UniformGenerator(TEN_TEN_POOL), { scoreThreshold: threshold, hardBias: 4 });
    const logs = playGames(300, gen, new GreedyAgent(), seedRng(31));
    const before: number[] = [];
    const after: number[] = [];
    for (const g of logs) for (const t of g.turns) (t.score >= threshold ? after : before).push(...t.hand);
    expect(before.length).toBeGreaterThan(500);
    expect(after.length).toBeGreaterThan(500);
    const shareBefore = hardShare(before, GAME_HARD_PIECE_SET);
    const shareAfter = hardShare(after, GAME_HARD_PIECE_SET);
    console.log(`[kill] hard share before ${shareBefore.toFixed(3)} (expected ≈ ${(10 / 19).toFixed(3)}), after ${shareAfter.toFixed(3)} (expected ≈ ${(40 / 49).toFixed(3)})`);
    expect(shareBefore).toBeGreaterThan(10 / 19 - 0.06);
    expect(shareBefore).toBeLessThan(10 / 19 + 0.06);
    expect(shareAfter).toBeGreaterThan(shareBefore + 0.15);
  });

  it('supports thresholds relative to the personal best and a custom hard list', () => {
    const gen = new KillGenerator(new UniformGenerator(TEN_TEN_POOL), { scoreThreshold: { fractionOfBest: 0.5 }, hardBias: 50, hardIds: [...HARD_SHAPE_IDS] });
    expect([...gen.hardIds].sort((a, b) => a - b)).toEqual([...HARD_SHAPE_IDS].sort((a, b) => a - b));
    const rng = seedRng(2);
    gen.next(preDealState(EMPTY_BOARD, { score: 40, personalBest: 100 }), rng);
    expect(gen.serializeState()).toMatchObject({ deals: 1, killDeals: 0 });
    const ids: number[] = [];
    for (let i = 0; i < 300; i++) ids.push(...gen.next(preDealState(EMPTY_BOARD, { score: 60, personalBest: 100 }), rng));
    expect(gen.serializeState()).toMatchObject({ deals: 301, killDeals: 300 });
    expect(hardShare(ids, HARD_SHAPE_IDS)).toBeGreaterThan(0.9); // 7·50 / (7·50 + 12)
  });

  it('rejects a non-positive bias', () => {
    expect(() => new KillGenerator(new UniformGenerator(TEN_TEN_POOL), { scoreThreshold: 0, hardBias: 0 })).toThrow(RangeError);
  });
});
