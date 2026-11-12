import { describe, expect, it } from 'vitest';
import {
  chiSquareSf,
  erf,
  ksTestUniform,
  logGamma,
  mean,
  normalCdf,
  normalQuantile,
  normalSf,
  normalTwoSidedP,
  regularisedGammaP,
  sd,
  variance,
} from '../src/stats.ts';

const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('normal distribution', () => {
  it('cdf at reference points', () => {
    close(normalCdf(0), 0.5);
    close(normalCdf(1.959963985), 0.975, 1e-6);
    close(normalCdf(-1.959963985), 0.025, 1e-6);
    close(normalCdf(2.575829304), 0.995, 1e-6);
  });
  it('sf and two-sided p', () => {
    close(normalSf(1.959963985), 0.025, 1e-6);
    close(normalTwoSidedP(1.959963985), 0.05, 1e-6);
    close(normalTwoSidedP(2.575829304), 0.01, 1e-6);
  });
  it('quantile inverts the cdf', () => {
    close(normalQuantile(0.975), 1.959963985, 1e-6);
    close(normalQuantile(0.5), 0, 1e-6);
    close(normalQuantile(0.995), 2.575829304, 1e-6);
    for (const z of [-3, -1.3, 0.2, 1.7, 2.8]) close(normalQuantile(normalCdf(z)), z, 1e-6);
  });
  it('erf reference', () => {
    close(erf(1), 0.8427007929, 1e-6);
    close(erf(0), 0, 1e-7);
  });
});

describe('gamma and chi-square', () => {
  it('regularised lower gamma P(1, x) = 1 - e^-x', () => {
    for (const x of [0.5, 1, 2, 5]) close(regularisedGammaP(1, x), 1 - Math.exp(-x), 1e-9);
  });
  it('logGamma reference values', () => {
    close(logGamma(5), Math.log(24), 1e-9);
    close(logGamma(0.5), Math.log(Math.sqrt(Math.PI)), 1e-9);
    close(logGamma(1), 0, 1e-9);
  });
  it('chi-square critical values (upper tail)', () => {
    close(chiSquareSf(3.841458821, 1), 0.05, 1e-5);
    close(chiSquareSf(6.634896601, 1), 0.01, 1e-5);
    close(chiSquareSf(5.991464547, 2), 0.05, 1e-5);
    close(chiSquareSf(9.210340372, 2), 0.01, 1e-5);
    close(chiSquareSf(11.07049769, 5), 0.05, 1e-5);
  });
});

describe('Kolmogorov–Smirnov uniformity', () => {
  it('a near-uniform grid is not rejected', () => {
    const n = 500;
    const xs = Array.from({ length: n }, (_, i) => (i + 0.5) / n);
    const r = ksTestUniform(xs);
    expect(r.p).toBeGreaterThan(0.5);
  });
  it('a clearly non-uniform sample is rejected', () => {
    const n = 500;
    const xs = Array.from({ length: n }, (_, i) => ((i + 0.5) / n) ** 3); // skewed toward 0
    const r = ksTestUniform(xs);
    expect(r.p).toBeLessThan(0.01);
  });
});

describe('descriptive helpers', () => {
  it('mean, variance, sd', () => {
    const xs = [2, 4, 4, 4, 5, 5, 7, 9];
    close(mean(xs), 5);
    close(variance(xs), 32 / 7, 1e-9); // unbiased
    close(sd(xs), Math.sqrt(32 / 7), 1e-9);
  });
});
