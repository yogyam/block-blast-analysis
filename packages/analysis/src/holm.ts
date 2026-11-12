/**
 * Multiplicity control (`06-methods.md` §5): Holm–Bonferroni at family-wise α = 0.01 for the
 * primary tests, Benjamini–Hochberg at q = 0.05 for exploratory follow-ups.
 */

/** A test with a key and a p-value. */
export interface PValue {
  readonly key: string;
  readonly p: number;
}

/** A Holm decision for one test. */
export interface HolmDecision extends PValue {
  /** Holm-adjusted p-value (monotone, comparable to α). */
  readonly adjusted: number;
  readonly reject: boolean;
}

/**
 * Holm step-down at family-wise level `alpha`. With m tests sorted ascending by p, reject while
 * p_(i) ≤ alpha / (m − i); adjusted p_(i) = max over j ≤ i of (m − j)·p_(j), capped at 1.
 */
export function holm(tests: readonly PValue[], alpha = 0.01): HolmDecision[] {
  const m = tests.length;
  if (m === 0) return [];
  const order = tests.map((t, i) => ({ t, i })).sort((a, b) => a.t.p - b.t.p);
  const adjustedByOrig = new Array<number>(m);
  const rejectByOrig = new Array<boolean>(m).fill(false);
  let running = 0;
  let stillRejecting = true;
  for (let r = 0; r < m; r++) {
    const entry = order[r] as { t: PValue; i: number };
    const factor = m - r;
    running = Math.max(running, Math.min(1, factor * entry.t.p));
    adjustedByOrig[entry.i] = running;
    if (stillRejecting && entry.t.p <= alpha / factor) rejectByOrig[entry.i] = true;
    else stillRejecting = false;
  }
  return tests.map((t, i) => ({ key: t.key, p: t.p, adjusted: adjustedByOrig[i] as number, reject: rejectByOrig[i] as boolean }));
}

/** A Benjamini–Hochberg decision for one exploratory test. */
export interface BhDecision extends PValue {
  readonly qValue: number;
  readonly reject: boolean;
}

/** Benjamini–Hochberg at false-discovery rate `q`. */
export function benjaminiHochberg(tests: readonly PValue[], q = 0.05): BhDecision[] {
  const m = tests.length;
  if (m === 0) return [];
  const order = tests.map((t, i) => ({ t, i })).sort((a, b) => a.t.p - b.t.p);
  const qByOrig = new Array<number>(m);
  // Monotone BH-adjusted q-values from the largest p down.
  let running = 1;
  for (let r = m - 1; r >= 0; r--) {
    const entry = order[r] as { t: PValue; i: number };
    running = Math.min(running, Math.min(1, (m / (r + 1)) * entry.t.p));
    qByOrig[entry.i] = running;
  }
  return tests.map((t, i) => ({ key: t.key, p: t.p, qValue: qByOrig[i] as number, reject: (qByOrig[i] as number) <= q }));
}
