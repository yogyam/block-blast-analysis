// Attach-time probe: how libtask's N-API imports resolved, plus log Adapter::setConfig strings and
// AlgoPuzzleUtil::offerTopic's algo-id vector as the live game calls them.
'use strict';
const log = (m) => console.log('[cfg] ' + m);
const mod = Process.findModuleByName('libtask.so');
if (!mod) { log('libtask.so not loaded'); } else {
  const imps = mod.enumerateImports().filter(i => /^napi_/.test(i.name));
  const byMod = {}; for (const i of imps) { const k = i.module || '(unresolved)'; byMod[k] = (byMod[k] || 0) + 1; }
  log('napi imports by provider: ' + JSON.stringify(byMod));
  const one = imps.find(i => i.name === 'napi_create_object'); if (one) log('napi_create_object -> ' + one.address + ' in ' + one.module + ' ' + JSON.stringify(DebugSymbol.fromAddress(one.address)));
  // libc++ std::string reader (SSO)
  function readStdString(p) { const b0 = p.readU8(); if ((b0 & 1) === 0) { const len = b0 >> 1; return p.add(1).readUtf8String(len); } const len = p.add(8).readU64().toNumber(); const ptr = p.add(16).readPointer(); return ptr.readUtf8String(Math.min(len, 1 << 20)); }
  const ex = mod.enumerateExports();
  const setCfg = ex.find(e => /^_ZN7Adapter9setConfigERKNSt6__ndk112basic_string/.test(e.name));
  if (setCfg) { Interceptor.attach(setCfg.address, { onEnter(a) { try { log('Adapter::setConfig(' + readStdString(a[1]).slice(0, 4000) + ')'); } catch (e) { log('setConfig read err ' + e); } } }); log('hooked ' + setCfg.name); }
  const offer = ex.find(e => /^_ZN14AlgoPuzzleUtil10offerTopicERK27AlgoExecuteAdapterInputDataRKNSt6__ndk16vectorIi/.test(e.name));
  if (offer) { Interceptor.attach(offer.address, { onEnter(a) { try { const b = a[2].readPointer(), en = a[2].add(8).readPointer(); const n = en.sub(b).toInt32() / 4; const ids = []; for (let i = 0; i < Math.min(n, 32); i++) ids.push(b.add(i * 4).readS32()); log('AlgoPuzzleUtil::offerTopic algoList=' + JSON.stringify(ids)); } catch (e) { log('offerTopic read err ' + e); } } }); log('hooked ' + offer.name); }
  const seed = ex.find(e => e.name === '_ZN15FixedRandomUtil8initSeedEx'); if (seed) Interceptor.attach(seed.address, { onEnter(a) { log('FixedRandomUtil::initSeed(' + a[1].toString() + ')'); } });
  const nus = ex.find(e => e.name === '_ZN15FixedRandomUtil13setNotUseSeedEi'); if (nus) Interceptor.attach(nus.address, { onEnter(a) { log('FixedRandomUtil::setNotUseSeed(' + a[1].toInt32() + ')'); } });
}
