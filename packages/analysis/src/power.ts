/**
 * Simulation-based power (`06-methods.md` §6): for a generator, agent and target hypothesis,
 * the fraction of replicates in which the target is Holm-rejected, as a function of the number
 * of games. These curves set the data-collection targets.
 */

import { playGames, seedRng, type GameLog } from '@blockblast/engine';
import { buildGenerator, resolvePool, type GeneratorSpec } from '@blockblast/generators';
import { makeAgent } from './agents.ts';
import { groupByGame, recordsFromGameLogs } from './dataset.ts';
import { runDetector, type DetectorOptions } from './detector.ts';

/** Power-curve configuration. */
export interface PowerConfig {
  readonly generator: GeneratorSpec | string;
  readonly agent: string;
  /** Game counts to evaluate. */
  readonly gamesList: readonly number[];
  readonly replicates: number;
  /** Hypothesis whose rejection is "success" (e.g. 'H4'). */
  readonly target: string;
  readonly pool?: string;
  readonly personalBest?: number;
  readonly maxTurns?: number;
  readonly seed?: number | string;
  readonly detector?: DetectorOptions;
}

/** One point of a power curve. */
export interface PowerPoint {
  readonly games: number;
  /** Fraction of replicates rejecting the target hypothesis at Holm α. */
  readonly power: number;
  /** Mean hands per replicate (the realised sample size). */
  readonly meanHands: number;
}

/** Compute the power curve for the target hypothesis. */
export function powerCurve(cfg: PowerConfig): PowerPoint[] {
  const pool = resolvePool(cfg.pool ?? 'live');
  const out: PowerPoint[] = [];
  for (const games of cfg.gamesList) {
    let rejects = 0;
    let hands = 0;
    for (let r = 0; r < cfg.replicates; r++) {
      const generator = buildGenerator(cfg.generator, pool);
      const agent = makeAgent(cfg.agent);
      const rng = seedRng(`${String(cfg.seed ?? 'power')}|${games}|${r}`);
      const logs: GameLog[] = playGames(games, generator, agent, rng, {
        oracle: true,
        pool,
        personalBest: cfg.personalBest ?? 1500,
        maxTurns: cfg.maxTurns ?? 6000,
      });
      const grouped = groupByGame(recordsFromGameLogs(logs));
      hands += logs.reduce((a, l) => a + l.turnCount, 0);
      const report = runDetector(grouped, { seed: `${games}|${r}`, ...cfg.detector });
      if (report.rejected.includes(cfg.target)) rejects++;
    }
    out.push({ games, power: rejects / cfg.replicates, meanHands: hands / cfg.replicates });
  }
  return out;
}
