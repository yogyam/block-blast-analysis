#!/usr/bin/env node
/**
 * CLI for the emulator player.
 *
 *   node --experimental-strip-types src/cli.ts play [--n 20] [--out data/real/adb-player] [--settle 1500]
 *   node --experimental-strip-types src/cli.ts read [screenshot.png]   # read board + tray (live if no file)
 *   node --experimental-strip-types src/cli.ts calibration [--out dir]  # print the finger model
 *
 * Run from the repo root with `pnpm --filter @blockblast/capture play -- --n 10`, or from this
 * package directory. Source `scripts/phase2/env.sh` first so adb is on PATH.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { TEN_TEN_POOL, DEFAULT_POOL } from '@blockblast/engine';
import { checkScreen, readBoard } from './boardReader.ts';
import { DEFAULT_FINGER_MODEL, type CalibrationFile } from './drag.ts';
import { runPlayer } from './player.ts';
import { loadPng, screenshot } from './screen.ts';
import { describeTray, readTray } from './trayReader.ts';

function repoRoot(): string {
  // packages/capture/src/cli.ts → repo root is three levels up from src/.
  return resolve(new URL('../../..', import.meta.url).pathname);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      n: { type: 'string', default: '20' },
      out: { type: 'string' },
      settle: { type: 'string', default: '1500' },
      pool: { type: 'string', default: 'default' },
    },
  });
  const cmd = positionals[0] ?? 'play';
  const outDir = values.out !== undefined ? resolve(values.out) : join(repoRoot(), 'data', 'real', 'adb-player');

  if (cmd === 'read') {
    const file = positionals[1];
    const img = file !== undefined ? loadPng(file) : screenshot(join(outDir, 'read-latest.png'));
    const br = readBoard(img);
    const tray = readTray(img);
    for (let r = 0; r < 8; r++) console.log(br.notation.slice(r * 8, r * 8 + 8));
    console.log(`lo=${br.board.lo} hi=${br.board.hi} empty=${br.emptyColor.join(',')} contested=${br.contestedCells} ambiguous=${br.ambiguousCells}`);
    console.log(`screen: ${JSON.stringify(checkScreen(img, br))}`);
    console.log(`tray: ${describeTray(tray)}`);
    for (const s of tray.slots) if (s.blob !== null) console.log(`  slot ${s.slot}: blob ${JSON.stringify(s.blob)} grid ${JSON.stringify(s.grid)}`);
    return;
  }

  if (cmd === 'calibration') {
    const p = join(outDir, 'calibration.json');
    if (!existsSync(p)) {
      console.log(`no calibration at ${p}; defaults: ${JSON.stringify(DEFAULT_FINGER_MODEL)}`);
      return;
    }
    const file = JSON.parse(readFileSync(p, 'utf8')) as CalibrationFile;
    console.log(`model: ${JSON.stringify(file.model)} (updated ${file.updatedAt}, ${file.observations.length} landings)`);
    for (const o of file.observations) {
      console.log(
        `  slot ${o.slot} #${o.shapeId} finger (${o.finger.x},${o.finger.y}) offset (${o.offset.x},${o.offset.y}) aimed (${o.intended.row},${o.intended.col}) landed (${o.actual.row},${o.actual.col}) dx=${(o.landed.x - o.target.x).toFixed(0)} dy=${(o.landed.y - o.target.y).toFixed(0)}`,
      );
    }
    return;
  }

  if (cmd === 'play') {
    const n = Number.parseInt(values.n ?? '20', 10);
    const settleMs = Number.parseInt(values.settle ?? '1500', 10);
    const pool = values.pool === '1010' ? TEN_TEN_POOL : DEFAULT_POOL;
    const summary = await runPlayer({ maxPlacements: n, outDir, settleMs, pool });
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.error(`unknown command ${cmd}; use play | read | calibration`);
  process.exitCode = 2;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
