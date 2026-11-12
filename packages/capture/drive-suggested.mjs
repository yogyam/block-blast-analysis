// SUPERSEDED (2026-11-12): kept for reference only. The native offerTopic candidate can differ
// from the dealt tray (06-methods.md §10b, confirmed live), so driving by `blockPoses` places the
// wrong pieces and the candidate is not a faithful dealt hand. The sound path is theme-robust CV
// play that reads the actual tray. See docs/findings/capture-status.md.
//
// Theme-independent driver: play Block Blast by replaying the game's OWN suggested positions
// (offerTopic `blockPoses`) read live from the Frida log, dragging each dealt piece to its
// suggested cell. No CV board-reading, so board themes don't matter. The detector conditions on
// the board, so this (the game's policy) is a valid policy to observe.
//
// Usage (from packages/capture, with the game running under the Frida logger):
//   node drive-suggested.mjs <frida-log> [maxDeals] [outJsonl]
import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { executeDrag, fingerForPlacement, DEFAULT_FINGER_MODEL } from './dist/drag.js';
import { TRAY } from './dist/geometry.js';
import { getShape } from '@blockblast/engine';

const [, , logPath, maxDealsStr, outPath] = process.argv;
const maxDeals = Number(maxDealsStr ?? '60');
const out = outPath ?? `../../data/real/driven-${Date.now()}.jsonl`;
writeFileSync(out, '');
const DEVICE = process.env.BB_DEVICE ?? 'emulator-5554';
const adb = (args) => execFileSync('adb', ['-s', DEVICE, ...args], { encoding: 'buffer' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Calibration model from the CV player's saved file if present, else defaults.
let model = DEFAULT_FINGER_MODEL;
const calPath = '../../data/real/adb-player/calibration.json';
if (existsSync(calPath)) { try { model = JSON.parse(readFileSync(calPath, 'utf8')).model ?? model; } catch {} }

/** Parse all offerTopic deals (with 3 valid pieces + poses) from the log, newest last. */
function readDeals() {
  const deals = [];
  let text = '';
  try { text = readFileSync(logPath, 'utf8'); } catch { return deals; }
  for (const line of text.split('\n')) {
    const i = line.indexOf('BBCALL ');
    if (i < 0) continue;
    let o; try { o = JSON.parse(line.slice(i + 7)); } catch { continue; }
    if (o.method !== 'offerTopic') continue;
    let req, ret; try { req = JSON.parse(o.args[0]); ret = JSON.parse(o.ret); } catch { continue; }
    const ids = ret.blockIds, poses = ret.blockPoses;
    if (!Array.isArray(ids) || ids.length !== 3 || !ids.every((x) => Number.isInteger(x) && x >= 1 && x <= 51)) continue;
    if (!Array.isArray(poses) || poses.length !== 3) continue;
    deals.push({ t: o.t, ids, poses, score: req.currRecordGrade, best: req.highRecordGrade, algo: ret.algoType, mode: req.mode });
  }
  return deals;
}

/** Wait until a deal with t > afterT appears; return the latest such (pipeline's final). */
async function waitDeal(afterT, timeoutMs) {
  const t0 = Date.now();
  let settleFrom = 0;
  while (Date.now() - t0 < timeoutMs) {
    const deals = readDeals().filter((d) => d.t > afterT && d.mode === 'class');
    if (deals.length > 0) {
      if (settleFrom === 0) settleFrom = Date.now();
      // let the pipeline finish emitting, then take the newest
      if (Date.now() - settleFrom > 700) return deals[deals.length - 1];
    }
    await sleep(150);
  }
  return null;
}

async function placePiece(slot, shapeId, row, col) {
  const pickup = TRAY.slotCenters[slot];
  const { finger } = fingerForPlacement(pickup, shapeId, row, col, model);
  await executeDrag(pickup, finger, { steps: 12, settleMs: 160 });
}

async function main() {
  console.error(`driver: log=${logPath} maxDeals=${maxDeals} out=${out} model=${JSON.stringify(model)}`);
  let lastT = 0;
  let placed = 0;
  let dealsDone = 0;
  // Seed on the current latest class deal.
  let deal = (readDeals().filter((d) => d.mode === 'class').pop()) ?? (await waitDeal(0, 10000));
  while (deal && dealsDone < maxDeals) {
    lastT = deal.t;
    appendFileSync(out, JSON.stringify({ kind: 'deal', ...deal, ts: new Date().toISOString() }) + '\n');
    console.error(`deal ${dealsDone} score=${deal.score} ids=${deal.ids} poses=${deal.poses.map((p) => `${p.row},${p.col}`).join(' ')} algo=${deal.algo}`);
    for (let i = 0; i < 3; i++) {
      await placePiece(i, deal.ids[i], deal.poses[i].row, deal.poses[i].col);
      placed++;
      await sleep(600 + Math.floor(Math.random() * 500)); // human pacing (avoid fast-hand trait)
    }
    dealsDone++;
    const next = await waitDeal(lastT, 9000);
    if (!next) { console.error('no new deal within 9s — game over or stuck'); break; }
    deal = next;
  }
  console.error(`done: ${dealsDone} deals, ${placed} placements`);
}
main().catch((e) => { console.error('driver error', e); process.exit(1); });
