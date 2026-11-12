import { BeamSearchAgent, EpsilonGreedyAgent, playGames, seedRng, type Agent, type GameLog } from '@blockblast/engine';
import { buildGenerator, resolvePool, type GeneratorSpec } from '@blockblast/generators';
import { describe, expect, it } from 'vitest';
import { conditionalLogit } from '../src/clogit.ts';
import { groupByGame, recordsFromGameLogs } from '../src/dataset.ts';

const POOL = resolvePool('live');

function games(spec: GeneratorSpec | string, agent: Agent, n: number, seed: number) {
  const logs: GameLog[] = playGames(n, buildGenerator(spec, POOL), agent, seedRng(seed), {
    oracle: true,
    pool: POOL,
    personalBest: 1500,
    maxTurns: 6000,
  });
  return groupByGame(recordsFromGameLogs(logs));
}

function orOf(res: { features: readonly string[]; oddsRatio: readonly number[] }, name: string): number {
  const i = res.features.indexOf(name);
  if (i < 0) throw new Error(`feature ${name} was dropped`);
  return res.oddsRatio[i] as number;
}

describe('conditional logit (H1 primary, H3 companion)', () => {
  it('drops the all-zero seconds interaction (no timing in simulation)', () => {
    const r = conditionalLogit(games('uniform', new EpsilonGreedyAgent(0.3), 40, 10));
    expect(r.dropped).toContain('hardXseconds');
    expect(r.features).toContain('fitsAnywhere');
  });

  it('uniform dealer: β = 0 not rejected, board ORs near 1', () => {
    const r = conditionalLogit(games('uniform', new EpsilonGreedyAgent(0.3), 90, 1));
    expect(r.converged).toBe(true);
    expect(r.pValue).toBeGreaterThan(0.05);
    const fa = orOf(r, 'fitsAnywhere');
    expect(fa).toBeGreaterThan(0.6);
    expect(fa).toBeLessThan(1.7);
  });

  it('rescue: strong board dependence via the "fits anywhere" odds ratio (H1)', () => {
    const r = conditionalLogit(games({ name: 'rescue', opts: { fillThreshold: 0.5, strength: 1, fitBias: 8 } }, new EpsilonGreedyAgent(0.3), 90, 2));
    expect(r.pValue).toBeLessThan(1e-3);
    expect(orOf(r, 'fitsAnywhere')).toBeGreaterThan(2);
  });

  it('kill: hard-piece odds rise with score relative to best (H3)', () => {
    const hardIds = [13, 11, 22, 12, 21, 23, 24];
    const r = conditionalLogit(
      games({ name: 'kill', opts: { scoreThreshold: { fractionOfBest: 0.5 }, hardBias: 10, hardIds } }, new BeamSearchAgent(12), 55, 4),
    );
    expect(r.pValue).toBeLessThan(1e-3);
    expect(orOf(r, 'hardXscoreRelBest')).toBeGreaterThan(3);
  });
});
