/**
 * Conditional logit with piece fixed effects (`06-methods.md` §3.2), the primary test for H1
 * (board-aware generation) and the companion for H2/H3.
 *
 *     P(piece = k | board_t, context_t) ∝ exp( asc_k + β · g_k(board_t, context_t) )
 *
 * The alternative-specific constants asc_k absorb the unknown marginal F (so the test needs no
 * F), and the shared slopes β carry the board/context dependence. Each of the three slots of a
 * hand is one choice observation (i.i.d. slots under H0). The likelihood-ratio test of β = 0 is
 * the primary statistic; odds ratios carry game-clustered standard errors.
 *
 * The reference alternative (asc = 0) is the first pool id. Features with no across-alternative
 * variation anywhere are unidentified and dropped, their names reported.
 */

import { type ShapeId } from '@blockblast/engine';
import { boardOf, type Game } from './dataset.ts';
import { assembleFeatures, contextOf, FeatureCache, FEATURE_NAMES } from './features.ts';
import { chiSquareSf, normalQuantile } from './stats.ts';

/** One slot's choice: the alternative chosen and the per-alternative feature matrix. */
interface Observation {
  readonly chosen: number; // index into the alternative list
  readonly x: readonly number[][]; // [alternative][feature]
  readonly game: number; // game index, for clustering
}

/** Result of the conditional-logit fit and its LR test. */
export interface ClogitResult {
  readonly converged: boolean;
  readonly iterations: number;
  readonly llFull: number;
  readonly llNull: number;
  /** Likelihood-ratio statistic 2(ll_full − ll_null). */
  readonly lr: number;
  readonly df: number;
  readonly pValue: number;
  /** Kept feature names (after dropping unidentified ones), aligned with `beta`. */
  readonly features: readonly string[];
  /** Dropped feature names (no across-alternative variation). */
  readonly dropped: readonly string[];
  readonly beta: readonly number[];
  /** Game-clustered standard errors of `beta`. */
  readonly se: readonly number[];
  readonly oddsRatio: readonly number[];
  /** 99% confidence interval for each odds ratio. */
  readonly ciLow: readonly number[];
  readonly ciHigh: readonly number[];
  readonly nObs: number;
  readonly nAlternatives: number;
}

/** Options for {@link conditionalLogit}. */
export interface ClogitOptions {
  /** Analysis set P (the alternatives). Defaults to the ids observed in the data. */
  readonly pool?: readonly ShapeId[];
  readonly maxIterations?: number;
  readonly tol?: number;
  /** 2-sided CI level; default 0.99 (matches the §5 reporting). */
  readonly ciLevel?: number;
}

/** Solve A x = b for small dense symmetric A by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i] as number]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs((M[r] as number[])[col] as number) > Math.abs((M[piv] as number[])[col] as number)) piv = r;
    const pivVal = (M[piv] as number[])[col] as number;
    if (Math.abs(pivVal) < 1e-12) return null;
    const tmp = M[col] as number[];
    M[col] = M[piv] as number[];
    M[piv] = tmp;
    const prow = M[col] as number[];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const rrow = M[r] as number[];
      const f = (rrow[col] as number) / (prow[col] as number);
      if (f === 0) continue;
      for (let c = col; c <= n; c++) rrow[c] = (rrow[c] as number) - f * (prow[c] as number);
    }
  }
  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) x[i] = ((M[i] as number[])[n] as number) / ((M[i] as number[])[i] as number);
  return x;
}

/** Softmax utilities for one observation given asc (length K, asc[0]=0) and beta over kept features. */
function probs(x: readonly number[][], asc: readonly number[], beta: readonly number[], keep: readonly number[]): number[] {
  const K = x.length;
  const v = new Array<number>(K);
  let max = -Infinity;
  for (let k = 0; k < K; k++) {
    let u = asc[k] as number;
    const xk = x[k] as number[];
    for (let f = 0; f < keep.length; f++) u += (beta[f] as number) * (xk[keep[f] as number] as number);
    v[k] = u;
    if (u > max) max = u;
  }
  let sum = 0;
  for (let k = 0; k < K; k++) {
    const e = Math.exp((v[k] as number) - max);
    v[k] = e;
    sum += e;
  }
  for (let k = 0; k < K; k++) v[k] = (v[k] as number) / sum;
  return v;
}

/**
 * Fit the conditional logit and run the LR test of β = 0. Throws if the data has no games.
 */
export function conditionalLogit(games: readonly Game[], opts: ClogitOptions = {}): ClogitResult {
  // Alternatives.
  const poolSet = new Set<ShapeId>();
  if (opts.pool) for (const id of opts.pool) poolSet.add(id);
  else for (const g of games) for (const r of g) for (const id of r.hand) poolSet.add(id);
  const pool = [...poolSet].sort((a, b) => a - b);
  const K = pool.length;
  if (K < 2) throw new Error('conditionalLogit: need at least two alternatives');
  const altIndex = new Map<ShapeId, number>(pool.map((id, i) => [id, i]));
  const fcache = new FeatureCache(pool);

  // Build observations (one per slot). Also marginal counts for the null and for identifiability.
  const obs: Observation[] = [];
  const counts = new Array<number>(K).fill(0);
  games.forEach((g, gi) => {
    for (const r of g) {
      const board = boardOf(r);
      const bf = fcache.board(board);
      const ctx = contextOf(r);
      const x = pool.map((k, ki) => assembleFeatures(bf[ki] as number[], k, ctx));
      for (const id of r.hand) {
        const ci = altIndex.get(id);
        if (ci === undefined) continue; // outside the analysis pool
        obs.push({ chosen: ci, x, game: gi });
        counts[ci] = (counts[ci] as number) + 1;
      }
    }
  });
  const N = obs.length;
  if (N === 0) throw new Error('conditionalLogit: no observations');

  // Identifiable features: some observation has across-alternative variation.
  const m0 = FEATURE_NAMES.length;
  const keep: number[] = [];
  for (let f = 0; f < m0; f++) {
    let varies = false;
    for (const o of obs) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < K; k++) {
        const val = (o.x[k] as number[])[f] as number;
        if (val < lo) lo = val;
        if (val > hi) hi = val;
      }
      if (hi - lo > 1e-9) {
        varies = true;
        break;
      }
    }
    if (varies) keep.push(f);
  }
  const dropped = FEATURE_NAMES.filter((_, f) => !keep.includes(f));
  const m = keep.length;

  // Null log-likelihood (asc-only MLE: P_k = n_k / N).
  let llNull = 0;
  for (let k = 0; k < K; k++) {
    const n = counts[k] as number;
    if (n > 0) llNull += n * Math.log(n / N);
  }

  // Parameters: asc_1..asc_{K-1} (asc_0 = 0), then beta_1..beta_m. Dimension D.
  const D = K - 1 + m;
  const asc = new Array<number>(K).fill(0); // asc[0] stays 0
  const beta = new Array<number>(m).fill(0);
  let llFull = llNull;
  let converged = false;
  let iterations = 0;
  const maxIt = opts.maxIterations ?? 50;
  const tol = opts.tol ?? 1e-8;

  const logLik = (): number => {
    let ll = 0;
    for (const o of obs) {
      const p = probs(o.x, asc, beta, keep);
      ll += Math.log(Math.max(p[o.chosen] as number, 1e-300));
    }
    return ll;
  };

  for (let it = 0; it < maxIt; it++) {
    iterations = it + 1;
    const grad = new Array<number>(D).fill(0);
    const A: number[][] = Array.from({ length: D }, () => new Array<number>(D).fill(0));
    let ll = 0;
    for (const o of obs) {
      const p = probs(o.x, asc, beta, keep);
      ll += Math.log(Math.max(p[o.chosen] as number, 1e-300));
      // Feature means under p: Xbar[f] = Σ_k p_k x_k[f].
      const xbar = new Array<number>(m).fill(0);
      for (let k = 0; k < K; k++) {
        const pk = p[k] as number;
        const xk = o.x[k] as number[];
        for (let f = 0; f < m; f++) xbar[f] = (xbar[f] as number) + pk * (xk[keep[f] as number] as number);
      }
      // Gradient.
      if (o.chosen > 0) grad[o.chosen - 1] = (grad[o.chosen - 1] as number) + 1;
      for (let a = 1; a < K; a++) grad[a - 1] = (grad[a - 1] as number) - (p[a] as number);
      const xchosen = o.x[o.chosen] as number[];
      for (let f = 0; f < m; f++) grad[K - 1 + f] = (grad[K - 1 + f] as number) + (xchosen[keep[f] as number] as number) - (xbar[f] as number);
      // Information blocks.
      // asc-asc: Σ p_i(δ_ij − p_j) over i,j in 1..K-1.
      for (let a = 1; a < K; a++) {
        const pa = p[a] as number;
        const ra = A[a - 1] as number[];
        ra[a - 1] = (ra[a - 1] as number) + pa * (1 - pa);
        for (let b2 = a + 1; b2 < K; b2++) {
          const val = -pa * (p[b2] as number);
          ra[b2 - 1] = (ra[b2 - 1] as number) + val;
          (A[b2 - 1] as number[])[a - 1] = ((A[b2 - 1] as number[])[a - 1] as number) + val;
        }
      }
      // asc-beta: Σ p_a (x_a[f] − xbar[f]) for a in 1..K-1.
      for (let a = 1; a < K; a++) {
        const pa = p[a] as number;
        const xa = o.x[a] as number[];
        for (let f = 0; f < m; f++) {
          const val = pa * ((xa[keep[f] as number] as number) - (xbar[f] as number));
          (A[a - 1] as number[])[K - 1 + f] = ((A[a - 1] as number[])[K - 1 + f] as number) + val;
          (A[K - 1 + f] as number[])[a - 1] = ((A[K - 1 + f] as number[])[a - 1] as number) + val;
        }
      }
      // beta-beta: Σ_k p_k x_k x_k^T − xbar xbar^T.
      for (let f = 0; f < m; f++) {
        for (let h = f; h < m; h++) {
          let s = 0;
          for (let k = 0; k < K; k++) {
            const pk = p[k] as number;
            const xk = o.x[k] as number[];
            s += pk * (xk[keep[f] as number] as number) * (xk[keep[h] as number] as number);
          }
          const val = s - (xbar[f] as number) * (xbar[h] as number);
          (A[K - 1 + f] as number[])[K - 1 + h] = ((A[K - 1 + f] as number[])[K - 1 + h] as number) + val;
          if (h !== f) (A[K - 1 + h] as number[])[K - 1 + f] = ((A[K - 1 + h] as number[])[K - 1 + f] as number) + val;
        }
      }
    }
    // Newton step with ridge fallback and step-halving.
    let step = solve(A, grad);
    if (step === null) {
      for (let i = 0; i < D; i++) (A[i] as number[])[i] = ((A[i] as number[])[i] as number) + 1e-6;
      step = solve(A, grad);
      if (step === null) break;
    }
    let scale = 1;
    let improved = false;
    const asc0 = [...asc];
    const beta0 = [...beta];
    for (let h = 0; h < 25; h++) {
      for (let a = 1; a < K; a++) asc[a] = (asc0[a] as number) + scale * (step[a - 1] as number);
      for (let f = 0; f < m; f++) beta[f] = (beta0[f] as number) + scale * (step[K - 1 + f] as number);
      const nll = logLik();
      if (nll > ll + 1e-12) {
        llFull = nll;
        improved = true;
        if (nll - ll < tol) converged = true;
        break;
      }
      scale /= 2;
    }
    if (!improved) {
      for (let a = 1; a < K; a++) asc[a] = asc0[a] as number;
      for (let f = 0; f < m; f++) beta[f] = beta0[f] as number;
      converged = true;
      break;
    }
    if (converged) break;
  }

  // Game-clustered sandwich covariance for beta: V = A^{-1} (Σ_g s_g s_g^T) A^{-1}, beta block.
  const info: number[][] = Array.from({ length: D }, () => new Array<number>(D).fill(0));
  const gameScores = new Map<number, number[]>();
  for (const o of obs) {
    const p = probs(o.x, asc, beta, keep);
    const xbar = new Array<number>(m).fill(0);
    for (let k = 0; k < K; k++) {
      const pk = p[k] as number;
      const xk = o.x[k] as number[];
      for (let f = 0; f < m; f++) xbar[f] = (xbar[f] as number) + pk * (xk[keep[f] as number] as number);
    }
    const s = new Array<number>(D).fill(0);
    if (o.chosen > 0) s[o.chosen - 1] = 1;
    for (let a = 1; a < K; a++) s[a - 1] = (s[a - 1] as number) - (p[a] as number);
    const xchosen = o.x[o.chosen] as number[];
    for (let f = 0; f < m; f++) s[K - 1 + f] = (xchosen[keep[f] as number] as number) - (xbar[f] as number);
    let gs = gameScores.get(o.game);
    if (gs === undefined) {
      gs = new Array<number>(D).fill(0);
      gameScores.set(o.game, gs);
    }
    for (let i = 0; i < D; i++) gs[i] = (gs[i] as number) + (s[i] as number);
    // Observed information (same blocks as A at the optimum).
    for (let a = 1; a < K; a++) {
      const pa = p[a] as number;
      const ra = info[a - 1] as number[];
      ra[a - 1] = (ra[a - 1] as number) + pa * (1 - pa);
      for (let b2 = a + 1; b2 < K; b2++) {
        const val = -pa * (p[b2] as number);
        ra[b2 - 1] = (ra[b2 - 1] as number) + val;
        (info[b2 - 1] as number[])[a - 1] = ((info[b2 - 1] as number[])[a - 1] as number) + val;
      }
    }
    for (let a = 1; a < K; a++) {
      const pa = p[a] as number;
      const xa = o.x[a] as number[];
      for (let f = 0; f < m; f++) {
        const val = pa * ((xa[keep[f] as number] as number) - (xbar[f] as number));
        (info[a - 1] as number[])[K - 1 + f] = ((info[a - 1] as number[])[K - 1 + f] as number) + val;
        (info[K - 1 + f] as number[])[a - 1] = ((info[K - 1 + f] as number[])[a - 1] as number) + val;
      }
    }
    for (let f = 0; f < m; f++) {
      for (let h = f; h < m; h++) {
        let sum = 0;
        for (let k = 0; k < K; k++) {
          const pk = p[k] as number;
          const xk = o.x[k] as number[];
          sum += pk * (xk[keep[f] as number] as number) * (xk[keep[h] as number] as number);
        }
        const val = sum - (xbar[f] as number) * (xbar[h] as number);
        (info[K - 1 + f] as number[])[K - 1 + h] = ((info[K - 1 + f] as number[])[K - 1 + h] as number) + val;
        if (h !== f) (info[K - 1 + h] as number[])[K - 1 + f] = ((info[K - 1 + h] as number[])[K - 1 + f] as number) + val;
      }
    }
  }

  // Invert the information (ridge if needed) by solving against identity columns.
  const invCols: number[][] = [];
  let singular = false;
  for (let j = 0; j < D; j++) {
    const e = new Array<number>(D).fill(0);
    e[j] = 1;
    let col = solve(info, e);
    if (col === null) {
      for (let i = 0; i < D; i++) (info[i] as number[])[i] = ((info[i] as number[])[i] as number) + 1e-6;
      col = solve(info, e);
      if (col === null) {
        singular = true;
        col = new Array<number>(D).fill(0);
      }
    }
    invCols.push(col);
  }
  // Ainv[i][j] = invCols[j][i].
  const Ainv = (i: number, j: number): number => (invCols[j] as number[])[i] as number;

  // Meat: B = Σ_g s_g s_g^T.
  const B: number[][] = Array.from({ length: D }, () => new Array<number>(D).fill(0));
  for (const gs of gameScores.values()) {
    for (let i = 0; i < D; i++) {
      const gi = gs[i] as number;
      if (gi === 0) continue;
      const Bi = B[i] as number[];
      for (let j = 0; j < D; j++) Bi[j] = (Bi[j] as number) + gi * (gs[j] as number);
    }
  }
  // V = Ainv B Ainv; we only need the beta-block diagonal. Compute (Ainv B) then (…) Ainv.
  const se = new Array<number>(m).fill(0);
  if (!singular) {
    // AB = Ainv * B
    const AB: number[][] = Array.from({ length: D }, () => new Array<number>(D).fill(0));
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        let s = 0;
        for (let t = 0; t < D; t++) s += Ainv(i, t) * ((B[t] as number[])[j] as number);
        (AB[i] as number[])[j] = s;
      }
    }
    for (let f = 0; f < m; f++) {
      const row = K - 1 + f;
      let v = 0;
      for (let t = 0; t < D; t++) v += ((AB[row] as number[])[t] as number) * Ainv(t, row);
      se[f] = v > 0 ? Math.sqrt(v) : NaN;
    }
  } else {
    for (let f = 0; f < m; f++) se[f] = NaN;
  }

  const lr = Math.max(0, 2 * (llFull - llNull));
  const df = m;
  const pValue = df > 0 ? chiSquareSf(lr, df) : 1;
  const z = normalQuantile(1 - (1 - (opts.ciLevel ?? 0.99)) / 2);
  const oddsRatio = beta.map((b) => Math.exp(b));
  const ciLow = beta.map((b, f) => Math.exp(b - z * (se[f] as number)));
  const ciHigh = beta.map((b, f) => Math.exp(b + z * (se[f] as number)));

  return {
    converged,
    iterations,
    llFull,
    llNull,
    lr,
    df,
    pValue,
    features: keep.map((f) => FEATURE_NAMES[f] as string),
    dropped,
    beta,
    se,
    oddsRatio,
    ciLow,
    ciHigh,
    nObs: N,
    nAlternatives: K,
  };
}
