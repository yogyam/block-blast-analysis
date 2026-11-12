/**
 * Drag a tray piece onto the board with adb motion events, using a calibrated finger model.
 *
 * The lifted piece does not sit under the finger: it is scaled up and floats above it, and the
 * offset grows with the drag distance (phase2-log, 2026-11-10). The model is affine in the
 * displacement from the pickup point, per axis:
 *
 *     piece_x = pickup_x + kx * (finger_x - pickup_x) + liftX
 *     piece_y = pickup_y + ky * (finger_y - pickup_y) + liftY
 *
 * Fitted values for y: ky = 1.515, liftY ≈ -256 (equivalently piece_y ≈ 1.515 * finger_y - 1191
 * for a pickup at y ≈ 1815). The x axis was verified to use the same gain (kx = 1.515, liftX = 0)
 * with a held-piece screenshot. Observed landings keep refitting both axes; see {@link Calibration}.
 *
 * Only `adb shell input motionevent` works with this Cocos build: one adb call per event,
 * DOWN, ~10 MOVEs, UP (`scripts/phase2/drag.sh`).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { getShape, place, toString as boardToString, type Board, type ShapeId } from '@blockblast/engine';
import { checkScreen, readBoard, type BoardRead } from './boardReader.ts';
import { BOARD, placementCenter, type BoardGeometry } from './geometry.ts';
import { adb, screenshot, type Screenshot } from './screen.ts';
import { readTray, type TrayRead } from './trayReader.ts';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface FingerModel {
  readonly kx: number;
  readonly liftX: number;
  readonly ky: number;
  readonly liftY: number;
}

/**
 * Measured 2026-11-10: a held piece dragged 300 px left / 518 px up from slot 2 (855, 1818) was
 * drawn centred at (404, 772); the isotropic k = 1.515 model predicts (401, 777). So x follows
 * the same gain as y, about the pickup point, with no lateral lift.
 */
export const DEFAULT_FINGER_MODEL: FingerModel = { kx: 1.515, liftX: 0, ky: 1.515, liftY: -259 };

/** Where the piece centre ends up for a finger position (forward model). */
export function pieceForFinger(pickup: Point, finger: Point, m: FingerModel): Point {
  return {
    x: pickup.x + m.kx * (finger.x - pickup.x) + m.liftX,
    y: pickup.y + m.ky * (finger.y - pickup.y) + m.liftY,
  };
}

/** Finger position that puts the piece centre on `target` (inverse model), plus an optional nudge. */
export function fingerForTarget(pickup: Point, target: Point, m: FingerModel, offset: Point = { x: 0, y: 0 }): Point {
  return {
    x: Math.round(pickup.x + (target.x - pickup.x - m.liftX) / m.kx + offset.x),
    y: Math.round(pickup.y + (target.y - pickup.y - m.liftY) / m.ky + offset.y),
  };
}

/** Finger position for dropping `shapeId` with its bounding box anchored at (row, col). */
export function fingerForPlacement(pickup: Point, shapeId: ShapeId, row: number, col: number, m: FingerModel, offset?: Point, g: BoardGeometry = BOARD): { finger: Point; target: Point } {
  const s = getShape(shapeId);
  const target = placementCenter(row, col, s.width, s.height, g);
  return { finger: fingerForTarget(pickup, target, m, offset), target };
}

/** Intermediate finger positions for a stepped drag (excluding the start, including the end). */
export function dragPath(from: Point, to: Point, steps = 10): Point[] {
  const out: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    out.push({ x: Math.round(from.x + ((to.x - from.x) * i) / steps), y: Math.round(from.y + ((to.y - from.y) * i) / steps) });
  }
  return out;
}

function motion(kind: 'DOWN' | 'MOVE' | 'UP', p: Point): void {
  adb(['shell', 'input', 'motionevent', kind, String(p.x), String(p.y)]);
}

/** Perform the drag: DOWN at `from`, stepped MOVEs, a settle pause, UP at `to`. */
export async function executeDrag(from: Point, to: Point, opts: { steps?: number; settleMs?: number } = {}): Promise<void> {
  const steps = opts.steps ?? 10;
  motion('DOWN', from);
  // A small first move registers the pickup before the long travel.
  motion('MOVE', { x: from.x, y: from.y - 5 });
  for (const p of dragPath(from, to, steps)) motion('MOVE', p);
  motion('MOVE', to);
  await sleep(opts.settleMs ?? 150);
  motion('UP', to);
}

// ---------------------------------------------------------------------------------------------
// Calibration: observed landings refine the model.

export interface LandingObservation {
  readonly ts: string;
  readonly slot: number;
  readonly shapeId: ShapeId;
  readonly pickup: Point;
  readonly finger: Point;
  /** Offset that was added to the model's finger position for this attempt. */
  readonly offset: Point;
  /** Where we aimed (piece centre) and where the piece actually landed (piece centre). */
  readonly target: Point;
  readonly landed: Point;
  readonly intended: { row: number; col: number };
  readonly actual: { row: number; col: number };
}

export interface CalibrationFile {
  readonly model: FingerModel;
  readonly observations: LandingObservation[];
  readonly updatedAt: string;
}

/** Least-squares fit of p = k * d + c; returns null when the d spread is too small for a slope. */
export function fitAxis(pairs: ReadonlyArray<readonly [number, number]>, prior: { k: number; c: number }, minSpread = 150): { k: number; c: number } {
  if (pairs.length === 0) return prior;
  const n = pairs.length;
  let sd = 0;
  let sp = 0;
  for (const [d, p] of pairs) {
    sd += d;
    sp += p;
  }
  const md = sd / n;
  const mp = sp / n;
  let minD = Infinity;
  let maxD = -Infinity;
  for (const [d] of pairs) {
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
  }
  if (n < 2 || maxD - minD < minSpread) {
    // Not enough leverage for a slope: keep the prior slope, move the intercept.
    return { k: prior.k, c: mp - prior.k * md };
  }
  let sdd = 0;
  let sdp = 0;
  for (const [d, p] of pairs) {
    sdd += (d - md) * (d - md);
    sdp += (d - md) * (p - mp);
  }
  let k = sdp / sdd;
  // Landings are snapped to cell centres, so a few points can suggest a wild slope; only accept a
  // slope within 20% of the prior and keep the prior otherwise (adjusting the intercept).
  if (!Number.isFinite(k) || Math.abs(k - prior.k) > 0.2 * prior.k) k = prior.k;
  return { k, c: mp - k * md };
}

/** The finger model plus the landings it was fitted from. Persisted as JSON. */
export class Calibration {
  model: FingerModel;
  readonly observations: LandingObservation[];
  readonly path: string | null;

  constructor(path: string | null, model: FingerModel = DEFAULT_FINGER_MODEL) {
    this.path = path;
    this.model = model;
    this.observations = [];
    if (path !== null && existsSync(path)) {
      const file = JSON.parse(readFileSync(path, 'utf8')) as CalibrationFile;
      this.model = file.model;
      this.observations.push(...file.observations);
    }
  }

  /** Record a landing and refit both axes. */
  add(obs: LandingObservation): void {
    this.observations.push(obs);
    this.refit();
    this.save();
  }

  /** Refit: x from all observations; y keeps the phase-2 slope unless there is a wide spread. */
  refit(): void {
    const xs = this.observations.map((o) => [o.finger.x - o.pickup.x, o.landed.x - o.pickup.x] as const);
    const ys = this.observations.map((o) => [o.finger.y - o.pickup.y, o.landed.y - o.pickup.y] as const);
    const fx = fitAxis(xs, { k: this.model.kx, c: this.model.liftX });
    const fy = fitAxis(ys, { k: this.model.ky, c: this.model.liftY }, 250);
    this.model = { kx: fx.k, liftX: fx.c, ky: fy.k, liftY: fy.c };
  }

  save(): void {
    if (this.path === null) return;
    mkdirSync(dirname(this.path), { recursive: true });
    const file: CalibrationFile = { model: this.model, observations: this.observations, updatedAt: new Date().toISOString() };
    writeFileSync(this.path, JSON.stringify(file, null, 2));
  }
}

// ---------------------------------------------------------------------------------------------
// Placement with verification.

export type DropOutcome = 'placed' | 'placed-elsewhere' | 'missed' | 'unexpected';

export interface DropAttempt {
  readonly finger: Point;
  readonly offset: Point;
  readonly outcome: DropOutcome;
  readonly note?: string;
}

export interface PlaceResultInfo {
  readonly ok: boolean;
  readonly outcome: DropOutcome;
  readonly attempts: DropAttempt[];
  /** Where the piece actually landed (anchor), when it landed. */
  readonly actual: { row: number; col: number } | null;
  readonly boardAfter: BoardRead;
  readonly trayAfter: TrayRead;
  readonly screenshotAfter: Screenshot;
  readonly screenshotPath: string | null;
}

export interface PlaceOptions {
  readonly calibration: Calibration;
  /** Wait after UP before reading the screen. */
  readonly settleMs?: number;
  readonly maxRetries?: number;
  /** Called to obtain the path for each verification screenshot (attempt index). */
  readonly shotPath?: (attempt: number) => string;
  readonly log?: (msg: string) => void;
}

/** Retry nudges in finger pixels. */
export const RETRY_OFFSETS: readonly Point[] = [
  { x: 0, y: 25 },
  { x: 0, y: -25 },
  { x: 25, y: 0 },
  { x: -25, y: 0 },
];

/** Find the anchor whose placement turns `before` into `after` (clears included); null if none. */
export function explainBoardChange(before: Board, after: Board, shapeId: ShapeId): { row: number; col: number } | null {
  const s = getShape(shapeId);
  for (const p of s.placements) {
    if (((before.lo & p.lo) | (before.hi & p.hi)) !== 0) continue;
    const r = place(before, p).board;
    if (r.lo === after.lo && r.hi === after.hi) return { row: p.row, col: p.col };
  }
  return null;
}

/** Take a screenshot and read it, repeating until two consecutive board reads agree. */
export async function stableRead(savePath?: string, opts: { gapMs?: number; maxReads?: number } = {}): Promise<{ img: Screenshot; board: BoardRead; tray: TrayRead }> {
  const gap = opts.gapMs ?? 400;
  const max = opts.maxReads ?? 6;
  let prev: BoardRead | null = null;
  let img = screenshot(savePath);
  let br = readBoard(img);
  for (let i = 1; i < max; i++) {
    if (prev !== null && prev.notation === br.notation) break;
    prev = br;
    await sleep(gap);
    img = screenshot(savePath);
    br = readBoard(img);
  }
  return { img, board: br, tray: readTray(img) };
}

/**
 * Drag the piece in `slot` (whose blob centre is `pickup`) so that `shapeId` lands anchored at
 * (row, col). Verifies by re-reading tray and board; retries with small nudges on a miss.
 */
export async function placeShape(
  before: Board,
  trayBefore: TrayRead,
  slot: 0 | 1 | 2,
  shapeId: ShapeId,
  row: number,
  col: number,
  opts: PlaceOptions,
): Promise<PlaceResultInfo> {
  const log = opts.log ?? (() => {});
  const slotRead = trayBefore.slots[slot];
  if (slotRead.blob === null) throw new Error(`slot ${slot} is empty`);
  const pickup: Point = { x: Math.round(slotRead.blob.cx), y: Math.round(slotRead.blob.cy) };
  const expected = place(before, getShape(shapeId).placements.find((p) => p.row === row && p.col === col) ?? (() => { throw new Error('anchor off board'); })()).board;
  const expectedStr = boardToString(expected);
  const attempts: DropAttempt[] = [];
  const maxRetries = opts.maxRetries ?? 3;
  const piecesBefore = trayBefore.hand.filter((h) => h !== null).length;

  let last: { img: Screenshot; board: BoardRead; tray: TrayRead } | null = null;
  let lastPath: string | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const offset = attempt === 0 ? { x: 0, y: 0 } : (RETRY_OFFSETS[(attempt - 1) % RETRY_OFFSETS.length] ?? { x: 0, y: 0 });
    const { finger, target } = fingerForPlacement(pickup, shapeId, row, col, opts.calibration.model, offset);
    log(`drag slot ${slot} #${shapeId} -> (${row},${col}) target (${target.x.toFixed(0)},${target.y.toFixed(0)}) finger (${finger.x},${finger.y}) offset (${offset.x},${offset.y}) model ${JSON.stringify(opts.calibration.model)}`);
    await executeDrag(pickup, finger);
    await sleep(opts.settleMs ?? 1500);
    lastPath = opts.shotPath ? opts.shotPath(attempt) : null;
    last = await stableRead(lastPath ?? undefined);

    const screen = checkScreen(last.img, last.board);
    if (screen.kind !== 'play') {
      attempts.push({ finger, offset, outcome: 'unexpected', note: screen.reasons.join('; ') });
      return { ok: false, outcome: 'unexpected', attempts, actual: null, boardAfter: last.board, trayAfter: last.tray, screenshotAfter: last.img, screenshotPath: lastPath };
    }

    const afterStr = last.board.notation;
    const slotAfter = last.tray.slots[slot];
    const slotStillHasPiece = slotAfter.shapeId === shapeId && piecesBefore > 1;
    const record = (actual: { row: number; col: number }): void => {
      const s = getShape(shapeId);
      const landed = placementCenter(actual.row, actual.col, s.width, s.height);
      opts.calibration.add({ ts: new Date().toISOString(), slot, shapeId, pickup, finger, offset, target, landed, intended: { row, col }, actual });
    };

    if (afterStr === expectedStr) {
      attempts.push({ finger, offset, outcome: 'placed' });
      record({ row, col });
      return { ok: true, outcome: 'placed', attempts, actual: { row, col }, boardAfter: last.board, trayAfter: last.tray, screenshotAfter: last.img, screenshotPath: lastPath };
    }
    if (afterStr === boardToString(before)) {
      if (slotStillHasPiece || slotAfter.shapeId === shapeId) {
        attempts.push({ finger, offset, outcome: 'missed', note: 'board unchanged, piece back in tray' });
        log(`miss (attempt ${attempt + 1}/${maxRetries + 1})`);
        continue;
      }
      // Board unchanged but the slot is empty: probably still animating. Re-read once more.
      await sleep(1000);
      last = await stableRead(lastPath ?? undefined);
      if (last.board.notation === expectedStr) {
        attempts.push({ finger, offset, outcome: 'placed' });
        record({ row, col });
        return { ok: true, outcome: 'placed', attempts, actual: { row, col }, boardAfter: last.board, trayAfter: last.tray, screenshotAfter: last.img, screenshotPath: lastPath };
      }
      if (last.board.notation === boardToString(before)) {
        attempts.push({ finger, offset, outcome: 'missed', note: 'board unchanged after extra wait' });
        continue;
      }
    }
    const actual = explainBoardChange(before, last.board.board, shapeId);
    if (actual !== null) {
      attempts.push({ finger, offset, outcome: 'placed-elsewhere', note: `landed at (${actual.row},${actual.col})` });
      log(`landed elsewhere: (${actual.row},${actual.col}) instead of (${row},${col})`);
      record(actual);
      return { ok: true, outcome: 'placed-elsewhere', attempts, actual, boardAfter: last.board, trayAfter: last.tray, screenshotAfter: last.img, screenshotPath: lastPath };
    }
    attempts.push({ finger, offset, outcome: 'unexpected', note: `board changed to ${last.board.notation} which no placement of #${shapeId} explains` });
    return { ok: false, outcome: 'unexpected', attempts, actual: null, boardAfter: last.board, trayAfter: last.tray, screenshotAfter: last.img, screenshotPath: lastPath };
  }
  if (last === null) throw new Error('unreachable: no attempt made');
  return { ok: false, outcome: 'missed', attempts, actual: null, boardAfter: last.board, trayAfter: last.tray, screenshotAfter: last.img, screenshotPath: lastPath };
}
