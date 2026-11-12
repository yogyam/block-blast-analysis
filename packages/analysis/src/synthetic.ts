/**
 * The synthetic validation protocol (`06-methods.md` §7): run the detector on data from known
 * generators and check it is calibrated under the nulls and powered against the adaptive
 * dealers, with a mechanism-attribution confusion matrix. This must pass before the detector
 * touches real data.
 *
 * A condition is (generator spec, agent, expected hypotheses, is-null). For each condition we
 * run `replicates` independent simulations of `games` games, run the detector, and record which
 * hypotheses were Holm-rejected. We then report, per condition: the rejection rate of each
 * hypothesis (the confusion-matrix row), and for nulls the family-wise false-positive rate and
 * the KS-uniformity of each hypothesis's p-values.
 */

import { playGames, seedRng, type GameLog } from '@blockblast/engine';
import { buildGenerator, resolvePool, type GeneratorSpec } from '@blockblast/generators';
import { makeAgent } from './agents.ts';
import { groupByGame, recordsFromGameLogs } from './dataset.ts';
import { runDetector, type DetectorOptions } from './detector.ts';
import { ksTestUniform } from './stats.ts';

/** One validation condition. */
export interface Condition {
  readonly label: string;
  readonly generator: GeneratorSpec | string;
  readonly agent: string;
  /** Hypotheses expected to reject (e.g. ['H2','H4']); empty for a null/negative control. */
  readonly expect: readonly string[];
  readonly isNull: boolean;
}

/** Validation run configuration. */
export interface ValidationConfig {
  readonly conditions: readonly Condition[];
  readonly replicates: number;
  readonly games: number;
  readonly pool?: string;
  readonly personalBest?: number;
  readonly maxTurns?: number;
  readonly seed?: number | string;
  readonly detector?: DetectorOptions;
}

/** Per-hypothesis outcome within a condition. */
export interface HypStat {
  readonly id: string;
  /** Fraction of replicates that Holm-rejected this hypothesis. */
  readonly rejectRate: number;
  /** KS p-value that this hypothesis's p-values are uniform (nulls only; else undefined). */
  readonly ksUniformP?: number;
}

/** Per-condition result. */
export interface ConditionResult {
  readonly label: string;
  readonly isNull: boolean;
  readonly expect: readonly string[];
  readonly replicates: number;
  readonly hyps: readonly HypStat[];
  /** Fraction of replicates with ≥1 Holm rejection among H1–H6 (the family-wise error for nulls). */
  readonly familyRejectRate: number;
  /** For adaptive conditions: fraction of replicates rejecting every expected hypothesis. */
  readonly powerAll: number;
  /** For adaptive conditions: fraction rejecting at least one expected hypothesis. */
  readonly powerAny: number;
}

/** The whole validation report plus pass/fail against the §7 criteria. */
export interface ValidationReport {
  readonly conditions: readonly ConditionResult[];
  readonly games: number;
  readonly replicates: number;
  /** §7 criterion 1: every null's family-wise reject rate ≤ alpha (with a small Monte Carlo margin). */
  readonly nullFamilyWiseOk: boolean;
  /** §7 criterion 1: every null hypothesis's p-values are not rejected as non-uniform at 0.01. */
  readonly nullUniformityOk: boolean;
  readonly alpha: number;
}

const PRIMARY_IDS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'] as const;

function simulate(cfg: ValidationConfig, cond: Condition, rep: number) {
  const pool = resolvePool(cfg.pool ?? 'live');
  const generator = buildGenerator(cond.generator, pool);
  const agent = makeAgent(cond.agent);
  const rng = seedRng(`${String(cfg.seed ?? 'val')}|${cond.label}|${rep}`);
  const logs: GameLog[] = playGames(cfg.games, generator, agent, rng, {
    oracle: true,
    pool,
    personalBest: cfg.personalBest ?? 1500,
    maxTurns: cfg.maxTurns ?? 6000,
  });
  return groupByGame(recordsFromGameLogs(logs));
}

/** Run the synthetic validation protocol. */
export function validateDetector(cfg: ValidationConfig): ValidationReport {
  const alpha = cfg.detector?.alpha ?? 0.01;
  const conditions: ConditionResult[] = [];
  let nullFamilyWiseOk = true;
  let nullUniformityOk = true;

  for (const cond of cfg.conditions) {
    // Per hypothesis: p-values and reject flags across replicates.
    const pById = new Map<string, number[]>(PRIMARY_IDS.map((id) => [id, []]));
    const rejById = new Map<string, number>(PRIMARY_IDS.map((id) => [id, 0]));
    let familyReject = 0;
    let powerAll = 0;
    let powerAny = 0;

    for (let r = 0; r < cfg.replicates; r++) {
      const games = simulate(cfg, cond, r);
      const report = runDetector(games, { seed: `${cond.label}|${r}`, ...cfg.detector });
      let anyReject = false;
      for (const h of report.hypotheses) {
        if (!PRIMARY_IDS.includes(h.id as (typeof PRIMARY_IDS)[number])) continue;
        if (h.p !== undefined) (pById.get(h.id) as number[]).push(h.p);
        if (h.holm?.reject) {
          rejById.set(h.id, (rejById.get(h.id) as number) + 1);
          anyReject = true;
        }
      }
      if (anyReject) familyReject++;
      const expected = cond.expect;
      if (expected.length > 0) {
        const got = report.rejected.filter((id) => expected.includes(id));
        if (got.length === expected.length) powerAll++;
        if (got.length > 0) powerAny++;
      }
    }

    const hyps: HypStat[] = PRIMARY_IDS.map((id) => {
      const rejectRate = (rejById.get(id) as number) / cfg.replicates;
      if (!cond.isNull) return { id, rejectRate };
      const ps = pById.get(id) as number[];
      const ks = ps.length >= 5 ? ksTestUniform(ps).p : undefined;
      return ks === undefined ? { id, rejectRate } : { id, rejectRate, ksUniformP: ks };
    });

    const familyRejectRate = familyReject / cfg.replicates;
    if (cond.isNull) {
      // Allow a Monte Carlo margin: at R replicates, 2 s.e. above alpha.
      const margin = 2 * Math.sqrt((alpha * (1 - alpha)) / cfg.replicates);
      if (familyRejectRate > alpha + margin + 1e-9) nullFamilyWiseOk = false;
      for (const h of hyps) if (h.ksUniformP !== undefined && h.ksUniformP < 0.01) nullUniformityOk = false;
    }

    conditions.push({
      label: cond.label,
      isNull: cond.isNull,
      expect: cond.expect,
      replicates: cfg.replicates,
      hyps,
      familyRejectRate,
      powerAll: cond.expect.length > 0 ? powerAll / cfg.replicates : 0,
      powerAny: cond.expect.length > 0 ? powerAny / cfg.replicates : 0,
    });
  }

  return { conditions, games: cfg.games, replicates: cfg.replicates, nullFamilyWiseOk, nullUniformityOk, alpha };
}

/** The default §7 generator zoo as validation conditions, parameterised by agent. */
export function defaultZoo(agent = 'epsilon:0.3'): Condition[] {
  const hardIds = [13, 11, 22, 12, 21, 23, 24];
  return [
    { label: 'uniform', generator: 'uniform', agent, expect: [], isNull: true },
    { label: 'weighted', generator: { name: 'weighted' }, agent, expect: [], isNull: true },
    { label: 'bag', generator: 'bag', agent, expect: ['H5'], isNull: false },
    { label: 'rescue', generator: { name: 'rescue', opts: { fillThreshold: 0.5, strength: 1, fitBias: 8 } }, agent, expect: ['H1', 'H2', 'H4'], isNull: false },
    { label: 'lethal', generator: { name: 'lethal', opts: { probability: 0.6 } }, agent, expect: ['H4'], isNull: false },
    { label: 'kill', generator: { name: 'kill', opts: { scoreThreshold: { fractionOfBest: 0.5 }, hardBias: 10, hardIds } }, agent: 'beam:12', expect: ['H1', 'H3'], isNull: false },
    { label: 'slot-biased', generator: 'slot-biased', agent, expect: ['H5'], isNull: false },
    { label: 'per-game-difficulty', generator: { name: 'per-game-difficulty', opts: { levels: [0.4, 1, 3, 6] } }, agent, expect: ['H6'], isNull: false },
  ];
}
