import { board, countLegalMoves, fromRows } from '@blockblast/engine';
import { describe, expect, it } from 'vitest';
import { parseColorBoard, sessionToRecords, type NativeSession } from '../src/nativeLog.ts';

/** Build an 8×8 colour grid (−1 empty, 1 filled) from engine '#'/'.' rows. */
function colorGrid(rows: readonly string[]): number[][] {
  return rows.map((row) => [...row].map((ch) => (ch === '#' ? 1 : -1)));
}

describe('parseColorBoard', () => {
  it('matches the engine board parser (−1 = empty, else filled)', () => {
    const rows = ['#......#', '........', '..##....', '.......#', '#.......', '........', '....##..', '#......#'];
    const got = parseColorBoard(colorGrid(rows));
    const want = fromRows(rows);
    expect(got.lo >>> 0).toBe(want.lo >>> 0);
    expect(got.hi >>> 0).toBe(want.hi >>> 0);
  });

  it('treats any non −1 colour id as filled', () => {
    const grid = Array.from({ length: 8 }, () => new Array<number>(8).fill(-1));
    grid[0]![0] = 0; // colour 0 is FILLED (−1 is the only empty marker)
    grid[4]![2] = 7;
    const b = parseColorBoard(grid);
    expect(b.lo).toBe(1); // row 0, col 0 → bit 0
    expect(b.hi).toBe((1 << 2) >>> 0); // row 4 → hi, col 2 → bit 2
  });
});

describe('sessionToRecords', () => {
  const req = (o: Record<string, unknown>) => JSON.stringify({ mode: 'class', currRecordGrade: 0, highRecordGrade: 100, board: colorGrid(Array(8).fill('........')), ...o });
  const ret = (o: Record<string, unknown>) => JSON.stringify({ errorCode: 0, algoType: 14011, blockIds: [], ...o });

  it('keeps valid Classic deals, skips empty sub-calls and non-Classic modes', () => {
    const session: NativeSession = {
      calls: [
        { method: 'offerTopic', args: [req({ currRecordGrade: 0 })], ret: ret({ blockIds: [6, 9, 11] }) }, // keep
        { method: 'offerTopic', args: [req({ currRecordGrade: 12 })], ret: ret({ blockIds: [], algoType: 21001 }) }, // empty sub-call
        { method: 'offerTopic', args: [req({ currRecordGrade: 12, mode: 'adventure' })], ret: ret({ blockIds: [1, 2, 3] }) }, // excluded mode
        { method: 'offerTopic', args: [req({ currRecordGrade: 23 })], ret: ret({ blockIds: [5, 5, 4] }) }, // keep
        { method: 'setConfig', args: ['{}'], ret: '{}' }, // not a deal
      ],
    };
    const res = sessionToRecords(session);
    expect(res.offerCalls).toBe(4);
    expect(res.kept).toBe(2);
    expect(res.skippedBadHand).toBe(1);
    expect(res.skippedMode).toBe(1);
    expect(res.unknownShapeIds).toEqual([]);
    expect(res.games).toBe(1); // score only rises → one game
    const r0 = res.rows[0]!;
    expect(r0.hand).toEqual([6, 9, 11]);
    expect(r0.board_lo).toBe(0); // empty board
    expect(r0.source).toBe('shim-candidate');
    // On an empty board every piece fits, so the hand is solvable and not terminal.
    expect(r0.is_terminal).toBe(false);
    expect(r0.hand_solvable).toBe(true);
    expect(r0.legal_moves_count).toBe(countLegalMoves(board(0, 0), [6, 9, 11]));
  });

  it('segments games on a score reset', () => {
    const session: NativeSession = {
      calls: [
        { method: 'offerTopic', args: [req({ currRecordGrade: 50 })], ret: ret({ blockIds: [6, 9, 11] }) },
        { method: 'offerTopic', args: [req({ currRecordGrade: 120 })], ret: ret({ blockIds: [6, 9, 11] }) },
        { method: 'offerTopic', args: [req({ currRecordGrade: 0 })], ret: ret({ blockIds: [6, 9, 11] }) }, // reset → new game
      ],
    };
    const res = sessionToRecords(session);
    expect(res.games).toBe(2);
    expect(res.rows.map((r) => r.game_id)).toEqual(['live-0', 'live-0', 'live-1']);
    expect(res.rows.map((r) => r.turn_idx)).toEqual([0, 1, 0]);
  });
});
