// Live logger: hook BlockAlgorithm's N-API method callbacks inside libtask.so and serialise every call's
// argument(s) and return value to JSON using the host's own napi_* functions (resolved from libtask's imports).
// Output: one line per call:  BBCALL {"t":..,"method":..,"args":[..],"ret":..}
'use strict';
const log = (m) => console.log('[jlog] ' + m);
// Works both when attached late (module present) and when spawned (poll until libtask.so appears).
function main(mod) {
const imports = mod.enumerateImports();
const imp = (n) => { const i = imports.find(x => x.name === n); if (!i) throw new Error('no import ' + n); return i.address; };
const P = 'pointer', I = 'int';
const napi_get_cb_info = new NativeFunction(imp('napi_get_cb_info'), I, [P, P, P, P, P, P]);
const napi_get_named_property = new NativeFunction(imp('napi_get_named_property'), I, [P, P, P, P]);
const napi_new_instance = new NativeFunction(imp('napi_new_instance'), I, [P, P, 'size_t', P, P]);
const napi_create_string_utf8 = new NativeFunction(imp('napi_create_string_utf8'), I, [P, P, 'size_t', P]);
const napi_call_function = new NativeFunction(imp('napi_call_function'), I, [P, P, P, 'size_t', P, P]);
const napi_get_undefined = new NativeFunction(imp('napi_get_undefined'), I, [P, P]);
const napi_get_value_string_utf8 = new NativeFunction(imp('napi_get_value_string_utf8'), I, [P, P, P, 'size_t', P]);
const napi_typeof = new NativeFunction(imp('napi_typeof'), I, [P, P, P]);
const SRC = Memory.allocUtf8String('return JSON.stringify(arguments[0]);');
function stringify(env, v) {
  try {
    if (v.isNull()) return null;
    const ty = Memory.alloc(4); if (napi_typeof(env, v, ty) !== 0) return '<typeof failed>';
    const t = ty.readU32(); if (t === 0 /*undefined*/) return 'undefined'; if (t === 1 /*null*/) return 'null';
    const ctor = Memory.alloc(8), fctor = Memory.alloc(8), str = Memory.alloc(8), fn = Memory.alloc(8), undef = Memory.alloc(8), res = Memory.alloc(8);
    const key1 = Memory.allocUtf8String('constructor');
    if (napi_get_named_property(env, v, key1, ctor) !== 0) return '<no ctor>';
    if (napi_get_named_property(env, ctor.readPointer(), key1, fctor) !== 0) return '<no Function>';
    if (napi_create_string_utf8(env, SRC, 36, str) !== 0) return '<str failed>';
    const argv1 = Memory.alloc(8); argv1.writePointer(str.readPointer());
    if (napi_new_instance(env, fctor.readPointer(), 1, argv1, fn) !== 0) return '<new Function failed>';
    napi_get_undefined(env, undef);
    const argv2 = Memory.alloc(8); argv2.writePointer(v);
    if (napi_call_function(env, undef.readPointer(), fn.readPointer(), 1, argv2, res) !== 0) return '<call failed>';
    const len = Memory.alloc(8);
    if (napi_get_value_string_utf8(env, res.readPointer(), NULL, 0, len) !== 0) return '<len failed>';
    const n = len.readU64().toNumber(); const buf = Memory.alloc(n + 1);
    napi_get_value_string_utf8(env, res.readPointer(), buf, n + 1, len);
    return buf.readUtf8String(n);
  } catch (e) { return '<stringify error ' + e + '>'; }
}
// descriptor table: method pointers at these module offsets (from napi_register_module_v1); utf8name pointer sits 0x10 before each.
// Ghidra shows shared objects at image base 0x100000; real vaddrs are 0x100000 lower.
const slots = [0x6789f8, 0x678a38, 0x678a78, 0x678ac8];
for (const off of slots) {
  const base = mod.base.add(off);
  let name = '?'; try { name = base.sub(0x10).readPointer().readUtf8String(); } catch (_) {}
  let fnp = base.readPointer();
  if (fnp.isNull()) { try { fnp = base.add(8).readPointer(); name += '(getter)'; } catch (_) {} }
  if (fnp.isNull()) { log(`slot ${off.toString(16)} ${name}: no method/getter pointer`); continue; }
  log(`hooking ${name} @ ${fnp} (slot 0x${off.toString(16)})`);
  Interceptor.attach(fnp, {
    onEnter(args) {
      this.env = args[0]; this.name = name; this.t = Date.now();
      const argc = Memory.alloc(8); argc.writeU64(4); const argv = Memory.alloc(8 * 4);
      this.args = [];
      if (napi_get_cb_info(args[0], args[1], argc, argv, NULL, NULL) === 0) {
        const n = Math.min(argc.readU64().toNumber(), 4);
        for (let i = 0; i < n; i++) this.args.push(stringify(args[0], argv.add(8 * i).readPointer()));
      }
    },
    onLeave(ret) {
      const out = stringify(this.env, ret);
      console.log('BBCALL ' + JSON.stringify({ t: this.t, dt: Date.now() - this.t, method: this.name, args: this.args, ret: out }));
    }
  });
}
// Force the module's own per-deal logger on (WrapperLogger::setEnabled / setLevel), so logcat gets its events too.
try {
  const ex = mod.enumerateExports();
  const en = ex.find(e => /^_ZN13WrapperLogger10setEnabledEb$/.test(e.name)), lv = ex.find(e => /^_ZN13WrapperLogger8setLevelEi$/.test(e.name));
  if (en) { new NativeFunction(en.address, 'void', ['bool'])(1); log('WrapperLogger::setEnabled(true)'); }
  if (lv) { new NativeFunction(lv.address, 'void', ['int'])(0); log('WrapperLogger::setLevel(0)'); }
  const alw = ex.find(e => /^_ZN13WrapperLogger4infoI/.test(e.name)); if (alw) log('WrapperLogger::info template instance present: ' + alw.name.slice(0, 60));
} catch (e) { log('logger enable failed: ' + e); }
log('ready');
}
// EGL fix so the game draws in the emulator when spawned under this script
Java.perform(() => {
  try { const GLSV = Java.use('android.opengl.GLSurfaceView');
    GLSV.setEGLConfigChooser.overload('int','int','int','int','int','int').implementation = function (r,g,b,a,d,s) { return this.setEGLConfigChooser(8,8,8,8,d,s); };
    log('gl fix installed'); } catch (e) { log('gl fix failed: ' + e); }
});
(function waitForModule() {
  const m = Process.findModuleByName('libtask.so');
  if (m) { main(m); return; }
  const timer = setInterval(() => { const mm = Process.findModuleByName('libtask.so'); if (mm) { clearInterval(timer); main(mm); } }, 200);
  log('waiting for libtask.so');
})();
