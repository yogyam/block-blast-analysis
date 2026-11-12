import { EpsilonGreedyAgent, playGames, seedRng, type GameLog } from '@blockblast/engine';
import { buildGenerator, resolvePool, type GeneratorSpec } from '@blockblast/generators';
import { describe, expect, it } from 'vitest';
import { groupByGame, recordsFromGameLogs } from '../src/dataset.ts';
import { holm, benjaminiHochberg } from '../src/holm.ts';
import { handCompositionTests, slotBiasTest } from '../src/permutation.ts';
import { overdispersionTest } from '../src/overdispersion.ts';

const POOL = resolvePool('live');

function games(spec: GeneratorSpec | string, n: number, seed: number) {
  const logs: GameLog[] = playGames(n, buildGenerator(spec, POOL), new EpsilonGreedyAgent(0.3), seedRng(seed), {
    oracle: true,
    pool: POOL,
    personalBest: 1500,
    maxTurns: 6000,
  });
  return groupByGame(recordsFromGameLogs(logs));
}

describe('Holm and BH multiplicity', () => {
  it('Holm rejects the right prefix at alpha = 0.01', () => {
    const d = holm([{ key: 'a', p: 0.001 }, { key: 'b', p: 0.004 }, { key: 'c', p: 0.02 }, { key: 'd', p: 0.5 }], 0.01);
    const byKey = Object.fromEntries(d.map((x) => [x.key, x]));
    expect(byKey['a']?.reject).toBe(true); // 0.001 ≤ 0.01/4
    expect(byKey['b']?.reject).toBe(false); // 0.004 > 0.01/3 ⇒ stop
    expect(byKey['c']?.reject).toBe(false);
    expect(byKey['d']?.reject).toBe(false);
    expect(byKey['a']?.adjusted).toBeCloseTo(0.004, 6); // 4 × 0.001
  });
  it('BH flags discoveries at q = 0.05', () => {
    const d = benjaminiHochberg([{ key: 'a', p: 0.001 }, { key: 'b', p: 0.01 }, { key: 'c', p: 0.5 }], 0.05);
    const byKey = Object.fromEntries(d.map((x) => [x.key, x]));
    expect(byKey['a']?.reject).toBe(true);
    expect(byKey['c']?.reject).toBe(false);
  });
});

describe('hand-composition permutation tests (H5)', () => {
  it('uniform: omnibus not significant', () => {
    const r = handCompositionTests(games('uniform', 80, 1), 1000, 'u');
    expect(r.omnibusP).toBeGreaterThan(0.05);
  });
  it('bag: omnibus significant (few within-hand duplicates)', () => {
    const r = handCompositionTests(games('bag', 80, 2), 1000, 'b');
    expect(r.omnibusP).toBeLessThan(0.01);
    expect(r.duplicate.statistic).toBeLessThan(r.duplicate.nullMean); // fewer duplicates than independence
  });
  it('slot-biased: the slot-position statistic is strongly negative', () => {
    const r = slotBiasTest(games('slot-biased', 80, 3), 1000, seedRng('s'));
    expect(r.p).toBeLessThan(0.01);
    expect(r.statistic).toBeLessThan(r.nullMean); // slot 0 smaller than slot 2
  });
});

describe('overdispersion (H6 companion)', () => {
  it('uniform: not overdispersed', () => {
    const r = overdispersionTest(games('uniform', 80, 4), 1000, seedRng('o1'));
    expect(r.p).toBeGreaterThan(0.05);
  });
  it('per-game-difficulty: overdispersed', () => {
    const r = overdispersionTest(games({ name: 'per-game-difficulty', opts: { levels: [0.4, 1, 3, 6] } }, 90, 5), 1000, seedRng('o2'));
    expect(r.p).toBeLessThan(0.01);
    expect(r.statistic).toBeGreaterThan(r.nullMean);
  });
});
