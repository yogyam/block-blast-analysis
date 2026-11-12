// Trace which exported libtask.so strategy functions fire during play. Combine with the GL fix so the
// game boots under spawn. Logs: name, call index, coarse args for a few known signatures.
'use strict';
const log = (m) => console.log('[task] ' + m);
let n = 0;
const PATTERNS = /^(selectBlock|select[A-Z]|selectCom|selectRandom|selectCut|selectFill|selectEdge|selectZiMu|selectLess|func_|algo_|trap_|safety_|tkxc_|noBit|offerBlock|getBlockPool|coverRate|idPriority|hasLiveWay|napi_register_module_v1)/;
function demangleLite(name) { // show the plain name for free functions (mangled _Z<len><name>...)
  const m = /^_Z(\d+)([A-Za-z_][A-Za-z0-9_]*)/.exec(name);
  return m ? m[2].slice(0, parseInt(m[1], 10)) : name;
}
function hookTask(mod) {
  let count = 0;
  for (const e of mod.enumerateExports()) {
    if (e.type !== 'function') continue;
    const plain = demangleLite(e.name);
    if (!PATTERNS.test(plain)) continue;
    try {
      Interceptor.attach(e.address, {
        onEnter(args) { this.t = Date.now(); this.i = ++n; this.a0 = args[0]; this.a1 = args[1];
          if (plain === 'coverRate') this.extra = ' arg1=' + args[1].toInt32(); },
        onLeave(ret) { log(`#${this.i} ${plain}${this.extra || ''} ret=${ret} dt=${Date.now() - this.t}ms`); }
      });
      count++;
    } catch (err) { log('hook failed ' + plain + ': ' + err); }
  }
  // seeded RNG: log seeds
  for (const e of mod.enumerateExports()) {
    if (/^_ZN15FixedRandomUtil8initSeedEx$/.test(e.name)) {
      Interceptor.attach(e.address, { onEnter(args) { log('FixedRandomUtil::initSeed(' + args[1].toString() + ')'); } });
    }
  }
  log(`hooked ${count} strategy exports in ${mod.name} @ ${mod.base}`);
}
function tryHook() { const m = Process.findModuleByName('libtask.so'); if (m && !tryHook.done) { tryHook.done = true; hookTask(m); } return !!m; }
if (!tryHook()) {
  // Poll for the module: robust regardless of which dlopen flavour the N-API loader uses.
  const timer = setInterval(() => { if (tryHook()) clearInterval(timer); }, 250);
  log('waiting for libtask.so (polling)');
}
// --- GL fix (same as gl-config-fallback.js) ---
Java.perform(() => {
  const GLSV = Java.use('android.opengl.GLSurfaceView');
  GLSV.setEGLConfigChooser.overload('int','int','int','int','int','int').implementation = function (r,g,b,a,d,s) { return this.setEGLConfigChooser(8,8,8,8,d,s); };
  log('gl fix installed');
});
