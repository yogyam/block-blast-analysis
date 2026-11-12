import { describe, expect, it } from 'vitest';
import { RandomAgent, board, isHandSolvable, pHandSolvable, playGame, seedRng, uniformWeights } from '@blockblast/engine';
import { BlockBlastLikeGenerator } from '../src/blockBlastLike.ts';
import { hasLethalSignature } from '../src/lethal.ts';
import { EARLY_FILTER_IDS, LETHAL_SEARCH_POOL, LIVE_EARLY_POOL, LIVE_POOL } from '../src/pools.ts';
import { preDealState, randomBoards } from './helpers.ts';

type BBState = { lethal: { requested: number; found: number; dealt: number; withheld: number }; noSolvable: number; regimes: Record<string, number> };

describe('BlockBlastLikeGenerator', () => {
  it('has the observed values as defaults', () => {
    const gen = new BlockBlastLikeGenerator();
    expect(gen.options).toMatchObject({ earlyUntil: 600, lethalFrom: 800, lethalProbability: 1, dealLethal: 0 });
    expect(gen.fullPool).toEqual(LIVE_POOL);
    expect(gen.earlyPool).toEqual(LIVE_EARLY_POOL);
    expect(gen.lethalPool).toEqual(LETHAL_SEARCH_POOL);
    expect(gen.pool).toEqual(LIVE_POOL); // lethal hands are never dealt by default
    const b = randomBoards(seedRng(1), 1, 0.3, 0.3)[0]!;
    expect(gen.regimeAt(preDealState(b, { score: 0 }))).toBe('early');
    expect(gen.regimeAt(preDealState(b, { score: 600 }))).toBe('mid');
    expect(gen.regimeAt(preDealState(b, { score: 814 }))).toBe('late');
  });

  it('deals only filtered pieces in the early game', () => {
    const gen = new BlockBlastLikeGenerator();
    const rng = seedRng(2);
    for (const b of randomBoards(seedRng(3), 200, 0, 0.6)) {
      for (const id of gen.next(preDealState(b, { score: 100 }), rng)) {
        expect(LIVE_EARLY_POOL).toContain(id);
        expect(EARLY_FILTER_IDS).not.toContain(id);
      }
    }
    expect((gen.serializeState() as BBState).regimes).toEqual({ early: 200, mid: 0, late: 0 });
  });

  for (const regimeOpts of [{}, { earlyUntil: 0, lethalFrom: 0 }]) {
    it(`never deals an unsolvable hand when dealLethal is 0 and a solvable one exists (${JSON.stringify(regimeOpts)})`, () => {
      const gen = new BlockBlastLikeGenerator({ ...regimeOpts, dealLethal: 0 });
      const rng = seedRng(4);
      const totals = { requested: 0, found: 0, dealt: 0, withheld: 0, noSolvable: 0 };
      let unsolvableDeals = 0;
      let hands = 0;
      for (let game = 0; game < 150; game++) {
        const g = playGame(gen, new RandomAgent(), rng.fork(), { oracle: true, maxTurns: 300 }); // playGame resets the generator per game
        const state = gen.serializeState() as BBState;
        totals.requested += state.lethal.requested;
        totals.found += state.lethal.found;
        totals.dealt += state.lethal.dealt;
        totals.withheld += state.lethal.withheld;
        totals.noSolvable += state.noSolvable;
        for (const t of g.turns) {
          hands++;
          if (t.hand_solvable) continue;
          unsolvableDeals++;
          const b = board(t.board_lo, t.board_hi);
          const regime = gen.regimeAt(preDealState(b, { score: t.score, personalBest: t.personal_best }));
          const p = pHandSolvable(b, uniformWeights(gen.poolFor(regime)), { exactThreshold: 64 });
          expect(p.exact).toBe(true);
          expect(p.p).toBe(0);
        }
      }
      console.log(`[blockblast-like ${JSON.stringify(regimeOpts)}] ${hands} hands in 150 random-agent games, ${unsolvableDeals} dealt with no solvable hand available; lethal ${JSON.stringify(totals)}`);
      expect(totals.dealt).toBe(0);
      expect(totals.noSolvable).toBe(unsolvableDeals);
      if ('lethalFrom' in regimeOpts) {
        expect(totals.requested).toBe(hands); // every late deal asks for the lethal search
        expect(totals.found).toBeGreaterThan(0);
        expect(totals.withheld).toBe(totals.found);
      } else {
        expect(totals.requested).toBe(0); // random-agent games never reach score 800
      }
    });
  }

  it('deals the lethal signature at the configured rate when dealLethal is 1', () => {
    for (const probability of [1, 0.5]) {
      const gen = new BlockBlastLikeGenerator({ earlyUntil: 0, lethalFrom: 0, lethalProbability: probability, dealLethal: 1 });
      expect(gen.pool).toEqual([...new Set([...LIVE_POOL, ...LETHAL_SEARCH_POOL])]);
      const rng = seedRng(5);
      gen.reset();
      let signature = 0;
      const boards = randomBoards(seedRng(6), 400, 0.35, 0.65);
      for (const b of boards) {
        const before = (gen.serializeState() as BBState).lethal.dealt;
        const hand = gen.next(preDealState(b, { score: 1000 }), rng);
        const after = (gen.serializeState() as BBState).lethal.dealt;
        if (after > before) {
          signature++;
          expect(hasLethalSignature(b, hand)).toBe(true);
        } else {
          expect(isHandSolvable(b, hand) || pHandSolvable(b, uniformWeights(LIVE_POOL), { exactThreshold: 64 }).p === 0).toBe(true);
        }
      }
      const { lethal } = gen.serializeState() as BBState;
      console.log(`[blockblast-like dealLethal=1 p=${probability}] requested ${lethal.requested}/400, found ${lethal.found}, dealt ${lethal.dealt}, signature ${signature}`);
      expect(lethal.dealt).toBe(lethal.found);
      expect(signature).toBe(lethal.dealt);
      expect(lethal.found).toBeGreaterThan(40);
      expect(lethal.requested / 400).toBeGreaterThan(probability - 0.08);
      expect(lethal.requested / 400).toBeLessThan(probability + 0.08);
    }
  });

  it('validates its knobs', () => {
    expect(() => new BlockBlastLikeGenerator({ dealLethal: 2 })).toThrow(RangeError);
    expect(() => new BlockBlastLikeGenerator({ fitBias: 0.5 })).toThrow(RangeError);
    expect(() => new BlockBlastLikeGenerator({ pool: [11, 12], filterIds: [11, 12] })).toThrow(/whole pool/);
  });
});
