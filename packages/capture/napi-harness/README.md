# napi-harness

Goal: run the game's real piece generator (`libtask.so`, a Node-API addon) **outside the game**, under a plain
Node.js on the Android emulator (Termux build, bionic-linked), so the exact production code can be driven with
arbitrary boards, seeds and configurations at native speed, with no UI, no ads, and no protector.

Why it should work: `libtask.so` imports only libc, one `__android_log_print`, and 29 `napi_*` functions. Its
`DT_NEEDED` on `libcocos2djs.so` exists only because the engine is the N-API host; `data/raw/harness/libtask-standalone.so`
is a copy with that entry removed (`patchelf --remove-needed`). Node exports the `napi_*` symbols to addons.

Steps (device side, as root over adb):
1. Install Termux (`data/raw/termux/termux-arm64.apk`), launch once to extract the bootstrap, `pkg install nodejs`.
2. Push `libtask-standalone.so` as `/data/local/tmp/harness/task.node`.
3. `node load.js` → `process.dlopen` the module, print the export surface. **Result (2026-11-10):** exports `{ BlockAlgorithm }`; prototype `initData`, `offerTopic`, `setConfig`, `loggerListener`. The module must live inside Termux's own data directory (SELinux denies execute-mapping from `/data/local/tmp`).
4. Once the method JSON schemas are known (see `docs/findings/libtask-decompiled.md`), `drive.js` calls the generator for a given board/hand/config and prints the dealt pieces.

Nothing here is committed with the binary; the `.so` stays under `data/raw/` (gitignored).
