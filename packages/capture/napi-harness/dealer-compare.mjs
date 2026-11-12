// Fair dealer vs the real strategies, on the same random boards.
// For each fill level: fair P(hand fully placeable) with uniform weights over the live pool (ids 2..31 minus the early-game filter),
// then for each strategy the hand it returns, whether that hand is placeable in some order, and the "two fit, hand unsolvable" lethal signature.
// Usage: node dealer-compare.mjs ./task.node <boardsPerLevel=40> [session.json]  (session.json supplies the live initData: weight table + seed; without it weight-driven strategies such as 12001 degenerate to 1x1s)
import { createRequire } from 'node:module'; import { writeSync, readFileSync } from 'node:fs';
import { fromRows, uniformWeights, pHandSolvable, solvabilityDetail, SHAPES, seedRng } from './engine/index.js';
const mcRng = seedRng(1);
const require = createRequire(import.meta.url); const out = (s) => writeSync(1, s + '\n');
const [, , modPath, nStr, sessionPath] = process.argv; const N = parseInt(nStr || '40', 10);
const INIT = sessionPath ? JSON.parse(readFileSync(sessionPath, 'utf8')).initData : {};
const mod = { exports: {} }; process.dlopen(mod, modPath); const { BlockAlgorithm } = mod.exports;
let s = 987654321; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
function randomBoard(fill) { const cells = []; for (let i = 0; i < 64; i++) cells.push(i < Math.round(fill * 64) ? 1 + Math.floor(rnd() * 7) : -1);
  for (let i = 63; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return Array.from({ length: 8 }, (_, r) => cells.slice(r * 8, r * 8 + 8)); }
const FILTER = [11, 12, 13, 21, 22, 23, 24, 39, 40, 41];
const LIVE_POOL = Array.from({ length: 30 }, (_, i) => i + 2).filter(id => !FILTER.includes(id));
const sizeOf = (id) => SHAPES.get(id)?.size ?? SHAPES.get(id)?.cells?.length ?? 0;
function request(board, algo, score, filter) { return { highRecordGrade: score, currRecordGrade: score, mode: 'class', chapterNum: 0, board, lastBlockIds: [-1, -1, -1], blocksGroup: [], addBlocks: [],
  filterBlocks: filter, filterWeightBlocks: filter, blockIds: [0, 0, 0], blockNames: ['', '', ''], blockPoses: [{ row: 0, col: 0 }, { row: 0, col: 0 }, { row: 0, col: 0 }], overTime: 100, idToRemove: {}, device: 0, platform: 1, blockGroup: [], algoList: [algo],
  extra: JSON.stringify({ feature: { moreAreaFill: false, randomToRandomNoDie: true, randomNoDie: 0, clearCool: 0, NotUseSeed: 0, lianGuan: true, limitSmall: false, limitSmallRandomWeight: { isLimitBlockIdArr: false, isLimitCopyBlockIdArr: false, isUseCopyBlock: true, copyFilterBlocks: [] }, pos: true, repeatRandomNoDie: 1, fixFea: ['algoSDK_modifyBlockPos'], override: [], hardHardIOS: {} }, centerRow: 0, centerCol: 3, passThroughAlgoName: [], travelFillBlankAvoidSmallBlock: false, isDieLimit: false, jsonData: {} }) }; }
const STRATS = [[12001, 'entropy3', FILTER], [14011, 'gapfill', FILTER], [23001, 'random', FILTER], [14020, 'multiclear', []], [16009, 'deathproblem', []], [16016, 'extremelyhard', FILTER], [16010, 'cleartwice', []], [16014, 'fewedges', []], [24001, 'lethal', FILTER]];
const inst = new BlockAlgorithm(); inst.setConfig(JSON.stringify({ seed: 424242 })); const init = inst.initData(INIT); out(JSON.stringify({ initData: sessionPath || 'empty', errorCode: init.errorCode, ratioRows: (INIT.ratioJson || []).length }));
const weights = uniformWeights(LIVE_POOL);
out(JSON.stringify({ boardsPerLevel: N, livePool: LIVE_POOL }));
for (const fill of [0.2, 0.3, 0.4, 0.5, 0.6, 0.7]) {
  const acc = { fill, emptyCells: 64 - Math.round(fill * 64), fairPSolvable: 0, fairN: 0, strategies: {} };
  for (const [id, name] of STRATS) acc.strategies[name] = { id, dealt: 0, solvable: 0, lethalSig: 0, meanSize: 0, pieces: 0 };
  for (let i = 0; i < N; i++) {
    const g = randomBoard(fill); const board = fromRows(g.map(row => row.map(v => v < 0 ? '.' : '#').join('')));
    const fp = pHandSolvable(board, weights, { exactThreshold: 10, samples: 2000, rng: mcRng }); acc.fairPSolvable += fp.p; acc.fairN++;
    for (const [id, name, filter] of STRATS) {
      const r = inst.offerTopic(request(g, id, 1500, filter)); const ids = r.blockIds || [];
      if (ids.length !== 3) continue;
      const st = acc.strategies[name]; st.dealt++;
      const d = solvabilityDetail(board, ids); if (d.solvable) st.solvable++; if (!d.solvable && d.fitsCount >= 2) st.lethalSig++;
      for (const p of ids) { st.meanSize += sizeOf(p); st.pieces++; }
    }
  }
  acc.fairPSolvable = +(acc.fairPSolvable / Math.max(acc.fairN, 1)).toFixed(3);
  for (const k of Object.keys(acc.strategies)) { const st = acc.strategies[k]; st.pSolvable = st.dealt ? +(st.solvable / st.dealt).toFixed(3) : null; st.pLethalSig = st.dealt ? +(st.lethalSig / st.dealt).toFixed(3) : null; st.meanSize = st.pieces ? +(st.meanSize / st.pieces).toFixed(2) : null; delete st.solvable; delete st.lethalSig; delete st.pieces; }
  out(JSON.stringify(acc));
}
