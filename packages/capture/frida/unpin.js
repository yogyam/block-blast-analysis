// Generic Android TLS unpinning for a mitmproxy capture: OkHttp3 CertificatePinner, Conscrypt TrustManagerImpl,
// and any X509TrustManager.checkServerTrusted. Safe to combine with the other scripts.
'use strict';
const log = (m) => console.log('[unpin] ' + m);
Java.perform(() => {
  const tryHook = (cls, fn) => { try { fn(Java.use(cls)); log('hooked ' + cls); } catch (e) { log('skip ' + cls + ': ' + String(e).split('\n')[0]); } };
  tryHook('okhttp3.CertificatePinner', (C) => { C.check.overload('java.lang.String', 'java.util.List').implementation = function () {}; try { C.check.overload('java.lang.String', 'java.security.cert.Certificate').implementation = function () {}; } catch (_) {} try { C['check$okhttp'].implementation = function () {}; } catch (_) {} });
  tryHook('com.android.org.conscrypt.TrustManagerImpl', (T) => {
    T.verifyChain.implementation = function (untrusted, trustAnchor, host, clientAuth, ocsp, sct) { return untrusted; };
    try { T.checkTrustedRecursive.implementation = function (certs) { return Java.use('java.util.ArrayList').$new(); }; } catch (_) {}
  });
  // Any custom X509TrustManager implementations loaded later
  const X509TM = 'javax.net.ssl.X509TrustManager';
  setTimeout(() => Java.perform(() => Java.enumerateLoadedClasses({ onMatch(name) { if (/TrustManager/i.test(name) && !/conscrypt|javax\.net/.test(name)) { try { const K = Java.use(name); if (K.checkServerTrusted) { K.checkServerTrusted.overloads.forEach(o => { o.implementation = function () { return o.returnType.className === 'void' ? undefined : Java.use('java.util.ArrayList').$new(); }; }); log('neutralised ' + name); } } catch (_) {} } }, onComplete() {} })), 3000);
  tryHook('com.google.android.gms.org.conscrypt.TrustManagerImpl', (T) => { T.verifyChain.implementation = function (u) { return u; }; });
  log('ready');
});
