// Counterfactual experiment on the real generator: how often does the lethal search (24001) find a hand,
// as a function of board fill? Random boards at each fill level, live-like request, fixed seeds.
// Usage: node lethal-sweep.js ./task.node <boardsPerLevel=60> <algo=24001>
'use strict';
const fs = require('fs'); const out = (s) => fs.writeSync(1, s + '\n');
const [, , modPath, nStr, algoStr] = process.argv; const N = parseInt(nStr || '60', 10); const ALGO = parseInt(algoStr || '24001', 10);
const mod = { exports: {} }; process.dlopen(mod, modPath); const { BlockAlgorithm } = mod.exports;
// simple seeded PRNG for board generation (independent of the module's RNG)
let s = 123456789; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
function randomBoard(fill) { // fill = fraction of occupied cells; colour ids 1..7, -1 empty
  const cells = []; for (let i = 0; i < 64; i++) cells.push(i < Math.round(fill * 64) ? 1 + Math.floor(rnd() * 7) : -1);
  for (let i = 63; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return Array.from({ length: 8 }, (_, r) => cells.slice(r * 8, r * 8 + 8));
}
const FILTER = [11, 12, 13, 21, 22, 23, 24, 39, 40, 41];
function request(board, algo, score) {
  return { highRecordGrade: score, currRecordGrade: score, mode: 'class', chapterNum: 0, board, lastBlockIds: [-1, -1, -1], blocksGroup: [], addBlocks: [],
    filterBlocks: FILTER, filterWeightBlocks: FILTER, blockIds: [0, 0, 0], blockNames: ['', '', ''], blockPoses: [{ row: 0, col: 0 }, { row: 0, col: 0 }, { row: 0, col: 0 }],
    overTime: 100, idToRemove: {}, device: 0, platform: 1, blockGroup: [], algoList: [algo],
    extra: JSON.stringify({ feature: { moreAreaFill: false, randomToRandomNoDie: true, randomNoDie: 0, clearCool: 0, NotUseSeed: 0, lianGuan: true, limitSmall: false,
      limitSmallRandomWeight: { isLimitBlockIdArr: false, isLimitCopyBlockIdArr: false, isUseCopyBlock: true, copyFilterBlocks: [] }, pos: true, repeatRandomNoDie: 1,
      fixFea: ['algoSDK_modifyBlockPos'], override: [], hardHardIOS: {} }, centerRow: 0, centerCol: 3, passThroughAlgoName: [], travelFillBlankAvoidSmallBlock: false, isDieLimit: false, jsonData: {} }) };
}
const inst = new BlockAlgorithm(); inst.setConfig(JSON.stringify({ seed: 20261110 })); inst.initData({});
out(JSON.stringify({ algo: ALGO, boardsPerLevel: N }));
for (const fill of [0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
  let hits = 0, totalMs = 0, timeouts = 0; const examples = [];
  for (let i = 0; i < N; i++) {
    const b = randomBoard(fill); const t0 = Date.now();
    const r = inst.offerTopic(request(b, ALGO, 1200)); totalMs += Date.now() - t0;
    if (r.timeout) timeouts++;
    if (r.blockIds && r.blockIds.length === 3) { hits++; if (examples.length < 2) examples.push({ ids: r.blockIds, names: r.blockNames[0], board: b.map(row => row.map(v => v < 0 ? '.' : '#').join('')) }); }
  }
  out(JSON.stringify({ fill, emptyCells: 64 - Math.round(fill * 64), hits, n: N, hitRate: +(hits / N).toFixed(3), meanMs: +(totalMs / N).toFixed(1), timeouts, examples }));
}
