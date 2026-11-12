// Replay the live boards on which the game requested the lethal search, and compare with random boards of equal fill.
import { createRequire } from 'node:module'; import { readFileSync, writeSync } from 'node:fs';
import { fromRows, fitsAnywhereSet, countPlacements } from './engine/index.js';
const require = createRequire(import.meta.url); const out = (s) => writeSync(1, s + '\n');
const mod = { exports: {} }; process.dlopen(mod, process.argv[2] || './task.node'); const { BlockAlgorithm } = mod.exports;
const live = JSON.parse(readFileSync('./live-lethal-boards.json', 'utf8'));
const FILTER = [11, 12, 13, 21, 22, 23, 24, 39, 40, 41]; const POOL = Array.from({ length: 41 }, (_, i) => i + 2); // the lethal search's own pool (ids 2..42, unfiltered)
let s = 55555; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
function randomBoardWithEmpty(empty) { const cells = []; for (let i = 0; i < 64; i++) cells.push(i < 64 - empty ? 1 : -1); for (let i = 63; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; } return Array.from({ length: 8 }, (_, r) => cells.slice(r * 8, r * 8 + 8)); }
function request(board, algo, score) { return { highRecordGrade: score, currRecordGrade: score, mode: 'class', chapterNum: 0, board, lastBlockIds: [-1, -1, -1], blocksGroup: [], addBlocks: [], filterBlocks: FILTER, filterWeightBlocks: FILTER, blockIds: [0, 0, 0], blockNames: ['', '', ''], blockPoses: [{ row: 0, col: 0 }, { row: 0, col: 0 }, { row: 0, col: 0 }], overTime: 100, idToRemove: {}, device: 0, platform: 1, blockGroup: [], algoList: [algo],
  extra: JSON.stringify({ feature: { moreAreaFill: false, randomToRandomNoDie: true, randomNoDie: 0, clearCool: 0, NotUseSeed: 0, lianGuan: true, limitSmall: false, limitSmallRandomWeight: { isLimitBlockIdArr: false, isLimitCopyBlockIdArr: false, isUseCopyBlock: true, copyFilterBlocks: [] }, pos: true, repeatRandomNoDie: 1, fixFea: ['algoSDK_modifyBlockPos'], override: [], hardHardIOS: {} }, centerRow: 0, centerCol: 3, passThroughAlgoName: [], travelFillBlankAvoidSmallBlock: false, isDieLimit: false, jsonData: {} }) }; }
const inst = new BlockAlgorithm(); inst.setConfig(JSON.stringify({ seed: 777 })); inst.initData({});
function stats(grid) { const b = fromRows(grid.map(row => row.map(v => v < 0 ? '.' : '#').join(''))); const fits = fitsAnywhereSet(b, POOL); return { fits: fits.size, unplaceable: POOL.length - fits.size }; }
out(`${'score'.padStart(5)} ${'empty'.padStart(5)} ${'liveHit'.padStart(7)} ${'harnessHit'.padStart(10)} ${'unplaceable/23'.padStart(14)} | random board same fill: ${'hit'.padStart(3)} ${'unplaceable'.padStart(11)}`);
let liveHits = 0, harnessHits = 0, randHits = 0, n = 0, unpLive = 0, unpRand = 0;
for (const b of live) {
  const empty = b.board.flat().filter(v => v < 0).length;
  const r = inst.offerTopic(request(b.board, 24001, b.score)); const hit = !!(r.blockIds && r.blockIds.length);
  const st = stats(b.board);
  let rh = 0, ru = 0; for (let k = 0; k < 5; k++) { const g = randomBoardWithEmpty(empty); const rr = inst.offerTopic(request(g, 24001, b.score)); rh += (rr.blockIds && rr.blockIds.length) ? 1 : 0; ru += stats(g).unplaceable; }
  out(`${String(b.score).padStart(5)} ${String(empty).padStart(5)} ${String(b.liveHit).padStart(7)} ${String(hit).padStart(10)} ${String(st.unplaceable).padStart(14)} | ${(rh / 5).toFixed(1).padStart(28)} ${(ru / 5).toFixed(1).padStart(11)}`);
  n++; liveHits += b.liveHit ? 1 : 0; harnessHits += hit ? 1 : 0; randHits += rh / 5; unpLive += st.unplaceable; unpRand += ru / 5;
}
out(JSON.stringify({ n, liveHits, harnessHitsOnLiveBoards: harnessHits, randomBoardsSameFill_meanHitRate: +(randHits / n).toFixed(2), meanUnplaceable_live: +(unpLive / n).toFixed(1), meanUnplaceable_random: +(unpRand / n).toFixed(1) }));
