// Precompute real martingale-Z evidence trajectories for the §4 DealerDetector: for each rigged
// mechanism and its matching indicator, many independent runs of fair vs rigged, Z recorded as
// hands accumulate. The browser animates these: pick a type, deal hands, watch the meters.
import { playGames, seedRng, EpsilonGreedyAgent, UniformGenerator, HARD_SHAPE_IDS,
         fillFraction, canPlaceAny, board as mkBoard, uniformWeights } from '@blockblast/engine';
import { buildGenerator, resolvePool } from '@blockblast/generators';
import { NullModel, recordsFromGameLogs } from '@blockblast/analysis';
import { writeFileSync } from 'node:fs';

const POOL = resolvePool('live');
const F = uniformWeights(POOL);
const RUNS = 20, CAP = 600, STEP = 20, BEST = 400;
const HARD = HARD_SHAPE_IDS;

const INDICATORS = {
  rescue: { // more fitting hands than fair, on near-full boards
    gen: { name: 'rescue', opts: { fillThreshold: 0.5, strength: 1, fitBias: 8 } },
    inStratum: (r) => fillFraction(mkBoard(r.board_lo, r.board_hi)) >= 0.5,
    I: (r) => (r.legal_moves_count > 0 ? 1 : 0),
    p: (model, r) => model.pSomeFits(mkBoard(r.board_lo, r.board_hi)),
  },
  kill: { // more hard pieces than fair, near the record
    gen: { name: 'kill', opts: { scoreThreshold: { fractionOfBest: 0.5 }, hardBias: 10, hardIds: [...HARD] } },
    inStratum: (r) => r.personal_best > 0 && r.score >= 0.5 * r.personal_best,
    I: (r) => (r.hand.some((id) => HARD.has(id)) ? 1 : 0),
    p: (model) => model.pHard(),
  },
  lethal: { // more unsolvable hands than fair
    gen: { name: 'lethal', opts: { probability: 0.6 } },
    inStratum: () => true,
    I: (r) => (r.hand_solvable ? 0 : 1),
    p: (model, r) => model.hazard(mkBoard(r.board_lo, r.board_hi)).h,
  },
};

function trajectory(records, ind, model) {
  let sumIP = 0, sumVar = 0, hands = 0;
  const pts = [];
  let nextCk = STEP;
  for (const r of records) {
    hands++;
    if (ind.inStratum(r)) {
      const p = ind.p(model, r);
      sumIP += ind.I(r) - p;
      sumVar += p * (1 - p);
    }
    if (hands >= nextCk) {
      pts.push({ h: hands, z: sumVar > 0 ? sumIP / Math.sqrt(sumVar) : 0 });
      nextCk += STEP;
    }
    if (hands >= CAP) break;
  }
  return pts;
}

function runs(genSpec, ind, label) {
  const res = [];
  for (let i = 0; i < RUNS; i++) {
    const gen = genSpec ? buildGenerator(genSpec, POOL) : new UniformGenerator(POOL);
    const logs = playGames(400, gen, new EpsilonGreedyAgent(0.3), seedRng(`${label}-${i}`), { oracle: true, pool: POOL, personalBest: BEST, maxTurns: 4000 });
    const records = recordsFromGameLogs(logs);
    const model = new NullModel(F, { rng: seedRng(`nm-${label}-${i}`), samples: 2000 });
    res.push(trajectory(records, ind, model));
  }
  return res;
}

const out = { runs: RUNS, cap: CAP, step: STEP, thresholdZ: 2.5758, indicators: {} };
for (const [name, ind] of Object.entries(INDICATORS)) {
  const t0 = Date.now();
  out.indicators[name] = { rigged: runs(ind.gen, ind, `${name}-rig`), fair: runs(null, ind, `${name}-fair`) };
  console.error(`${name}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
writeFileSync('src/data/detector.json', JSON.stringify(out));
console.error('wrote src/data/detector.json', (JSON.stringify(out).length / 1024).toFixed(0) + 'KB');
