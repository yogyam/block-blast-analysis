/**
 * The player loop: read board and tray → ask the engine's GreedyAgent for one placement → drag →
 * verify → log one JSONL record per placement (and one per deal). Human-speed pacing. Stops after
 * N placements, when nothing fits, when a drop cannot be verified, or when the screen is not the
 * normal play screen (dialog, ad, game over): in that case it saves a screenshot and stops rather
 * than tapping around.
 */

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  DEFAULT_POOL,
  GreedyAgent,
  board as makeBoard,
  colByte,
  fullColsMask,
  fullRowsMask,
  getShape,
  place,
  placementAt,
  rowByte,
  seedRng,
  type Board,
  type BoardMask,
  type GameState,
  type ShapeId,
} from '@blockblast/engine';
import { checkScreen, type BoardRead } from './boardReader.ts';
import { Calibration, placeShape, stableRead, type DropAttempt, type FingerModel } from './drag.ts';
import { screenshot } from './screen.ts';
import { describeTray, type TrayRead } from './trayReader.ts';

export interface PlayerOptions {
  /** Stop after this many successful placements. */
  readonly maxPlacements: number;
  /** Directory for the JSONL log, screenshots and calibration.json. */
  readonly outDir: string;
  /** Wait after a drop before reading the screen. */
  readonly settleMs?: number;
  /** Extra random pause between placements, [min, max] ms (on top of settle + reads). */
  readonly paceMs?: readonly [number, number];
  /** Pool the agent assumes for its "still placeable" feature. */
  readonly pool?: readonly ShapeId[];
  readonly log?: (msg: string) => void;
}

interface BoardJson {
  readonly notation: string;
  readonly lo: number;
  readonly hi: number;
}

function boardJson(b: Board, notation?: string): BoardJson {
  let s = notation;
  if (s === undefined) {
    s = '';
    for (let i = 0; i < 32; i++) s += (b.lo >>> i) & 1 ? '#' : '.';
    for (let i = 0; i < 32; i++) s += (b.hi >>> i) & 1 ? '#' : '.';
  }
  return { notation: s, lo: b.lo, hi: b.hi };
}

/** Lines the observed board shows cleared: full lines of (before + piece) that are empty afterwards. */
export function observedLinesCleared(before: Board, piece: BoardMask, after: Board): number {
  const bc = makeBoard(before.lo | piece.lo, before.hi | piece.hi);
  const rows = fullRowsMask(bc);
  const cols = fullColsMask(bc);
  let n = 0;
  for (let r = 0; r < 8; r++) if ((rows >>> r) & 1 && rowByte(after, r) === 0) n++;
  for (let c = 0; c < 8; c++) if ((cols >>> c) & 1 && colByte(after, c) === 0) n++;
  return n;
}

export interface DealRecord {
  readonly type: 'deal';
  readonly ts: string;
  readonly step: number;
  readonly initial: boolean;
  readonly hand: readonly (ShapeId | null)[];
  readonly masks: readonly (readonly string[] | null)[];
  readonly board: BoardJson;
  readonly screenshot: string;
}

export interface PlacementRecord {
  readonly type: 'placement';
  readonly ts: string;
  readonly step: number;
  readonly boardBefore: BoardJson;
  readonly hand: readonly (ShapeId | null)[];
  readonly unknownSlots: readonly { slot: number; mask: readonly string[] | null }[];
  readonly chosen: { slot: number; shapeId: ShapeId; row: number; col: number };
  readonly actual: { row: number; col: number } | null;
  readonly outcome: string;
  readonly attempts: readonly DropAttempt[];
  readonly boardAfterExpected: BoardJson;
  readonly boardAfter: BoardJson;
  readonly linesClearedExpected: number;
  readonly linesClearedObserved: number | null;
  readonly boardMatchesExpected: boolean;
  readonly trayAfter: readonly (ShapeId | null)[];
  readonly dealt: boolean;
  readonly model: FingerModel;
  readonly screenshotBefore: string;
  readonly screenshotAfter: string | null;
}

export interface StopRecord {
  readonly type: 'stop';
  readonly ts: string;
  readonly step: number;
  readonly reason: string;
  readonly screenshot: string | null;
  readonly summary: PlayerSummary;
}

export interface PlayerSummary {
  placements: number;
  firstTrySuccesses: number;
  retriedSuccesses: number;
  deals: (readonly (ShapeId | null)[])[];
  stopReason: string;
  finalScreenshot: string | null;
  jsonlPath: string;
  model: FingerModel;
}

function fakeState(board: Board, hand: readonly (ShapeId | null)[]): GameState {
  const h = [hand[0] ?? null, hand[1] ?? null, hand[2] ?? null] as const;
  return {
    board,
    hand: h,
    dealtHand: [h[0] ?? 0, h[1] ?? 0, h[2] ?? 0],
    score: 0,
    combo: 0,
    turn: 0,
    personalBest: 0,
    placedInTurn: 0,
    linesClearedInTurn: 0,
    totalLinesCleared: 0,
    piecesPlaced: 0,
    gameOver: false,
  };
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function piecesIn(t: TrayRead): number {
  return t.slots.filter((s) => s.blob !== null).length;
}

/** Run the player against the emulator. */
export async function runPlayer(opts: PlayerOptions): Promise<PlayerSummary> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const runId = stamp();
  mkdirSync(opts.outDir, { recursive: true });
  const shotsDir = join(opts.outDir, `${runId}-shots`);
  mkdirSync(shotsDir, { recursive: true });
  const jsonlPath = join(opts.outDir, `${runId}.jsonl`);
  writeFileSync(jsonlPath, '');
  const calibration = new Calibration(join(opts.outDir, 'calibration.json'));
  const agent = new GreedyAgent();
  const pool = opts.pool ?? DEFAULT_POOL;
  const rng = seedRng(1);
  const pace = opts.paceMs ?? [500, 2500];

  const summary: PlayerSummary = {
    placements: 0,
    firstTrySuccesses: 0,
    retriedSuccesses: 0,
    deals: [],
    stopReason: '',
    finalScreenshot: null,
    jsonlPath,
    model: calibration.model,
  };
  const emit = (rec: DealRecord | PlacementRecord | StopRecord): void => {
    appendFileSync(jsonlPath, `${JSON.stringify(rec)}\n`);
  };
  const stop = (reason: string, step: number, shotPath: string | null): PlayerSummary => {
    summary.stopReason = reason;
    summary.finalScreenshot = shotPath;
    summary.model = calibration.model;
    calibration.save();
    emit({ type: 'stop', ts: new Date().toISOString(), step, reason, screenshot: shotPath, summary });
    log(`stop: ${reason}`);
    return summary;
  };

  let lastTrayCount = -1;
  let step = 0;
  log(`run ${runId}: log ${jsonlPath}; model ${JSON.stringify(calibration.model)}; ${calibration.observations.length} prior landings`);

  for (;;) {
    const beforePath = join(shotsDir, `${String(step).padStart(3, '0')}-before.png`);
    const state = await stableRead(beforePath);
    const screen = checkScreen(state.img, state.board);
    if (screen.kind !== 'play') {
      return stop(`unexpected screen: ${screen.reasons.join('; ')}`, step, beforePath);
    }
    const tray = state.tray;
    const board = state.board.board;
    const count = piecesIn(tray);
    log(`step ${step}: board ${state.board.notation}  tray ${describeTray(tray)}`);

    if (count === 3 && lastTrayCount !== 3) {
      const rec: DealRecord = {
        type: 'deal',
        ts: new Date().toISOString(),
        step,
        initial: lastTrayCount === -1,
        hand: tray.hand,
        masks: tray.slots.map((s) => s.mask),
        board: boardJson(board, state.board.notation),
        screenshot: beforePath,
      };
      emit(rec);
      summary.deals.push(tray.hand);
      log(`deal: ${tray.hand.map((h) => (h === null ? '?' : `#${h}`)).join(' ')}`);
    }
    lastTrayCount = count;

    if (summary.placements >= opts.maxPlacements) {
      return stop(`reached ${opts.maxPlacements} placements`, step, beforePath);
    }
    if (count === 0) return stop('tray empty (refill did not arrive?)', step, beforePath);

    const remaining = tray.hand.filter((h): h is ShapeId => h !== null);
    const unknownSlots = tray.slots.filter((s) => s.blob !== null && s.shapeId === null).map((s) => ({ slot: s.slot, mask: s.mask }));
    if (unknownSlots.length > 0) log(`unknown tray shapes: ${JSON.stringify(unknownSlots)}`);
    if (remaining.length === 0) return stop('no recognisable piece in the tray', step, beforePath);

    const chosen = agent.choose(board, remaining, { rng, state: fakeState(board, tray.hand), pool });
    if (chosen === null) return stop('no remaining piece fits (game over by our reading)', step, beforePath);
    const slotIdx = tray.slots.findIndex((s) => s.shapeId === chosen.shapeId);
    if (slotIdx < 0) return stop('agent chose a shape that is not in the tray', step, beforePath);
    const slot = slotIdx as 0 | 1 | 2;

    const shape = getShape(chosen.shapeId);
    const mask = placementAt(shape, chosen.row, chosen.col);
    if (mask === undefined) return stop('agent chose an off-board anchor', step, beforePath);
    const expected = place(board, mask);

    const result = await placeShape(board, tray, slot, chosen.shapeId, chosen.row, chosen.col, {
      calibration,
      settleMs: opts.settleMs ?? 1500,
      maxRetries: 3,
      shotPath: (attempt) => join(shotsDir, `${String(step).padStart(3, '0')}-after${attempt > 0 ? `-retry${attempt}` : ''}.png`),
      log,
    });

    const actualMask = result.actual === null ? null : placementAt(shape, result.actual.row, result.actual.col);
    const observedLines = actualMask ? observedLinesCleared(board, actualMask, result.boardAfter.board) : null;
    const after: BoardRead = result.boardAfter;
    const dealt = piecesIn(result.trayAfter) === 3 && count === 1 && result.ok;
    const rec: PlacementRecord = {
      type: 'placement',
      ts: new Date().toISOString(),
      step,
      boardBefore: boardJson(board, state.board.notation),
      hand: tray.hand,
      unknownSlots,
      chosen: { slot, shapeId: chosen.shapeId, row: chosen.row, col: chosen.col },
      actual: result.actual,
      outcome: result.outcome,
      attempts: result.attempts,
      boardAfterExpected: boardJson(expected.board),
      boardAfter: boardJson(after.board, after.notation),
      linesClearedExpected: expected.linesCleared,
      linesClearedObserved: observedLines,
      boardMatchesExpected: after.board.lo === expected.board.lo && after.board.hi === expected.board.hi,
      trayAfter: result.trayAfter.hand,
      dealt,
      model: calibration.model,
      screenshotBefore: beforePath,
      screenshotAfter: result.screenshotPath,
    };
    emit(rec);

    if (!result.ok) {
      return stop(`drop failed: ${result.outcome} (${result.attempts.map((a) => a.note ?? a.outcome).join(' | ')})`, step, result.screenshotPath);
    }
    summary.placements++;
    if (result.attempts.length === 1 && result.outcome === 'placed') summary.firstTrySuccesses++;
    else if (result.outcome === 'placed') summary.retriedSuccesses++;
    log(`placed #${chosen.shapeId} at (${result.actual?.row},${result.actual?.col}) [${result.outcome}, ${result.attempts.length} attempt(s)]; lines expected ${expected.linesCleared} observed ${observedLines}; ${summary.placements}/${opts.maxPlacements}`);

    if (summary.placements >= opts.maxPlacements) {
      if (dealt) {
        // The last placement emptied the tray and a refill arrived: log that deal before stopping.
        const dealRec: DealRecord = {
          type: 'deal',
          ts: new Date().toISOString(),
          step: step + 1,
          initial: false,
          hand: result.trayAfter.hand,
          masks: result.trayAfter.slots.map((s) => s.mask),
          board: boardJson(after.board, after.notation),
          screenshot: result.screenshotPath ?? beforePath,
        };
        emit(dealRec);
        summary.deals.push(result.trayAfter.hand);
        log(`deal: ${result.trayAfter.hand.map((h) => (h === null ? '?' : `#${h}`)).join(' ')}`);
      }
      const finalPath = join(opts.outDir, `${runId}-final.png`);
      await sleep(1000);
      screenshot(finalPath);
      return stop(`reached ${opts.maxPlacements} placements`, step + 1, finalPath);
    }
    const pauseMs = pace[0] + Math.random() * (pace[1] - pace[0]);
    await sleep(pauseMs);
    step++;
  }
}
