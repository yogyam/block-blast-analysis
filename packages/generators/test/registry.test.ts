import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, TEN_TEN_POOL, seedRng } from '@blockblast/engine';
import { GENERATOR_INFO, GENERATOR_ZOO, buildGenerator, describeGenerator, kindOf, listGenerators } from '../src/registry.ts';
import { SPECS, preDealState } from './helpers.ts';

const REQUIRED_OPTS: Record<string, Record<string, unknown>> = {
  mixture: { components: [{ name: 'uniform', weight: 1 }] },
  replay: { hands: [[1, 1, 1]], loop: true },
};

describe('GENERATOR_ZOO', () => {
  it('covers the §7 zoo plus the live-game model, and every entry builds and deals with default options', () => {
    const names = listGenerators();
    expect(names).toEqual(expect.arrayContaining(['uniform', 'weighted', 'bag', 'guarantee-one-fits', 'guarantee-solvable', 'rescue', 'kill', 'lethal', 'per-game-difficulty', 'slot-biased', 'mixture', 'replay', 'blockblast-like']));
    expect(Object.keys(GENERATOR_INFO).sort()).toEqual([...names].sort());
    expect(SPECS.map((s) => s.name).sort()).toEqual([...names].sort());
    for (const name of names) {
      const gen = (GENERATOR_ZOO[name] as (o: Record<string, unknown>, p: readonly number[]) => { next: (s: unknown, r: unknown) => readonly number[]; name: string })(REQUIRED_OPTS[name] ?? {}, TEN_TEN_POOL);
      expect(kindOf(gen.name)).toBe(name);
      expect(gen.next(preDealState(EMPTY_BOARD), seedRng(1))).toHaveLength(3);
    }
  });

  it('nests base specs and rejects unknown names and options', () => {
    const gen = buildGenerator({ name: 'rescue', opts: { base: { name: 'kill', opts: { base: 'bag', scoreThreshold: 10, hardBias: 2 } }, fillThreshold: 0.4, strength: 1 } }, TEN_TEN_POOL);
    expect(gen.name).toBe('rescue(kill(bag))');
    expect(() => buildGenerator('nope')).toThrow(/unknown generator/);
    expect(() => buildGenerator({ name: 'kill', opts: { hardBais: 2 } })).toThrow(/unknown option/);
    expect(() => buildGenerator({ name: 'kill', opts: { scoreThreshold: 'soon' } })).toThrow(TypeError);
    expect(() => buildGenerator({ name: 'mixture' })).toThrow(TypeError);
  });

  it('describes entries by name and instances with their state', () => {
    const byName = describeGenerator('lethal');
    expect(byName.kind).toBe('lethal');
    expect(byName.control).toMatch(/H4/);
    expect(Object.keys(byName.knobs)).toContain('probability');
    const inst = buildGenerator({ name: 'kill', opts: { scoreThreshold: 5, hardBias: 2 } }, TEN_TEN_POOL);
    const d = describeGenerator(inst);
    expect(d.kind).toBe('kill');
    expect(d.name).toBe('kill(uniform)');
    expect(d.pool).toEqual(TEN_TEN_POOL);
    expect(d.state).toMatchObject({ hardBias: 2, scoreThreshold: { absolute: 5 } });
    expect(describeGenerator('scripted').kind).toBe('unknown');
  });
});
