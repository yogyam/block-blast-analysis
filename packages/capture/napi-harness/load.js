// Load libtask.so as a Node-API addon and dump what it exposes. Run with Termux node on the emulator:
//   node load.js /data/local/tmp/harness/task.node
'use strict';
const path = process.argv[2] || './task.node';
const mod = { exports: {} };
try {
  process.dlopen(mod, path);
} catch (e) {
  console.error('dlopen failed:', e && e.message);
  process.exit(1);
}
const ex = mod.exports;
console.log('exports type:', typeof ex, 'keys:', Object.getOwnPropertyNames(ex));
for (const k of Object.getOwnPropertyNames(ex)) {
  const v = ex[k];
  console.log(`- ${k}: ${typeof v}`);
  if (typeof v === 'function') {
    const proto = v.prototype ? Object.getOwnPropertyNames(v.prototype) : [];
    console.log(`    prototype: ${JSON.stringify(proto)}`);
    console.log(`    static:    ${JSON.stringify(Object.getOwnPropertyNames(v).filter(n => !['length','name','prototype'].includes(n)))}`);
  }
}
