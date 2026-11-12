// Survey one algorithm id: deal on three boards, twice with the same seed (determinism) and once with another seed.
// Usage: node survey.js ./task.node <algoId>   -> prints one JSON line
'use strict';
const fs = require('fs'); const out = (s) => fs.writeSync(1, s + '\n');
const [, , modPath, idStr] = process.argv; const id = parseInt(idStr, 10);
const mod = { exports: {} }; process.dlopen(mod, modPath); const { BlockAlgorithm } = mod.exports;
// Board cells are colour ids; -1 means empty (confirmed from the live game's requests).
const boards = {
  empty: Array.from({ length: 8 }, () => Array(8).fill(-1)),
  half: Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => ((r + c) % 3 === 0 || r < 3) ? 1 : -1)),
  nearFull: Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r < 6 || c < 5) ? 1 : -1)),
};
function run(seed, boardName) {
  const inst = new BlockAlgorithm();
  inst.setConfig(JSON.stringify({ seed, enableLog: false })); inst.initData({});
  const t0 = Date.now();
  const r = inst.offerTopic({ algoList: [id], board: boards[boardName], blockNum: 3, mode: 'class', chapterNum: 0, highRecordGrade: 300, currRecordGrade: 300,
    lastBlockIds: [-1, -1, -1], blocksGroup: [], addBlocks: [], filterBlocks: [], filterWeightBlocks: [], blockIds: [0, 0, 0], blockNames: ['', '', ''],
    blockPoses: [{ row: 0, col: 0 }, { row: 0, col: 0 }, { row: 0, col: 0 }], overTime: 100, idToRemove: {}, device: 0, platform: 1, blockGroup: [],
    extra: JSON.stringify({ feature: { moreAreaFill: false, randomToRandomNoDie: true, randomNoDie: 0, clearCool: 0, NotUseSeed: 0, lianGuan: true, limitSmall: false,
      limitSmallRandomWeight: { isLimitBlockIdArr: false, isLimitCopyBlockIdArr: false, isUseCopyBlock: true, copyFilterBlocks: [] }, pos: true, repeatRandomNoDie: 1,
      fixFea: [], override: [], hardHardIOS: {} }, centerRow: 0, centerCol: 3, passThroughAlgoName: [], travelFillBlankAvoidSmallBlock: false, isDieLimit: false, jsonData: {} }) });
  return { ids: r.blockIds, names: r.blockNames, err: r.errorCode, msg: r.errorMsg, poolSize: (r.blockGroup && r.blockGroup[0]) ? r.blockGroup[0].length : null,
           pool: (r.blockGroup && r.blockGroup[0]) ? r.blockGroup[0].slice().sort((a, b) => a - b) : null, poses: r.blockPoses, ms: Date.now() - t0, extra: r.extra };
}
const res = { id };
for (const b of Object.keys(boards)) {
  const a = run(1234, b), a2 = run(1234, b), c = run(999, b);
  res[b] = { ids: a.ids, names: a.names, err: a.err, msg: a.msg, poolSize: a.poolSize, pool: a.pool, poses: a.poses, ms: a.ms, extra: a.extra,
             sameSeedSame: JSON.stringify(a.ids) === JSON.stringify(a2.ids), otherSeedIds: c.ids };
}
out(JSON.stringify(res));
