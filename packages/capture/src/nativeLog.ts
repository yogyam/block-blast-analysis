/**
 * Convert captured native-generator calls (`libtask`'s `offerTopic` requests/responses, logged
 * by `packages/capture/frida/libtask-json-log.js` and rebuilt into a session file) into the
 * per-hand analysis schema of `06-methods.md` §10, so the frozen detector can run on real
 * captured deals.
 *
 * The request carries the pre-deal board (8×8 colour ids, −1 = empty, else filled),
 * `currRecordGrade` (score) and `highRecordGrade` (personal best). The response carries
 * `blockIds` (the three dealt shape ids) and the executed `algoType`. Native shape ids match the
 * engine's 1–51 table (`docs/findings/whitebox.md` §4; `06-methods.md` §10b).
 *
 * CAVEAT (§10b): `blockIds` is the native CANDIDATE. The script layer can alter it before the
 * tray, so a row here is the native candidate, not a guaranteed tray observation; rows are
 * tagged `source: 'shim-candidate'`. A tray-accurate capture is a separate ingest.
 */

import { board, countLegalMoves, getShape, isHandSolvable, isShapeId } from '@blockblast/engine';

/** One recorded native call. */
export interface NativeCall {
  readonly method: string;
  readonly args: readonly string[];
  readonly ret: string;
}

/** A captured session file: `{ calls: NativeCall[] }` (other fields ignored). */
export interface NativeSession {
  readonly calls: readonly NativeCall[];
}

/** One per-hand row in the §10 schema (the fields a native capture can fill). */
export interface CaptureRow {
  readonly game_id: string;
  readonly turn_idx: number;
  readonly board_lo: number;
  readonly board_hi: number;
  readonly hand: [number, number, number];
  readonly is_terminal: boolean;
  readonly hand_solvable: boolean;
  readonly score: number;
  readonly personal_best: number;
  readonly combo_streak: number;
  readonly legal_moves_count: number;
  readonly algo_id: string;
  readonly mode: string;
  readonly source: 'shim-candidate';
}

/** Result of a conversion, with provenance counts. */
export interface IngestResult {
  readonly rows: CaptureRow[];
  readonly totalCalls: number;
  readonly offerCalls: number;
  readonly kept: number;
  readonly skippedMode: number;
  readonly skippedError: number;
  readonly skippedBadHand: number;
  readonly games: number;
  /** Any native shape id seen that is NOT in the engine table (a §9 decode defect; should be empty). */
  readonly unknownShapeIds: number[];
}

/** Pack an 8×8 colour-id grid (−1 = empty) into the engine's two-word bitboard. */
export function parseColorBoard(grid: readonly (readonly number[])[]): { lo: number; hi: number } {
  if (grid.length !== 8) throw new Error(`board must have 8 rows, got ${grid.length}`);
  let lo = 0;
  let hi = 0;
  for (let r = 0; r < 8; r++) {
    const row = grid[r] as readonly number[];
    if (row.length !== 8) throw new Error(`board row ${r} must have 8 cells, got ${row.length}`);
    for (let c = 0; c < 8; c++) {
      if ((row[c] as number) === -1) continue; // empty; anything else is a filled colour id
      const bit = ((r & 3) << 3) | c;
      if (r < 4) lo |= 1 << bit;
      else hi |= 1 << bit;
    }
  }
  return { lo: lo >>> 0, hi: hi >>> 0 };
}

/** Options for {@link sessionToRecords}. */
export interface IngestOptions {
  /** Keep only these modes (default `['class']`: Classic; Adventure/Daily are excluded, §10). */
  readonly modes?: readonly string[];
  readonly gameIdPrefix?: string;
}

/**
 * Convert a captured session's `offerTopic` calls into per-hand rows. Games are segmented on a
 * score reset (`currRecordGrade` dropping below the previous value). Rows with a non-Classic
 * mode, a native error, or a hand that is not three valid shape ids are skipped and counted.
 */
export function sessionToRecords(session: NativeSession, opts: IngestOptions = {}): IngestResult {
  const modes = new Set(opts.modes ?? ['class']);
  const prefix = opts.gameIdPrefix ?? 'live';
  const rows: CaptureRow[] = [];
  const unknown = new Set<number>();
  let offerCalls = 0;
  let skippedMode = 0;
  let skippedError = 0;
  let skippedBadHand = 0;
  let game = -1;
  let prevScore = Infinity;
  let turn = 0;

  for (const call of session.calls) {
    if (call.method !== 'offerTopic') continue;
    offerCalls++;
    let req: Record<string, unknown>;
    let ret: Record<string, unknown>;
    try {
      req = JSON.parse(call.args[0] ?? '{}') as Record<string, unknown>;
      ret = JSON.parse(call.ret) as Record<string, unknown>;
    } catch {
      skippedError++;
      continue;
    }
    const mode = String(req['mode'] ?? '');
    if (!modes.has(mode)) {
      skippedMode++;
      continue;
    }
    if ((ret['errorCode'] as number) !== 0) {
      skippedError++;
      continue;
    }
    const ids = ret['blockIds'];
    if (!Array.isArray(ids) || ids.length !== 3 || !ids.every((x) => Number.isInteger(x) && isShapeId(x as number))) {
      skippedBadHand++;
      if (Array.isArray(ids)) for (const x of ids) if (Number.isInteger(x) && (x as number) !== 0 && !isShapeId(x as number)) unknown.add(x as number);
      continue;
    }
    const hand: [number, number, number] = [ids[0] as number, ids[1] as number, ids[2] as number];
    for (const id of hand) getShape(id); // throws on an id outside the table (§9 halt)

    const score = Number(req['currRecordGrade'] ?? 0);
    const personalBest = Number(req['highRecordGrade'] ?? 0);
    if (game < 0 || score < prevScore) {
      game++;
      turn = 0;
    }
    prevScore = score;

    const grid = req['board'] as number[][];
    const { lo, hi } = parseColorBoard(grid);
    const b = board(lo, hi);
    const remaining = [...hand];
    const legal = countLegalMoves(b, remaining);

    rows.push({
      game_id: `${prefix}-${game}`,
      turn_idx: turn++,
      board_lo: lo,
      board_hi: hi,
      hand,
      is_terminal: legal === 0,
      hand_solvable: isHandSolvable(b, hand),
      score,
      personal_best: personalBest,
      combo_streak: 0, // not in the native request; the detector's combo feature is then constant and dropped
      legal_moves_count: legal,
      algo_id: String(ret['algoType'] ?? ''),
      mode,
      source: 'shim-candidate',
    });
  }

  return {
    rows,
    totalCalls: session.calls.length,
    offerCalls,
    kept: rows.length,
    skippedMode,
    skippedError,
    skippedBadHand,
    games: game + 1,
    unknownShapeIds: [...unknown].sort((a, b2) => a - b2),
  };
}
