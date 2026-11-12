import { describe, expect, it } from 'vitest';
import { DEFAULT_POOL, RandomAgent, isShapeId, playGames, seedRng } from '@blockblast/engine';
import { buildGenerator } from '../src/registry.ts';
import { SPECS, TEN_TEN_POOL, dealSequence, randomBoards } from './helpers.ts';

describe('determinism under a fixed seed', () => {
  for (const spec of SPECS) {
    it(`${spec.name}: identical hands and states on 40 boards, and in 3 played games`, () => {
      const boards = randomBoards(seedRng(7), 40, 0, 0.7);
      const a = dealSequence(buildGenerator(spec, TEN_TEN_POOL), boards, seedRng(42));
      const b = dealSequence(buildGenerator(spec, TEN_TEN_POOL), boards, seedRng(42));
      expect(a.hands).toEqual(b.hands);
      expect(JSON.stringify(a.states)).toBe(JSON.stringify(b.states));
      // A different seed changes something for every stochastic generator.
      if (spec.name !== 'replay') {
        const c = dealSequence(buildGenerator(spec, TEN_TEN_POOL), boards, seedRng(43));
        expect(JSON.stringify(c.hands)).not.toBe(JSON.stringify(a.hands));
      }
      const g1 = playGames(3, buildGenerator(spec, TEN_TEN_POOL), new RandomAgent(), seedRng(5), { maxTurns: 60 });
      const g2 = playGames(3, buildGenerator(spec, TEN_TEN_POOL), new RandomAgent(), seedRng(5), { maxTurns: 60 });
      expect(g1.map((g) => g.turns.map((t) => t.hand))).toEqual(g2.map((g) => g.turns.map((t) => t.hand)));
    });

    it(`${spec.name}: deals valid hands from its pool and serialises JSON-able state`, () => {
      const gen = buildGenerator(spec, DEFAULT_POOL);
      const boards = randomBoards(seedRng(8), 30, 0, 0.7);
      const { hands, states } = dealSequence(gen, boards, seedRng(1));
      for (const h of hands) {
        expect(h).toHaveLength(3);
        for (const id of h) {
          expect(isShapeId(id)).toBe(true);
          if (gen.pool !== undefined) expect(gen.pool).toContain(id);
        }
      }
      const raw = gen.serializeState();
      const text = JSON.stringify(raw);
      expect(typeof text).toBe('string');
      expect(JSON.stringify(JSON.parse(text))).toBe(text);
      expect(text).not.toContain('null,null,null'); // no accidental Infinity/undefined in arrays
      expect(states[states.length - 1]).toEqual(JSON.parse(text));
    });
  }
});
