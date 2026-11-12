/**
 * Numeric primitives the tests need, with no external dependency: the normal and chi-square
 * distributions, the Kolmogorov–Smirnov p-value, and small descriptive helpers. The
 * approximations are standard and cited; accuracy is ~1e-7 or better, which is ample for the
 * p-values and critical values of `06-methods.md` (Holm α = 0.01).
 */

/** Mean of a sample. Throws on an empty sample. */
export function mean(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error('mean of empty sample');
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Unbiased sample variance (divides by n − 1). Returns 0 for n ≤ 1. */
export function variance(xs: readonly number[]): number {
  const n = xs.length;
  if (n <= 1) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return s / (n - 1);
}

/** Unbiased sample standard deviation. */
export function sd(xs: readonly number[]): number {
  return Math.sqrt(variance(xs));
}

/**
 * Complementary error function erfc(x), fractional error < 1.2e-7 everywhere.
 * Numerical Recipes in C, 2nd ed., §6.2 (`erfcc`).
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? ans : 2 - ans;
}

/** Error function erf(x). */
export function erf(x: number): number {
  return 1 - erfc(x);
}

/** Standard-normal cumulative distribution Φ(z). */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/** Standard-normal survival function 1 − Φ(z), evaluated without cancellation. */
export function normalSf(z: number): number {
  return 0.5 * erfc(z / Math.SQRT2);
}

/**
 * Two-sided standard-normal p-value for a Z statistic: P(|N(0,1)| ≥ |z|) = erfc(|z|/√2).
 */
export function normalTwoSidedP(z: number): number {
  return erfc(Math.abs(z) / Math.SQRT2);
}

/**
 * Inverse standard-normal CDF (quantile). Acklam's rational approximation (relative error
 * < 1.15e-9) refined by one Halley step against {@link erfc}. Domain (0, 1); throws otherwise.
 */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    throw new RangeError(`normalQuantile: p must be in (0, 1), got ${p}`);
  }
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239] as const;
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1] as const;
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783] as const;
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416] as const;
  const plow = 0.02425;
  const phigh = 1 - plow;
  let x: number;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // One Halley refinement.
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  x = x - u / (1 + (x * u) / 2);
  return x;
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** Natural log of the gamma function (Lanczos approximation, g = 7). */
export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection: Γ(x)Γ(1−x) = π / sin(πx).
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = LANCZOS[0] as number;
  const t = z + 7.5;
  for (let i = 1; i < LANCZOS.length; i++) a += (LANCZOS[i] as number) / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Lower regularised incomplete gamma P(s, x) by series expansion (good for x < s + 1). */
function lowerGammaSeries(s: number, x: number): number {
  if (x <= 0) return 0;
  let ap = s;
  let sum = 1 / s;
  let del = sum;
  for (let n = 0; n < 1000; n++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
}

/** Upper regularised incomplete gamma Q(s, x) by continued fraction (good for x ≥ s + 1). */
function upperGammaCF(s: number, x: number): number {
  const tiny = 1e-300;
  let b = x + 1 - s;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

/** Lower regularised incomplete gamma P(s, x) = γ(s, x) / Γ(s), for s > 0, x ≥ 0. */
export function regularisedGammaP(s: number, x: number): number {
  if (x < 0 || s <= 0) throw new RangeError('regularisedGammaP: need s > 0 and x ≥ 0');
  if (x === 0) return 0;
  return x < s + 1 ? lowerGammaSeries(s, x) : 1 - upperGammaCF(s, x);
}

/** Upper regularised incomplete gamma Q(s, x) = 1 − P(s, x). */
export function regularisedGammaQ(s: number, x: number): number {
  return 1 - regularisedGammaP(s, x);
}

/** Chi-square CDF with `df` degrees of freedom. */
export function chiSquareCdf(x: number, df: number): number {
  if (df <= 0) throw new RangeError('chiSquareCdf: df must be positive');
  if (x <= 0) return 0;
  return regularisedGammaP(df / 2, x / 2);
}

/** Chi-square upper-tail (survival) probability P(χ²_df ≥ x): the p-value of an LR/Wald statistic. */
export function chiSquareSf(x: number, df: number): number {
  if (df <= 0) throw new RangeError('chiSquareSf: df must be positive');
  if (x <= 0) return 1;
  return regularisedGammaQ(df / 2, x / 2);
}

/**
 * Kolmogorov distribution upper tail Q_KS(t) = 2 Σ_{j≥1} (−1)^{j−1} e^{−2 j² t²}.
 * Numerical Recipes §14.3 (`probks`).
 */
export function kolmogorovSf(t: number): number {
  if (t <= 0) return 1;
  const a2 = -2 * t * t;
  let sum = 0;
  let termBF = 0;
  let sign = 1;
  for (let j = 1; j <= 100; j++) {
    const term = sign * Math.exp(a2 * j * j);
    sum += term;
    if (Math.abs(term) <= 1e-9 * termBF || Math.abs(term) <= 1e-12 * sum) return 2 * sum;
    sign = -sign;
    termBF = Math.abs(term);
  }
  return 1; // did not converge: saturate
}

/** Result of a one-sample KS test against the uniform(0,1) distribution. */
export interface KsResult {
  /** The KS statistic D = max|F_n − U|. */
  readonly d: number;
  /** Asymptotic p-value. */
  readonly p: number;
  readonly n: number;
}

/**
 * One-sample Kolmogorov–Smirnov test that `values` are U(0,1) — the §7 calibration check that
 * a test's p-values are uniform under H0. Values outside [0,1] are clamped.
 */
export function ksTestUniform(values: readonly number[]): KsResult {
  const n = values.length;
  if (n === 0) throw new Error('ksTestUniform: empty sample');
  const xs = [...values].map((v) => Math.min(1, Math.max(0, v))).sort((a, b) => a - b);
  let d = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] as number;
    const dPlus = (i + 1) / n - x;
    const dMinus = x - i / n;
    d = Math.max(d, dPlus, dMinus);
  }
  const sqrtN = Math.sqrt(n);
  const p = kolmogorovSf((sqrtN + 0.12 + 0.11 / sqrtN) * d);
  return { d, p, n };
}
