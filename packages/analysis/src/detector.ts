/**
 * The detector: the eight pre-registered primary tests of `06-methods.md` run over one dataset,
 * with Holm correction (§5) across the hypotheses that the data can support. H1–H6 run on any
 * per-hand log; H7 needs an arm covariate (`bucket_id`/`plan`), H8 needs ad covariates, so they
 * run only when present and are otherwise marked "not run" and left out of the Holm family.
 *
 * Orientation follows the §7 confusion matrix: H2/H4 are positive for rescue (more fitting /
 * more solvable hands than a fair dealer), H4 negative for lethal; H3 positive for a kill dealer.
 */

import { seedRng, type ShapeId } from '@blockblast/engine';
import { conditionalLogit, type ClogitResult } from './clogit.ts';
import { estimateWeights, observedPool, type Game, type HandRecord } from './dataset.ts';
import { cumulativeHazard, type HazardResult } from './hazard.ts';
import { holm, type HolmDecision } from './holm.ts';
import { hasHardTerms, martingaleZ, nearFull, nearRecord, notPlaceableTerms, someFitsTerms } from './martingale.ts';
import { NullModel } from './nullmodel.ts';
import { overdispersionTest } from './overdispersion.ts';
import { handCompositionTests } from './permutation.ts';

/** One hypothesis test's result. */
export interface HypothesisResult {
  readonly id: string;
  readonly name: string;
  /** Whether the data supported running it (H7/H8 need covariates). */
  readonly ran: boolean;
  /** The primary p-value (undefined when not run). */
  readonly p?: number;
  /** Signed test statistic where one exists (Z or LR). */
  readonly statistic?: number;
  /** Human-readable direction/effect summary for the report. */
  readonly effect?: string;
  /** Holm decision among the run hypotheses (undefined when not run). */
  readonly holm?: { adjusted: number; reject: boolean };
}

/** The full detector report. */
export interface DetectorReport {
  readonly hypotheses: readonly HypothesisResult[];
  /** Hypotheses rejected at Holm α. */
  readonly rejected: readonly string[];
  readonly alpha: number;
  readonly games: number;
  readonly hands: number;
  readonly pool: readonly ShapeId[];
  /** The conditional-logit detail (H1). */
  readonly clogit: ClogitResult;
  readonly hazard: HazardResult;
}

/** Options for {@link runDetector}. */
export interface DetectorOptions {
  /** Family-wise level for Holm; default 0.01 (§5). */
  readonly alpha?: number;
  /** Near-full fill threshold for H2; default 0.5. */
  readonly nearFullTheta?: number;
  /** Near-record score fraction for H3; default 0.5. */
  readonly nearRecordFrac?: number;
  /** Permutation count for H5/H6; default 2000. */
  readonly permutations?: number;
  /** Monte Carlo samples for the solvability hazard; default 8000. */
  readonly samples?: number;
  /** Analysis pool override; defaults to the ids observed in the data. */
  readonly pool?: readonly ShapeId[];
  /** Seed for the permutation / Monte Carlo RNGs; default 'detector'. */
  readonly seed?: number | string;
}

function flatten(games: readonly Game[]): HandRecord[] {
  const out: HandRecord[] = [];
  for (const g of games) for (const r of g) out.push(r);
  return out;
}

/** Run the detector over a set of games. */
export function runDetector(games: readonly Game[], opts: DetectorOptions = {}): DetectorReport {
  const alpha = opts.alpha ?? 0.01;
  const theta = opts.nearFullTheta ?? 0.5;
  const frac = opts.nearRecordFrac ?? 0.5;
  const B = opts.permutations ?? 2000;
  const seed = opts.seed ?? 'detector';
  const records = flatten(games);
  const model = new NullModel(estimateWeights(records), { rng: seedRng(`${seed}-nm`), samples: opts.samples ?? 8000 });

  // H1: conditional logit.
  const clogitOpts = opts.pool ? { pool: opts.pool } : {};
  const clog = conditionalLogit(games, clogitOpts);

  // H2: rescue — some piece fits, near-full stratum. Positive = rescue.
  const fits = martingaleZ(someFitsTerms(games, model, nearFull(theta)));

  // H3: kill — hard piece, near-record stratum. Positive = kill.
  const hard = martingaleZ(hasHardTerms(games, model, nearRecord(frac)));

  // H4: lethal/rescue of solvability — oriented on solvability (positive = rescue, negative = lethal).
  const dZ = martingaleZ(notPlaceableTerms(games, model));
  const haz = cumulativeHazard(games, model);

  // H5: hand composition.
  const h5 = handCompositionTests(games, B, `${seed}-h5`);

  // H6: overdispersion.
  const h6 = overdispersionTest(games, B, seedRng(`${seed}-h6`));

  // H7: remote tuning — needs ≥2 arms.
  const arms = new Set<string>();
  for (const r of records) if (r.bucket_id !== undefined) arms.add(r.bucket_id);
  const h7ran = arms.size >= 2;

  // H8: ad-value timing — needs genuine ad covariates (not algo_id, which is a white-box field).
  const h8ran = records.some((r) => r.revive_offered !== undefined || r.ad_shown !== undefined || (r.ad_ecpm !== undefined && r.ad_ecpm !== null));

  const hyps: HypothesisResult[] = [
    {
      id: 'H1',
      name: 'Board-aware generation',
      ran: true,
      p: clog.pValue,
      statistic: clog.lr,
      effect: `LR=${clog.lr.toFixed(1)} df=${clog.df}; fitsAnywhere OR=${orOf(clog, 'fitsAnywhere').toFixed(2)}`,
    },
    {
      id: 'H2',
      name: 'Rescue / easing (near-full)',
      ran: true,
      p: fits.pGreater,
      statistic: fits.z,
      effect: `Z=${fits.z.toFixed(2)} on P(some fits), fill≥${theta}; observed ${fits.sumI} vs ${fits.sumP.toFixed(1)} expected over ${fits.n} turns`,
    },
    {
      id: 'H3',
      name: 'Kill / choke (near-record)',
      ran: true,
      p: hard.pGreater,
      statistic: hard.z,
      effect: `Z=${hard.z.toFixed(2)} on P(hard piece), score≥${frac}×best; clogit hardXscoreRelBest OR=${orOf(clog, 'hardXscoreRelBest').toFixed(2)}`,
    },
    {
      id: 'H4',
      name: 'Lethal / solvability',
      ran: true,
      p: dZ.pTwoSided,
      statistic: -dZ.z, // solvability orientation: positive = rescue, negative = lethal
      effect: `${-dZ.z >= 0 ? 'rescue' : 'lethal'}: Z=${(-dZ.z).toFixed(2)} on solvability; mean Λ=${haz.meanLambda.toFixed(2)} vs observed deaths ${haz.meanObservedDeaths.toFixed(2)}`,
    },
    {
      id: 'H5',
      name: 'Within-hand dependence',
      ran: true,
      p: h5.omnibusP,
      effect: `omnibus p=${h5.omnibusP.toExponential(1)} [primary: dup ${h5.duplicate.zApproxP.toExponential(1)}, slot ${h5.slotBias.zApproxP.toExponential(1)}] [exploratory: var ${h5.sizeVariance.zApproxP.toExponential(1)}, lag1 ${h5.lag1.zApproxP.toExponential(1)}]`,
    },
    {
      id: 'H6',
      name: 'Per-game overdispersion',
      ran: true,
      p: h6.zApproxP,
      statistic: h6.statistic,
      effect: `T=${h6.statistic.toFixed(0)} vs null ${h6.nullMean.toFixed(0)}±${h6.nullSd.toFixed(0)}, studentized p=${h6.zApproxP.toExponential(1)} (empirical ${h6.p.toFixed(3)})`,
    },
    { id: 'H7', name: 'Remote tuning (arm-dependent)', ran: h7ran, effect: h7ran ? `${arms.size} arms present` : 'no arm covariate; not run' },
    { id: 'H8', name: 'Ad-value-driven timing', ran: h8ran, effect: h8ran ? 'ad covariates present' : 'no ad covariate; not run' },
  ];

  // Holm across the run hypotheses that have a p-value.
  const withP = hyps.filter((h) => h.ran && h.p !== undefined);
  const decisions: HolmDecision[] = holm(withP.map((h) => ({ key: h.id, p: h.p as number })), alpha);
  const byKey = new Map(decisions.map((d) => [d.key, d]));
  const finalHyps = hyps.map((h) => {
    const d = byKey.get(h.id);
    return d === undefined ? h : { ...h, holm: { adjusted: d.adjusted, reject: d.reject } };
  });

  return {
    hypotheses: finalHyps,
    rejected: finalHyps.filter((h) => h.holm?.reject).map((h) => h.id),
    alpha,
    games: games.length,
    hands: records.length,
    pool: opts.pool ?? observedPool(records),
    clogit: clog,
    hazard: haz,
  };
}

function orOf(clog: ClogitResult, name: string): number {
  const i = clog.features.indexOf(name);
  return i < 0 ? NaN : (clog.oddsRatio[i] as number);
}
