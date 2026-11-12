import {
  BeamSearchAgent,
  EpsilonGreedyAgent,
  GreedyAgent,
  playGames,
  RandomAgent,
  seedRng,
  type Agent,
  type GameLog,
} from '@blockblast/engine';
import { buildGenerator, resolvePool, type GeneratorSpec } from '@blockblast/generators';
import { describe, expect, it } from 'vitest';
import { cumulativeHazard } from '../src/hazard.ts';
import { estimateWeights, groupByGame, recordsFromGameLogs } from '../src/dataset.ts';
import { hasHardTerms, martingaleZ, nearFull, nearRecord, notPlaceableTerms, someFitsTerms } from '../src/martingale.ts';
import { NullModel } from '../src/nullmodel.ts';

const POOL = resolvePool('live');

function makeAgent(name: string): Agent {
  switch (name) {
    case 'random':
      return new RandomAgent();
    case 'greedy':
      return new GreedyAgent();
    case 'epsilon':
      return new EpsilonGreedyAgent(0.3);
    case 'beam':
      return new BeamSearchAgent(12);
    default:
      throw new Error(`unknown agent ${name}`);
  }
}

function simulate(spec: GeneratorSpec | string, agent: string, games: number, seed: number, personalBest = 2500): GameLog[] {
  const generator = buildGenerator(spec, POOL);
  return playGames(games, generator, makeAgent(agent), seedRng(seed), { oracle: true, pool: POOL, personalBest, maxTurns: 6000 });
}

function dataset(logs: GameLog[]) {
  const records = recordsFromGameLogs(logs);
  const model = new NullModel(estimateWeights(records), { rng: seedRng('nm'), samples: 3000 });
  return { records, games: groupByGame(records), model };
}

describe('martingale + hazard calibration under the null', () => {
  it('uniform dealer: no large D/fits signal; mean Λ matches observed deaths (martingale identity)', () => {
    const { games, model } = dataset(simulate('uniform', 'epsilon', 80, 1));
    const fits = martingaleZ(someFitsTerms(games, model, nearFull(0.6)));
    const d = martingaleZ(notPlaceableTerms(games, model));
    const haz = cumulativeHazard(games, model);
    expect(Math.abs(fits.z)).toBeLessThan(3.5);
    expect(Math.abs(d.z)).toBeLessThan(3.5);
    // E[Σ h] = E[Σ D] for any agent: Λ tracks observed deaths, not the optimal-player value 1.
    expect(Math.abs(haz.meanLambda - haz.meanObservedDeaths)).toBeLessThan(0.3);
  });

  it('weighted (non-uniform, fixed) negative control: no rescue/lethal signal', () => {
    const weights: Record<number, number> = {};
    POOL.forEach((id, i) => (weights[id] = 1 + (i % 4)));
    const { games, model } = dataset(simulate({ name: 'weighted', opts: { weights } }, 'epsilon', 80, 5));
    const fits = martingaleZ(someFitsTerms(games, model, nearFull(0.6)));
    const d = martingaleZ(notPlaceableTerms(games, model));
    expect(Math.abs(fits.z)).toBeLessThan(3.5);
    expect(Math.abs(d.z)).toBeLessThan(3.5);
  });
});

describe('the detector math recovers each mechanism (06-methods §7 confusion matrix)', () => {
  it('rescue: near-full "some fits" Z > 0, "not placeable" Z < 0, Λ > observed deaths', () => {
    const { games, model } = dataset(simulate({ name: 'rescue', opts: { fillThreshold: 0.5, strength: 1 } }, 'epsilon', 90, 2));
    const fits = martingaleZ(someFitsTerms(games, model, nearFull(0.6)));
    const d = martingaleZ(notPlaceableTerms(games, model));
    const haz = cumulativeHazard(games, model);
    expect(fits.z).toBeGreaterThan(2.5);
    expect(d.z).toBeLessThan(-2);
    expect(haz.meanLambda).toBeGreaterThan(haz.meanObservedDeaths);
  });

  it('lethal: "not placeable" Z > 0, Λ < observed deaths', () => {
    const { games, model } = dataset(simulate({ name: 'lethal', opts: { probability: 0.6 } }, 'epsilon', 60, 3));
    const d = martingaleZ(notPlaceableTerms(games, model));
    const haz = cumulativeHazard(games, model);
    expect(d.z).toBeGreaterThan(2.5);
    expect(haz.meanLambda).toBeLessThan(haz.meanObservedDeaths);
  });

  it('kill: near-record hard-piece Z > 0', () => {
    // Beam reaches high scores (p90 ~1900), so the near-record tail is populated; baseline turns
    // dominate, so the plug-in F stays near-unbiased and the kill bias shows as Z > 0.
    const hardIds = [13, 11, 22, 12, 21, 23, 24];
    const { games, model } = dataset(
      simulate({ name: 'kill', opts: { scoreThreshold: { fractionOfBest: 0.5 }, hardBias: 10, hardIds } }, 'beam', 55, 4, 1500),
    );
    const terms = hasHardTerms(games, model, nearRecord(0.5));
    expect(terms.length).toBeGreaterThan(30); // the near-record stratum is populated
    const hard = martingaleZ(terms);
    expect(hard.z).toBeGreaterThan(2.5);
  });
});
