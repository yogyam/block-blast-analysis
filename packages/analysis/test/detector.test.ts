import { BeamSearchAgent, EpsilonGreedyAgent, playGames, seedRng, type Agent, type GameLog } from '@blockblast/engine';
import { buildGenerator, resolvePool, type GeneratorSpec } from '@blockblast/generators';
import { describe, expect, it } from 'vitest';
import { groupByGame, recordsFromGameLogs } from '../src/dataset.ts';
import { runDetector } from '../src/detector.ts';

const POOL = resolvePool('live');
const DET = { permutations: 500, samples: 4000 } as const;

function games(spec: GeneratorSpec | string, agent: Agent, n: number, seed: number) {
  const logs: GameLog[] = playGames(n, buildGenerator(spec, POOL), agent, seedRng(seed), {
    oracle: true,
    pool: POOL,
    personalBest: 1500,
    maxTurns: 6000,
  });
  return groupByGame(recordsFromGameLogs(logs));
}

const eps = () => new EpsilonGreedyAgent(0.3);

describe('runDetector: mechanism attribution (06-methods §7 criterion 3)', () => {
  it('uniform: nothing rejected; H7/H8 not run on simulated data', () => {
    const report = runDetector(games('uniform', eps(), 80, 1), { seed: 'u', ...DET });
    expect(report.rejected).toEqual([]);
    expect(report.hypotheses.find((h) => h.id === 'H7')?.ran).toBe(false);
    expect(report.hypotheses.find((h) => h.id === 'H8')?.ran).toBe(false);
  });

  it('rescue: lights H1, H2, H4 (and not H3/H5/H6)', () => {
    const report = runDetector(games({ name: 'rescue', opts: { fillThreshold: 0.5, strength: 1, fitBias: 8 } }, eps(), 90, 2), { seed: 'r', ...DET });
    expect(report.rejected).toEqual(expect.arrayContaining(['H1', 'H2', 'H4']));
    expect(report.rejected).not.toContain('H3');
    expect(report.rejected).not.toContain('H6');
  });

  it('lethal: lights H4 with the lethal direction (statistic < 0)', () => {
    const report = runDetector(games({ name: 'lethal', opts: { probability: 0.6 } }, eps(), 70, 3), { seed: 'l', ...DET });
    expect(report.rejected).toContain('H4');
    expect(report.hypotheses.find((h) => h.id === 'H4')?.statistic).toBeLessThan(0);
  });

  it('kill: lights H1 and H3 (not H5/H6)', () => {
    const hardIds = [13, 11, 22, 12, 21, 23, 24];
    const report = runDetector(
      games({ name: 'kill', opts: { scoreThreshold: { fractionOfBest: 0.5 }, hardBias: 10, hardIds } }, new BeamSearchAgent(12), 80, 4),
      { seed: 'k', ...DET },
    );
    expect(report.rejected).toEqual(expect.arrayContaining(['H1', 'H3']));
    expect(report.rejected).not.toContain('H5');
    expect(report.rejected).not.toContain('H6');
  });

  it('bag: lights H5 only', () => {
    const report = runDetector(games('bag', eps(), 80, 5), { seed: 'b', ...DET });
    expect(report.rejected).toContain('H5');
    expect(report.rejected).not.toContain('H1');
    expect(report.rejected).not.toContain('H4');
  });

  it('per-game-difficulty: lights H6', () => {
    const report = runDetector(games({ name: 'per-game-difficulty', opts: { levels: [0.4, 1, 3, 6] } }, eps(), 90, 6), { seed: 'p', ...DET });
    expect(report.rejected).toContain('H6');
  });
});
