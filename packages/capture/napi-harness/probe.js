// Probe BlockAlgorithm's methods with trivial arguments to harvest native error messages (expected types).
// Each probe is logged synchronously before it runs so a native crash still shows what was being tried.
'use strict';
const fs = require('fs');
const out = (s) => fs.writeSync(1, s + '\n');
const mod = { exports: {} }; process.dlopen(mod, process.argv[2] || './task.node');
const { BlockAlgorithm } = mod.exports;
function probe(label, fn) {
  out('>> ' + label);
  try { const r = fn(); out('   -> ' + (typeof r) + ' ' + (typeof r === 'string' ? r.slice(0, 400) : JSON.stringify(r, null, 0)?.slice(0, 400))); return r; }
  catch (e) { out('   THROWS ' + (e && e.message)); }
}
const only = process.argv[3] || 'all';
let inst = probe('new BlockAlgorithm()', () => new BlockAlgorithm());
if (!inst) inst = probe('new BlockAlgorithm("{}")', () => new BlockAlgorithm('{}'));
if (!inst) inst = probe('new BlockAlgorithm(0)', () => new BlockAlgorithm(0));
if (!inst) { out('no instance; stop'); process.exit(0); }
out('instance keys: ' + JSON.stringify(Object.getOwnPropertyNames(inst)));
const methods = only === 'all' ? ['loggerListener', 'setConfig', 'initData', 'offerTopic'] : [only];
for (const m of methods) {
  if (m === 'loggerListener') { probe('loggerListener(fn)', () => inst.loggerListener((...a) => out('   [LOG] ' + a.map(x => typeof x === 'string' ? x.slice(0, 300) : JSON.stringify(x)).join(' | ')))); continue; }
  probe(m + '()', () => inst[m]());
  probe(m + '("")', () => inst[m](''));
  probe(m + '("{}")', () => inst[m]('{}'));
  probe(m + '({})', () => inst[m]({}));
  probe(m + '(0)', () => inst[m](0));
  probe(m + '("{}", "{}")', () => inst[m]('{}', '{}'));
}
out('done');
