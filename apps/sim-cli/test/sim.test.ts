import { describe, expect, it } from 'vitest';
import { board, canPlaceAny, countLegalMoves, isHandSolvable } from '@blockblast/engine';
import { runSim, type SimRow } from '../src/run.ts';
import { formatSummary, parseJsonl, summarizeRows } from '../src/summary.ts';

function collect(generator: string, seed: number, games = 20, agent = 'random', opts?: Record<string, unknown>): SimRow[] {
  const rows: SimRow[] = [];
  runSim({ generator: { name: generator, ...(opts === undefined ? {} : { opts }) }, agent, games, seed, pool: 'ten-ten' }, (r) => rows.push(...r));
  return rows;
}

const FIELDS = [
  'game_id', 'turn_idx', 'board_lo', 'board_hi', 'hand', 'is_terminal', 'pieces_placed', 'score', 'personal_best', 'combo_streak',
  'legal_moves_count', 'chosen_placements', 'lines_cleared', 'generator', 'generator_state_json', 'hand_solvable',
];

describe('runSim', () => {
  it('emits §10 rows that are internally consistent', () => {
    const rows = collect('guarantee-solvable', 3);
    expect(rows.length).toBeGreaterThan(20);
    for (const r of rows) {
      for (const f of FIELDS) expect(r).toHaveProperty(f);
      const b = board(r.board_lo, r.board_hi);
      expect(r.is_terminal).toBe(!r.hand.some((id) => canPlaceAny(b, id)));
      expect(r.legal_moves_count).toBe(countLegalMoves(b, r.hand));
      expect(r.hand_solvable).toBe(r.is_terminal ? false : isHandSolvable(b, r.hand));
      expect(r.generator).toBe('guarantee-solvable(uniform)');
      const state = JSON.parse(r.generator_state_json) as { lastAttempts: number; deals: number };
      expect(state.deals).toBe(r.turn_idx + 1);
      expect(state.lastAttempts).toBeGreaterThanOrEqual(1);
      expect(r.score_after).toBeGreaterThanOrEqual(r.score);
    }
    const games = new Set(rows.map((r) => r.game_id));
    expect(games.size).toBe(20);
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const a = collect('bag', 11, 10);
    const b = collect('bag', 11, 10);
    const c = collect('bag', 12, 10);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('replays its own output through the replay generator', () => {
    const rows = collect('uniform', 5, 1, 'greedy');
    const hands = rows.map((r) => r.hand);
    const replayed = collect('replay', 999, 1, 'greedy', { hands });
    expect(replayed.map((r) => r.hand)).toEqual(hands);
    expect(replayed.map((r) => [r.board_lo, r.board_hi])).toEqual(rows.map((r) => [r.board_lo, r.board_hi]));
  });

  it('rejects unknown agents, generators and options', () => {
    expect(() => collect('uniform', 1, 1, 'oracle')).toThrow(/unknown agent/);
    expect(() => collect('nope', 1, 1)).toThrow(/unknown generator/);
    expect(() => collect('kill', 1, 1, 'random', { hardBais: 2 })).toThrow(/unknown option/);
  });
});

describe('summary', () => {
  it('round-trips through JSONL and reports sane shares', () => {
    const rows = collect('lethal', 21, 30, 'random', { probability: 1 });
    const text = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    const s = summarizeRows(parseJsonl(text));
    expect(s.games).toBe(30);
    expect(s.hands).toBe(rows.length);
    expect(s.meanGameLength).toBeCloseTo(rows.length / 30, 10);
    expect(s.solvableShare).toBeGreaterThan(0);
    expect(s.solvableShare).toBeLessThan(1);
    expect(s.lethalSignatureShare).toBeGreaterThan(0);
    expect(s.hardShareDetector).toBeLessThanOrEqual(s.hardShareGame);
    const finals = new Map<string, number>();
    for (const r of rows) finals.set(r.game_id, Math.max(finals.get(r.game_id) ?? 0, r.score_after));
    expect(s.meanFinalScore).toBeCloseTo([...finals.values()].reduce((a, b) => a + b, 0) / 30, 6);
    expect(formatSummary(s)).toContain('lethal signature');
  });
});
