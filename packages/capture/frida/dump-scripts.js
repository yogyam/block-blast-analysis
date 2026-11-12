/**
 * Frida agent: dump every JavaScript source the Cocos Creator runtime evaluates.
 *
 * Route (b) from docs/research/05-tech-and-re-plan.md §5: we never need the XXTEA key.
 * The engine decrypts bundled .jsc files itself and hands plaintext to the script engine;
 * we intercept at that hand-off and ship the text to the host, which writes files under
 * data/raw/decrypted/ (gitignored). Nothing here logs or stores the key.
 *
 * Strategy:
 *   1. Wait for libcocos.so (Creator 3.x) or libcocos2djs.so (Creator 2.x) to load.
 *   2. Try symbol names for ScriptEngine::evalString / runScript (demangled search).
 *   3. Fallback: hook exported xxtea_decrypt and dump its return buffer (plaintext, maybe gzip/brotli).
 *   4. Report what was hooked so the host can tell which route worked.
 *
 * Usage: frida -U -f com.block.juggle -l dump-scripts.js   (or via host-dump.py)
 */
'use strict';

const LIBS = ['libcocos.so', 'libcocos2djs.so', 'libcocos2dlua.so'];
const hooked = new Set();

function log(msg) { send({ type: 'log', msg }); }

function readCString(ptr, len) {
  try {
    if (len !== undefined && len > 0) return ptr.readUtf8String(len);
    return ptr.readUtf8String();
  } catch (e) {
    try { return ptr.readCString(); } catch (_) { return null; }
  }
}

function dumpScript(name, text, how) {
  if (!text) return;
  // Ship the text itself in the payload: UTF-16 length != byte length, so no byte-array juggling.
  send({ type: 'script', name: name || `unnamed-${Date.now()}`, how, length: text.length, text });
}

function tryHookEval(mod) {
  // Demangled names vary by compiler; look for anything that smells like evalString/runScript on ScriptEngine.
  const cands = mod.enumerateSymbols().filter(s =>
    /ScriptEngine/.test(s.name) && /(evalString|runScript|runByteCodeFile|compile)/.test(s.name)
  );
  const exps = mod.enumerateExports().filter(s =>
    /(evalString|runScript|jsb_run_script|ScriptEngine)/.test(s.name)
  );
  const all = cands.concat(exps);
  log(`eval candidates in ${mod.name}: ${all.length}`);
  for (const s of all) {
    if (hooked.has(s.address.toString())) continue;
    hooked.add(s.address.toString());
    log(`hooking ${s.name} @ ${s.address}`);
    try {
      Interceptor.attach(s.address, {
        onEnter(args) {
          // Itanium ABI: this = args[0]; evalString(const char* script, uint32_t length, Value* ret, const char* fileName)
          // We cannot be sure of the signature; capture the first few pointer args defensively.
          this.name = s.name;
          this.a1 = args[1]; this.a2 = args[2]; this.a3 = args[3]; this.a4 = args[4];
        },
        onLeave(retval) {
          try {
            let text = null, fname = null;
            // Try (this, const char* src, uint32 len, Value*, const char* fileName)
            const len = this.a2.toInt32();
            if (len > 0 && len < 64 * 1024 * 1024) text = readCString(this.a1, len);
            if (text === null) text = readCString(this.a1);
            fname = readCString(this.a4) || readCString(this.a3);
            if (text && text.length > 32) dumpScript(fname, text, this.name);
          } catch (e) { log(`onLeave error in ${this.name}: ${e}`); }
        }
      });
    } catch (e) { log(`hook failed ${s.name}: ${e}`); }
  }
  return all.length > 0;
}

function tryHookXxtea(mod) {
  const exps = mod.enumerateExports().filter(s => /xxtea_decrypt/.test(s.name));
  const syms = mod.enumerateSymbols().filter(s => /xxtea_decrypt/.test(s.name));
  const all = exps.concat(syms);
  log(`xxtea_decrypt candidates in ${mod.name}: ${all.length}`);
  for (const s of all) {
    if (hooked.has(s.address.toString())) continue;
    hooked.add(s.address.toString());
    log(`hooking ${s.name} @ ${s.address}`);
    Interceptor.attach(s.address, {
      // unsigned char* xxtea_decrypt(unsigned char* data, xxtea_long len, unsigned char* key, xxtea_long key_len, xxtea_long* ret_len)
      onEnter(args) { this.retLenPtr = args[4]; },
      onLeave(retval) {
        try {
          const n = this.retLenPtr.readU32();
          if (retval.isNull() || n <= 0 || n > 64 * 1024 * 1024) return;
          const bytes = retval.readByteArray(n);
          send({ type: 'blob', how: 'xxtea_decrypt', length: n }, bytes);
        } catch (e) { log(`xxtea onLeave error: ${e}`); }
      }
    });
  }
  return all.length > 0;
}

function onLib(mod) {
  log(`cocos lib loaded: ${mod.name} base=${mod.base} size=${mod.size}`);
  const a = tryHookEval(mod);
  const b = tryHookXxtea(mod);
  send({ type: 'status', evalHooked: a, xxteaHooked: b, lib: mod.name });
}

function findLoaded() {
  for (const name of LIBS) {
    const m = Process.findModuleByName(name);
    if (m) { onLib(m); return true; }
  }
  return false;
}

// Hook dlopen so we catch the library the moment it loads (Creator 3 loads libcocos late).
function hookDlopen() {
  // Frida 17 removed the static Module.findExportByName(null, ...) form.
  const find = (n) => {
    try { if (Module.findGlobalExportByName) return Module.findGlobalExportByName(n); } catch (_) {}
    for (const lib of ['libdl.so', 'libc.so']) { try { const m = Process.findModuleByName(lib); const a = m && m.findExportByName(n); if (a) return a; } catch (_) {} }
    return null;
  };
  const fn = find('android_dlopen_ext') || find('dlopen');
  if (!fn) { log('no dlopen export found'); return; }
  Interceptor.attach(fn, {
    onEnter(args) { this.path = readCString(args[0]); },
    onLeave() {
      if (!this.path) return;
      for (const name of LIBS) if (this.path.endsWith('/' + name) || this.path === name) setTimeout(findLoaded, 0);
    }
  });
}

hookDlopen();
if (!findLoaded()) log('cocos lib not loaded yet; waiting for dlopen');
