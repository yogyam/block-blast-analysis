// Bit-exact reproduction test: feed the harness this session's seed + ratioJson, then replay the session's
// offerTopic requests in order and compare each result's blockIds with the live result.
// Usage: node replay-session.mjs ./task.node session.json   (session.json = {initData:{...}, setConfig:[str...], calls:[{args, ret}]})
import { readFileSync, writeSync } from 'node:fs';
const out = (s) => writeSync(1, s + '\n');
const [, , modPath, sessionPath] = process.argv;
const mod = { exports: {} }; process.dlopen(mod, modPath); const { BlockAlgorithm } = mod.exports;
const S = JSON.parse(readFileSync(sessionPath, 'utf8'));
const inst = new BlockAlgorithm();
for (const c of S.setConfigBefore || []) inst.setConfig(c);
const init = inst.initData(S.initData); out('initData -> errorCode ' + init.errorCode + ' algoList ' + init.algoList.length);
let same = 0, diff = 0, n = 0;
for (const c of S.calls) {
  if (c.method === 'setConfig') { inst.setConfig(c.args[0]); continue; }
  if (c.method !== 'offerTopic') continue;
  const req = JSON.parse(c.args[0]); const live = JSON.parse(c.ret);
  const r = inst.offerTopic(req); n++;
  const ok = JSON.stringify(r.blockIds) === JSON.stringify(live.blockIds) && r.algoType === live.algoType;
  if (ok) same++; else { diff++; if (diff <= 8) out(`  MISMATCH #${n} score ${req.currRecordGrade} req ${req.algoList}: live ${live.algoType} ${JSON.stringify(live.blockIds)} vs harness ${r.algoType} ${JSON.stringify(r.blockIds)}`); }
}
out(JSON.stringify({ offerTopicCalls: n, identical: same, different: diff }));
