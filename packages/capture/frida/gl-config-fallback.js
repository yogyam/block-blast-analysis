// Minimal EGL fallback: only hook BaseConfigChooser.chooseConfig; no constructor hooks, no stack traces.
// (A broader probe with framework constructor hooks crashed the process on Android 14.)
'use strict';
const log = (m) => console.log('[glfix] ' + m);
Java.perform(() => {
  const GLSV = Java.use('android.opengl.GLSurfaceView');
  // First line of defence: rewrite the request itself. RGB565 + stencil has no EGL config on the emulator.
  GLSV.setEGLConfigChooser.overload('int','int','int','int','int','int').implementation = function (r,g,b,a,d,s) {
    log(`setEGLConfigChooser(${r},${g},${b},${a},${d},${s}) -> (8,8,8,8,${d},${s})`);
    return this.setEGLConfigChooser(8,8,8,8,d,s);
  };
  const Base = Java.use('android.opengl.GLSurfaceView$BaseConfigChooser');
  const EGL10 = 'javax.microedition.khronos.egl.EGL10', EGLDisplay = 'javax.microedition.khronos.egl.EGLDisplay';
  Base.chooseConfig.overload(EGL10, EGLDisplay).implementation = function (egl, display) {
    let spec0 = []; try { spec0 = Array.from(this.mConfigSpec.value); } catch (_) {}
    log('chooseConfig called, spec=' + JSON.stringify(spec0));
    try { return this.chooseConfig(egl, display); }
    catch (e) {
      let spec = []; try { spec = Array.from(this.mConfigSpec.value); } catch (_) {}
      log('original spec failed: ' + JSON.stringify(spec));
      // The app asks for RGB565 + depth16 + stencil8 + ES2 and creates an ES2 context, so every
      // fallback keeps the ES2 renderable bit (4) and the stencil buffer; only colour depth is relaxed.
      const specs = [
        [0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,16,0x3026,8,0x3040,4,0x3038],
        [0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3026,8,0x3040,4,0x3038],
        [0x3024,8,0x3023,8,0x3022,8,0x3021,0,0x3025,16,0x3026,8,0x3040,4,0x3038],
        [0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,16,0x3040,4,0x3038],
        [0x3024,8,0x3023,8,0x3022,8,0x3040,4,0x3038],
      ];
      for (const s of specs) {
        const num = Java.array('int', [0]); const jspec = Java.array('int', s);
        if (!egl.eglChooseConfig(display, jspec, null, 0, num) || num[0] <= 0) continue;
        const n = num[0]; const arr = []; for (let i = 0; i < n; i++) arr.push(null);
        const configs = Java.array('javax.microedition.khronos.egl.EGLConfig', arr);
        egl.eglChooseConfig(display, jspec, configs, n, num);
        log('using relaxed spec ' + JSON.stringify(s) + ' (' + n + ' configs)');
        return configs[0];
      }
      throw e;
    }
  };
  log('fallback installed'); log('READY_TO_RESUME');
});
