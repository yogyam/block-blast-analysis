import { describe, expect, it } from 'vitest';
import { Xoshiro128ss, hashStringSeed, seedRng, shuffleInPlace } from '../src/rng.ts';

describe('xoshiro128**', () => {
  it('matches hand-computed reference outputs from state [1,2,3,4]', () => {
    const r = Xoshiro128ss.fromState({ algorithm: 'xoshiro128**', s: [1, 2, 3, 4] });
    expect(r.nextUint32()).toBe(11520);
    expect(r.nextUint32()).toBe(0);
    expect(r.nextUint32()).toBe(5927040);
  });

  it('is deterministic per seed and differs across seeds', () => {
    const a = seedRng(42);
    const b = seedRng(42);
    const c = seedRng(43);
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    const sc = Array.from({ length: 10 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(seedRng('hello').next()).toBe(seedRng('hello').next());
    expect(seedRng('hello').next()).not.toBe(seedRng('hellp').next());
    expect(hashStringSeed('')).toBe(0x811c9dc5);
  });

  it('next() is in [0,1) and nextInt(n) in [0,n)', () => {
    const r = seedRng(7);
    for (let i = 0; i < 10_000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const k = r.nextInt(7);
      expect(Number.isInteger(k)).toBe(true);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(7);
    }
    expect(r.nextInt(1)).toBe(0);
    expect(() => r.nextInt(0)).toThrow(RangeError);
    expect(() => r.nextInt(2.5)).toThrow(RangeError);
  });

  it('nextInt is roughly uniform (chi-square, 5 bins, 20k draws)', () => {
    const r = seedRng(11);
    const n = 20_000;
    const bins = [0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) bins[r.nextInt(5)]!++;
    const expected = n / 5;
    const chi2 = bins.reduce((a, b) => a + ((b - expected) ** 2) / expected, 0);
    expect(chi2).toBeLessThan(20); // df=4; p<0.0005 cutoff ≈ 20
  });

  it('state round-trips', () => {
    const a = seedRng(99);
    a.next();
    a.next();
    const state = a.getState();
    const b = Xoshiro128ss.fromState(JSON.parse(JSON.stringify(state)));
    for (let i = 0; i < 20; i++) expect(b.nextUint32()).toBe(a.nextUint32());
  });

  it('fork yields a distinct deterministic stream and advances the parent', () => {
    const p1 = seedRng(5);
    const p2 = seedRng(5);
    const c1 = p1.fork();
    const c2 = p2.fork();
    expect(c1.next()).toBe(c2.next());
    expect(p1.next()).toBe(p2.next());
    const fresh = seedRng(5);
    expect(c1.getState()).not.toEqual(fresh.getState());
    expect(p1.getState()).not.toEqual(seedRng(5).getState());
  });

  it('shuffleInPlace is a permutation', () => {
    const r = seedRng(1);
    const items = [1, 2, 3, 4, 5, 6];
    const out = shuffleInPlace([...items], r);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
  });
});
