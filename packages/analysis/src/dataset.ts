/**
 * The detector's input: one record per dealt hand, in the `06-methods.md` §10 schema (the
 * subset the tests need). `SimRow` from the simulator and a parsed real-data JSONL row both
 * satisfy {@link HandRecord} structurally, so the same detector runs on simulated and captured
 * data. Records are grouped into games (ordered by turn) before any test.
 */

import { board, DEFAULT_POOL, weightsFromCounts, type Board, type ShapeId, type Weights } from '@blockblast/engine';
import type { GameLog } from '@blockblast/engine';

/** One dealt hand. Field names match the frozen §10 schema; extra fields are ignored. */
export interface HandRecord {
  readonly game_id: string;
  readonly turn_idx: number;
  /** Board words at the moment of dealing (rows 0–3, 4–7). */
  readonly board_lo: number;
  readonly board_hi: number;
  /** The dealt triple, slot order left to right. */
  readonly hand: readonly [ShapeId, ShapeId, ShapeId];
  /** No piece of this hand can be placed at deal time. */
  readonly is_terminal: boolean;
  /** Oracle verdict: the hand is fully placeable in some order (D_t = !hand_solvable). */
  readonly hand_solvable: boolean;
  readonly score: number;
  readonly personal_best: number;
  readonly combo_streak: number;
  /** Legal (piece, anchor) pairs at deal time; > 0 iff some piece fits. */
  readonly legal_moves_count: number;
  /** Seconds since the previous hand; absent in simulation. */
  readonly seconds_since_last_hand?: number;
  /** Server-assigned arm, for H7 stratification; absent in simulation. */
  readonly bucket_id?: string;
  readonly plan?: string;
  /** Ad covariates for H8; absent in simulation. */
  readonly revive_offered?: boolean;
  readonly ad_shown?: boolean;
  readonly ad_ecpm?: number | null;
  readonly algo_id?: string | null;
  /** Segment id (increments on revive); the primary analysis uses first segments only. */
  readonly segment_id?: string;
}

/** A game: its hands in turn order. */
export type Game = readonly HandRecord[];

/** The board at deal time of a record. */
export function boardOf(r: HandRecord): Board {
  return board(r.board_lo, r.board_hi);
}

/** Group records into games and order each game's hands by `turn_idx`. Input order is otherwise kept. */
export function groupByGame(records: readonly HandRecord[]): Game[] {
  const byId = new Map<string, HandRecord[]>();
  const order: string[] = [];
  for (const r of records) {
    let g = byId.get(r.game_id);
    if (g === undefined) {
      g = [];
      byId.set(r.game_id, g);
      order.push(r.game_id);
    }
    g.push(r);
  }
  return order.map((id) => {
    const g = byId.get(id) as HandRecord[];
    return [...g].sort((a, b) => a.turn_idx - b.turn_idx);
  });
}

/**
 * The plug-in marginal F (marginal-estimation rule, §4): pooled counts of every dealt shape id
 * across all records. Shapes never dealt get weight zero, the correct H0 treatment (§9).
 */
export function estimateWeights(records: readonly HandRecord[]): Weights {
  const counts = new Map<ShapeId, number>();
  for (const r of records) {
    for (const id of r.hand) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return weightsFromCounts(counts);
}

/** The analysis set P (§9): the shape ids observed at least once, sorted ascending. */
export function observedPool(records: readonly HandRecord[]): ShapeId[] {
  const seen = new Set<ShapeId>();
  for (const r of records) for (const id of r.hand) seen.add(id);
  return [...seen].sort((a, b) => a - b);
}

/**
 * Convert engine {@link GameLog}s to records. Requires `oracle: true` at play time so
 * `hand_solvable` is populated (the detector's H4 needs it). Each game gets a distinct id.
 */
export function recordsFromGameLogs(logs: readonly GameLog[], idPrefix = 'g'): HandRecord[] {
  const out: HandRecord[] = [];
  logs.forEach((log, gi) => {
    const game_id = `${idPrefix}${gi}`;
    for (const t of log.turns) {
      if (t.hand_solvable === undefined) {
        throw new Error('recordsFromGameLogs: game logs lack hand_solvable; play with { oracle: true }');
      }
      out.push({
        game_id,
        turn_idx: t.turn_idx,
        board_lo: t.board_lo,
        board_hi: t.board_hi,
        hand: [t.hand[0], t.hand[1], t.hand[2]],
        is_terminal: t.is_terminal,
        hand_solvable: t.hand_solvable,
        score: t.score,
        personal_best: t.personal_best,
        combo_streak: t.combo_streak,
        legal_moves_count: t.legal_moves_count,
      });
    }
  });
  return out;
}

/** Default analysis pool when none is derived from data. */
export const DEFAULT_ANALYSIS_POOL: readonly ShapeId[] = DEFAULT_POOL;
