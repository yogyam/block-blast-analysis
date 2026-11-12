// Report over all captured native generator calls (BBCALL lines in data/raw/emulator/task-json-run*.log).
// Groups calls into deals (same score, consecutive), games (score resets), and score bands; judges every hand with the engine.
import { readFileSync, readdirSync } from 'node:fs';
import { fromRows, solvabilityDetail } from '../../packages/engine/dist/index.js';
const dir = new URL('../../data/raw/emulator/', import.meta.url);
const files = readdirSync(dir).filter(f => /^task-json-run\d+\.log$/.test(f)).sort();
const calls = [];
for (const f of files) for (const line of readFileSync(new URL(f, dir), 'utf8').split('\n')) {
  const m = line.match(/BBCALL (\{.*\})\s*$/); if (!m) continue;
  let r; try { r = JSON.parse(m[1]); } catch { continue; }
  if (r.method !== 'offerTopic') continue;
  let a, o; try { a = JSON.parse(r.args[0]); o = r.ret && r.ret.startsWith('{') ? JSON.parse(r.ret) : {}; } catch { continue; }
  calls.push({ file: f, t: r.t, score: a.currRecordGrade, best: a.highRecordGrade, req: (a.algoList || [])[0], algo: o.algoType, ids: o.blockIds || [], name: (o.blockNames || [])[0] || '', filter: a.filterBlocks || [], board: a.board, empty: (a.board || []).flat().filter(v => v < 0).length });
}
calls.sort((x, y) => x.t - y.t);
// games: a new game when score drops
let game = 0, prevScore = -1; for (const c of calls) { if (c.score < prevScore) game++; c.game = game; prevScore = c.score; }
// deals: consecutive calls at the same score within 2 s
let dealId = -1, last = null; for (const c of calls) { if (!last || c.score !== last.score || c.t - last.t > 2000) dealId++; c.deal = dealId; last = c; }
const judge = (c) => { if (!c.board || c.ids.length !== 3) return null; const b = fromRows(c.board.map(row => row.map(v => v < 0 ? '.' : '#').join(''))); const d = solvabilityDetail(b, c.ids); return { solvable: d.solvable, fits: d.fitsCount, lethalSig: !d.solvable && d.fitsCount >= 2 }; };
const band = (s) => s < 300 ? '0-299' : s < 1000 ? '300-999' : s < 2500 ? '1000-2499' : s < 5000 ? '2500-4999' : '5000+';
console.log(`calls: ${calls.length}  deals: ${dealId + 1}  games: ${game + 1}  files: ${files.join(', ')}`);
for (let g = 0; g <= game; g++) {
  const gc = calls.filter(c => c.game === g); if (!gc.length) continue;
  const deals = [...new Set(gc.map(c => c.deal))];
  const lethalReq = deals.filter(d => gc.some(c => c.deal === d && c.req === 24001)).length;
  const lethalHit = deals.filter(d => gc.some(c => c.deal === d && c.req === 24001 && c.ids.length === 3)).length;
  const filters = [...new Set(gc.map(c => JSON.stringify(c.filter)))];
  console.log(`\n=== game ${g}: score ${gc[0].score}→${gc[gc.length - 1].score}, best at start ${gc[0].best}, deals ${deals.length}, lethal requested in ${lethalReq} deals, lethal hand found in ${lethalHit}`);
  console.log('    filter sets seen: ' + filters.map(f => f.slice(0, 60)).join(' | '));
  const byBand = {};
  for (const d of deals) { const dc = gc.filter(c => c.deal === d); const b = band(dc[0].score); const k = dc.map(c => `${c.req}${c.algo && c.algo !== c.req && c.algo < 1e6 ? '→' + c.algo : ''}`).join('+'); (byBand[b] ||= {})[k] = ((byBand[b] || {})[k] || 0) + 1; }
  for (const b of Object.keys(byBand)) console.log(`    ${b.padEnd(10)} ` + Object.entries(byBand[b]).sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k}×${n}`).join(', '));
  // solvability of candidates by strategy
  const byName = {};
  for (const c of gc) { const j = judge(c); if (!j) continue; const k = c.name || String(c.algo); const e = (byName[k] ||= { n: 0, solvable: 0, lethalSig: 0 }); e.n++; e.solvable += j.solvable ? 1 : 0; e.lethalSig += j.lethalSig ? 1 : 0; }
  console.log('    candidates by strategy name: ' + Object.entries(byName).map(([k, e]) => `${k}: n=${e.n} solvable=${e.solvable} lethalSig=${e.lethalSig}`).join('; '));
}
