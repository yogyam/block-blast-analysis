// Log what EGL configuration the app's GLSurfaceView asks for, and when Android's BaseConfigChooser
// cannot satisfy it on the emulator, fall back to progressively relaxed configs so the Cocos surface starts.
'use strict';
const log = (m) => console.log('[glprobe] ' + m);
Java.perform(() => {
  const GLSV = Java.use('android.opengl.GLSurfaceView');
  const Base = Java.use('android.opengl.GLSurfaceView$BaseConfigChooser');
  const Log = Java.use('android.util.Log'); const Exc = Java.use('java.lang.Exception');
  const stack = () => Log.getStackTraceString(Exc.$new()).split('\n').slice(2, 7).join(' <- ');
  GLSV.setEGLContextClientVersion.implementation = function (v) { log(`setEGLContextClientVersion(${v}) view=${this.$className} ${stack()}`); return this.setEGLContextClientVersion(v); };
  GLSV.setEGLConfigChooser.overload('int','int','int','int','int','int').implementation = function (r,g,b,a,d,s) { log(`setEGLConfigChooser(${r},${g},${b},${a},${d},${s}) view=${this.$className} ${stack()}`); return this.setEGLConfigChooser(r,g,b,a,d,s); };
  GLSV.setEGLConfigChooser.overload('android.opengl.GLSurfaceView$EGLConfigChooser').implementation = function (c) { log(`setEGLConfigChooser(chooser=${c ? c.$className : null}) view=${this.$className} ${stack()}`); return this.setEGLConfigChooser(c); };
  GLSV.setEGLConfigChooser.overload('boolean').implementation = function (b) { log(`setEGLConfigChooser(needDepth=${b}) view=${this.$className}`); return this.setEGLConfigChooser(b); };
  Base.$init.overload('android.opengl.GLSurfaceView', '[I').implementation = function (outer, spec) { log('BaseConfigChooser spec=' + JSON.stringify(Array.from(spec))); return this.$init(outer, spec); };
  const EGL10 = 'javax.microedition.khronos.egl.EGL10', EGLDisplay = 'javax.microedition.khronos.egl.EGLDisplay';
  Base.chooseConfig.overload(EGL10, EGLDisplay).implementation = function (egl, display) {
    try { return this.chooseConfig(egl, display); }
    catch (e) {
      let spec = []; try { spec = Array.from(this.mConfigSpec.value); } catch (_) {}
      log('chooseConfig FAILED for spec=' + JSON.stringify(spec) + ' : ' + e);
      // EGL constants: RED 0x3024 GREEN 0x3023 BLUE 0x3022 ALPHA 0x3021 DEPTH 0x3025 STENCIL 0x3026 RENDERABLE_TYPE 0x3040 (ES2=4, ES3=0x40) NONE 0x3038
      const specs = [
        [0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,24,0x3026,8,0x3040,0x40,0x3038],
        [0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,16,0x3026,8,0x3040,4,0x3038],
        [0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3025,16,0x3040,4,0x3038],
        [0x3024,8,0x3023,8,0x3022,8,0x3040,4,0x3038],
        [0x3038],
      ];
      for (const s of specs) {
        const num = Java.array('int', [0]); const jspec = Java.array('int', s);
        if (!egl.eglChooseConfig(display, jspec, null, 0, num) || num[0] <= 0) { log('  relaxed ' + JSON.stringify(s) + ' -> 0'); continue; }
        const n = num[0]; const arr = []; for (let i = 0; i < n; i++) arr.push(null);
        const configs = Java.array('javax.microedition.khronos.egl.EGLConfig', arr);
        egl.eglChooseConfig(display, jspec, configs, n, num);
        log('  relaxed ' + JSON.stringify(s) + ' -> ' + n + ' configs; using the first');
        return configs[0];
      }
      throw e;
    }
  };
  log('hooks installed');
});
