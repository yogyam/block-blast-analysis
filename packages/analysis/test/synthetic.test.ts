import { describe, expect, it } from 'vitest';
import { validateDetector, type Condition } from '../src/synthetic.ts';
import { powerCurve } from '../src/power.ts';

// A small, fast subset of the §7 protocol: one null, one rescue, one bag. The full
// 8-generator sweep is a research artifact run via `sim validate`; this guards the harness
// (validateDetector / powerCurve) and the headline facts: nulls do not false-positive and the
// strong adaptive dealers are detected.
const CONDITIONS: Condition[] = [
  { label: 'uniform', generator: 'uniform', agent: 'epsilon:0.3', expect: [], isNull: true },
  { label: 'rescue', generator: { name: 'rescue', opts: { fillThreshold: 0.5, strength: 1, fitBias: 8 } }, agent: 'epsilon:0.3', expect: ['H1', 'H2', 'H4'], isNull: false },
  { label: 'bag', generator: 'bag', agent: 'epsilon:0.3', expect: ['H5'], isNull: false },
];

describe('synthetic validation harness (06-methods §7)', () => {
  it('nulls do not false-positive; rescue and bag are detected', () => {
    const report = validateDetector({
      conditions: CONDITIONS,
      replicates: 8,
      games: 40,
      personalBest: 400,
      seed: 'test',
      detector: { permutations: 300, samples: 2000, alpha: 0.01 },
    });
    const byLabel = Object.fromEntries(report.conditions.map((c) => [c.label, c]));

    // The null never rejects anything at Holm α = 0.01.
    expect(byLabel['uniform']?.familyRejectRate).toBe(0);
    expect(report.nullFamilyWiseOk).toBe(true);

    // Strong adaptive dealers: every replicate rejects at least one expected hypothesis.
    expect(byLabel['rescue']?.powerAny).toBeGreaterThanOrEqual(0.8);
    expect(byLabel['bag']?.powerAny).toBeGreaterThanOrEqual(0.8);

    // Bag's signal is H5 specifically.
    expect(byLabel['bag']?.hyps.find((h) => h.id === 'H5')?.rejectRate).toBeGreaterThanOrEqual(0.8);
  });

  it('power rises with the number of games (lethal / H4)', () => {
    const curve = powerCurve({
      generator: { name: 'lethal', opts: { probability: 0.6 } },
      agent: 'epsilon:0.3',
      gamesList: [10, 60],
      replicates: 6,
      target: 'H4',
      personalBest: 400,
      seed: 'pc',
      detector: { permutations: 300, samples: 2000, alpha: 0.01 },
    });
    expect(curve).toHaveLength(2);
    expect(curve[1]!.power).toBeGreaterThanOrEqual(curve[0]!.power);
    expect(curve[1]!.power).toBeGreaterThanOrEqual(0.8);
  });
});
