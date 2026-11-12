# 05 — Technical and reverse-engineering plan

Operational runbook for the white-box and instrumented-black-box work on **Block Blast!**
(`com.block.juggle`, Hungry Studio / ARETIS LIMITED). Target host: Apple-Silicon Mac,
macOS 26 (Darwin 25.x), no physical Android device, Android emulator only.

Confidence tags per `README.md`: **[C]** confirmed (primary or two independent), **[R]**
reported (one credible secondary), **[S]** speculative (forum/SEO/inference). Inline URLs.

**This machine, as checked (read-only) 2026-11-09:** `arm64`, macOS 26.6.2 (build 25G83),
24 GB RAM (25769803776 bytes), ~516 GB free on `/`. Installed: Homebrew (`/opt/homebrew`),
`openjdk@17` (17.0.17), Node v22.16.0, `pnpm`, Python 3.11.5 (miniconda). **Not installed:**
`adb`, `frida`, `scrcpy`, `ghidra`, `jadx`; no `~/Library/Android/sdk` yet. Implication: the
toolchain below is a clean install, and 24 GB RAM clears the "Studio & Emulator" 16 GB minimum
but not the 32 GB recommendation ([C] https://developer.android.com/studio/install).

---

## 1. Engine identification

**30-second check** on the APK listing (no install, no execution):

```bash
unzip -l base.apk | grep -E 'lib/arm64-v8a/lib|assets/(main|src|bin|jsb)' | head -40
```

Read the native `.so` names and the script container:

- `lib/arm64-v8a/libcocos.so` → **Cocos Creator 3.x**; `libcocos2djs.so` → Creator 2.x.
  Encrypted scripts are `*.jsc` under `assets/` (3.x bundles under `assets/*/` ; 2.x under
  `assets/src/`). [C] Cocos 3.8 "Encrypt JS" produces a `.jsc` file, the **JS Encryption Key**
  is "generated randomly at the project's creation", a **Zip compression** toggle shrinks the
  payload, and the originals are kept in a `script-backup` folder
  (https://docs.cocos.com/creator/3.8/manual/en/editor/publish/native-options.html). The 2.4
  manual is the same feature with different labels — `.jsc` in `src`, "JS Encryption Key"
  "generate the key randomly when created", "Zip Compress", backups in `js backups`
  (https://docs.cocos.com/creator/2.4/manual/en/publish/publish-native.html). Neither manual
  prints the word XXTEA; the algorithm is confirmed from engine source (below).
- **Fallback branches (a few lines each):**
  - **Unity IL2CPP** if you instead see `lib/arm64-v8a/libil2cpp.so` + `assets/bin/Data/Managed/Metadata/global-metadata.dat`. Pivot to Il2CppDumper → Cpp2IL → `frida-il2cpp-bridge`, and AssetStudio/UABE for assets. Much harder than JS. [C] prior scout `scouting/03-toolchain-scout.md`.
  - **Godot** if `libgodot_android.so` + a `.pck`/`.pak`. Use `gdsdecomp` to recover GDScript/scenes.
  - **Laya** if `libLaya*.so`; **generic web wrapper** if the bulk of logic is plain `.js`/`.json` under `assets/` with no engine `.so`.

**Expected path is Cocos Creator 3.x.** The script-load and decrypt mechanism, verified in
engine source `v3.8.0` [C]:

- The key setter is `void jsb_set_xxtea_key(const ccstd::string &key)`, which fills a static
  `std::basic_string<unsigned char> xxteaKey;`. The bytecode extension constant is
  `static const char *BYTE_CODE_FILE_EXT = ".jsc";`. On load the `FileOperationDelegate`
  (`onGetDataFromFile` / `onGetStringFromFile`) swaps the requested path to the `.jsc` sibling,
  calls `xxtea_decrypt(...)` with `xxteaKey.data()`/`xxteaKey.size()`, then—if
  `ZipUtils::isGZipBuffer(data, dataLen)`—`ZipUtils::inflateMemory(...)`. On failure it logs
  `"Can't decrypt code for %s"`
  (https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/bindings/manual/jsb_global_init.cpp).
- Scripts are evaluated through `se::ScriptEngine`:
  `bool runScript(const ccstd::string &path, Value *ret)` and
  `bool evalString(const char *script, uint32_t length, Value *ret, const char *fileName)`
  (https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/bindings/jswrapper/v8/ScriptEngine.h).
  The game template wires the key with a placeholder macro `#define SCRIPT_XXTEAKEY ""` /
  `_xxteaKey = SCRIPT_XXTEAKEY;` that the build fills in
  (https://github.com/cocos/cocos-engine/blob/v3.8.0/templates/common/Classes/Game.cpp). This
  is why the key lives in the native `.so`, not in the scripts.

**Hot-update writable path** (where downloaded "trait" scripts land at runtime): the device
folder is `getWritablePath()`, which on Android resolves to
`CocosHelper.getWritablePath()` → `getFilesDir().getAbsolutePath()`, i.e.
`/data/data/com.block.juggle/files/` (native appends a trailing `/`)
([C] https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/platform/android/java/src/com/cocos/lib/CocosHelper.java,
https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/platform/android/FileUtils-android.cpp).
The engine stores the active search path in `localStorage` under `HotUpdateSearchPaths` and
applies it with `jsb.fileUtils.setSearchPaths(paths)` on next boot, moving staged files out of
a `_temp/` folder
([C] https://docs.cocos.com/creator/3.8/manual/en/advanced-topics/hot-update.html). So the
downloaded `remoteRes/.../index.<hash>.js` traits are readable from the app's `files/`
subtree once pulled with `adb`.

---

## 2. Getting the APK

**Source.** APKMirror lists `com.block.juggle` by HungryStudio. As of 2026-11-09 the newest is
**10.9.8** (uploaded 2026-11-10 UTC), **164.04 MB**, a **universal** variant
(120-640dpi, arm64-v8a/armeabi-v7a/x86/x86_64), **Android 7.1+** — so **no split merge is
needed** for current builds. Prior builds in the list: 10.9.7, 10.9.6, 10.9.5, 10.9.3
([C] https://www.apkmirror.com/apk/hungrystudio/block-blast-puzzle-games/). The **Oct 2026
teardown (Ayoships) used Android 10.8.2 (build 10820)** and iOS 7.4.9
([R] https://ayoships.com/breakdowns/block-blast). Pull both the current universal build and,
if still available, 10.8.2, so findings can be cross-checked against the teardown version.

**Verify it is the Play build.** Mirror sites can host repackaged APKs; confirm the signing
certificate rather than trusting the page:

```bash
# apksigner ships in build-tools/<ver>/; add to PATH after sdkmanager install
apksigner verify --verbose --print-certs base.apk
```

`--print-certs` prints "Signer #1 certificate SHA-256 digest:" among the signer fields
([C] https://developer.android.com/tools/apksigner). Record that digest and compare it across
every version you download; a stable Hungry Studio signing cert across versions is the integrity
check (there is no public Google-published cert hash to diff against, so cross-version identity
plus a passing `verify` is the practical bar). Keep file hashes for everything:

```bash
shasum -a 256 base.apk | tee -a data/real/hashes.txt
```

**If a future build is split** (XAPK/APKS/APKM), merge before analysis:

```bash
java -jar APKEditor.jar m -i Block.xapk -o merged.apk   # REAndroid/APKEditor
```

([C] https://github.com/REAndroid/APKEditor). A merged APK must be re-signed before it will
install; sign with `apksigner sign --ks debug.keystore merged.apk` or uber-apk-signer v1.3.0
(`java -jar uber-apk-signer.jar --apks merged.apk`,
https://github.com/patrickfav/uber-apk-signer/releases). **iOS is out of scope** — FairPlay
decryption needs a jailbreak.

---

## 3. Emulator on Apple Silicon

Use an **arm64-v8a Google APIs** image (not "Google Play"): on Google APIs `adb root` works and
no Magisk is needed; a Google Play image refuses `adb root` and would require rootAVD + Magisk
([C] https://httptoolkit.com/docs/guides/android/;
rootAVD https://gitlab.com/newbit/rootAVD).

**Install the SDK tooling (brew; nothing is installed yet on this host):**

```bash
brew install --cask android-commandlinetools   # build 15859902; gives sdkmanager, avdmanager
brew install --cask android-platform-tools      # 37.0.2; gives adb, fastboot
# (or the full IDE:) brew install --cask android-studio   # 2026.2.2 "Rabbit 2"
export ANDROID_SDK_ROOT="$(brew --prefix)/share/android-commandlinetools"
```

([C] https://formulae.brew.sh/cask/android-commandlinetools,
https://formulae.brew.sh/cask/android-platform-tools). cmdline-tools needs a JDK on `PATH`; the
`openjdk@17` already here is adequate for `sdkmanager`/`avdmanager`.

**Create and launch an AVD.** The arm64-v8a Google-APIs images confirmed present in Google's
repo index: **API 33 (`r17`)** and **API 34 (`r14`)** — both recommended as the most stable —
and API 35 (`r9`) ([C] Google sys-img manifest `sys-img2-3.xml`). API 33/34 are the safe choice.

```bash
sdkmanager "platform-tools" "emulator" \
  "system-images;android-34;google_apis;arm64-v8a"
avdmanager create avd --name bb34 \
  --package "system-images;android-34;google_apis;arm64-v8a" --device pixel_6

# Cold boot, hardware GPU first:
emulator @bb34 -gpu host -no-snapshot-load
```

([C] https://developer.android.com/studio/run/emulator-commandline;
image choice https://developer.android.com/studio/run/emulator-acceleration). `-no-snapshot-load`
forces a full boot so a previous dirty snapshot cannot mask a rendering failure.

**Rendering workaround (expected to be needed).** The Ayoships teardown ran the game on "a clean
Android 14 emulator" but needed "a rendering workaround so the game would draw" (method
unspecified) ([R] https://ayoships.com/breakdowns/block-blast). Cocos uses GLES/Vulkan; the
emulator may fail on one path. Order to try: `-gpu host` (enables MoltenVK Vulkan on macOS), then
`-gpu auto`, then software rendering `-gpu swangle` or `-gpu software`. **Note:**
`-gpu swiftshader_indirect` is now deprecated (as of emulator 36.4.9) and replaced by the
`swangle`/`software` backends ([C]
https://developer.android.com/studio/run/emulator-acceleration). Also try API 33 if 34 will not
draw. Confirm it is actually rendering, not just booting:

```bash
adb root
adb logcat | grep -iE 'cocos|libcocos|vulkan|egl|gralloc|OpenGLRenderer|ANGLE'
```

Cocos logs under tags **`Cocos`** (engine) and **`CocosScript`** (JS `console.log`) via
`__android_log_write` ([C]
https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/base/Log.cpp). GL/Vulkan errors or
a blank surface with no `Cocos` frames mean the render path failed — switch GPU mode.

**Sideload and run:**

```bash
adb install -r base.apk
adb shell monkey -p com.block.juggle -c android.intent.category.LAUNCHER 1
```

**Disk/RAM.** Each AVD system image + userdata is ~8-12 GB; budget ~20-30 GB total with the SDK.
24 GB host RAM is enough for one emulator plus Ghidra but not several at once; give the AVD
~4 GB (`-memory 4096`). The ~516 GB free disk is ample.

**Population caveat (carry into the stats plan).** The eCPM model takes device, country, and ad
history as inputs, so a fresh emulator with no ad history likely lands in a **low-value arm** that
differs from real players ([R] `03-toolchain-scout.md`). This is a confound, not a blocker.

---

## 4. Static analysis

**Java shell — jadx 1.5.6** (`brew install jadx`; the formula pulls its own `openjdk` 27, so no
conflict with `openjdk@17`) ([C] https://formulae.brew.sh/formula/jadx):

```bash
jadx-gui base.apk
```

Search the decompiled shell for:

- **AppLovin MAX callbacks** — `MaxRewardedAdListener` methods `onUserRewarded(MaxAd, MaxReward)`,
  `onAdDisplayed`, `onAdHidden`, `onAdLoadFailed`, and a `MaxAdRevenueListener.onAdRevenuePaid` /
  `ad.getRevenue()` if present ([C]
  https://support.applovin.com/en/max/android/ad-formats/rewarded-ads/). These mark where an ad
  impression and its revenue are observed.
- **JNI bridges** — grep for `callNative*`, specifically the reported
  `callNativeGetMaxEcpmNumber`, plus any `native` method on the game activity. These are the
  Java↔C++ seam into the eCPM/difficulty logic ([R] `03-toolchain-scout.md`).
- **Analytics event names** — ThinkingData `TDAnalytics.track("<event>", props)`
  (artifact `cn.thinkingdata.android:ThinkingAnalyticsSDK`,
  https://docs.thinkingdata.cn/ta-manual/latest/installation/installation_menu/client_sdk/android_sdk_installation/android_sdk_installation.html);
  AppsFlyer `AppsFlyerLib.getInstance().logEvent(ctx, name, values)` with `AFInAppEventType.*`
  constants (https://dev.appsflyer.com/hc/docs/in-app-events-android). The string event names are
  the vocabulary the backend uses — collect them.

**Native `.so` — Ghidra 12.2** (`brew install ghidra`; formula depends on `openjdk@25`; the
README calls for JDK 25) ([C] https://formulae.brew.sh/formula/ghidra;
https://github.com/NationalSecurityAgency/ghidra). Note the Homebrew **cask** was stale at 11.3.1;
prefer the **formula** at 12.2. Launch `ghidraRun`.

- **XXTEA key path in `libcocos*.so`.** First the cheap pass:
  `strings lib/arm64-v8a/libcocos*.so | grep -i xxtea`. In Ghidra search symbols/strings for
  `jsb_set_xxtea_key` (Creator 3.x), `FileUtils::setXXTEAKeyAndSign` (2.x), and `xxtea_decrypt`;
  the key is the argument assigned into the static `xxteaKey` buffer, and in a release build it
  typically sits in `.rodata` reached from the `jsb_set_xxtea_key` caller (the
  `Game::_xxteaKey = SCRIPT_XXTEAKEY` site). **Symbols may be stripped** in the shipped build
  ([S]); if so, locate the setter by its call pattern (fixed-length string copied into a static,
  used just before `xxtea_decrypt`) or recover it dynamically (Section 5). **Do not record or
  publish the key value** — note only that it was recovered and where (per README/legal).
- **`libtask.so` (reported, unverified — treat as [R]/[S]).** The task brief and prior analyses
  say an **unstripped** `libtask.so` holds `AlgorithmCore`, `BinaryBoard`, and `AlgoSelect`; the
  Ayoships writeup itself names no native library beyond "the game's native C++ library" and a
  `func_death_blcok` helper, so confirm `libtask.so` exists in the APK listing before relying on
  it ([R] https://ayoships.com/breakdowns/block-blast; brief). If present and unstripped, read its
  function table for the **piece/shape table** and the **AlgoSelect strategies** (map offer-type
  ids such as the reported `ZHI_SI_TI=9` → `algo_must_death=24001`).

**On-device model JSON (plain files in `assets/`).** Reported: an XGBoost difficulty classifier
`predict_travel_difficulty_dead` (~500 trees, ~52 inputs), an eCPM regressor
`xgboost_regression_model111.json`, and a LightGBM next-day-activity model
([R] `03-toolchain-scout.md`). The XGBoost JSON layout is top-level `{"learner":..., "version":...}`
with **`learner.feature_names`** (the input list), `learner.feature_types`, and trees under
`learner.gradient_booster.model.trees` (`split_indices`, `split_conditions`, `left_children`,
`right_children`, `base_weights`; `tree_param.num_feature`)
([C] https://xgboost.readthedocs.io/en/stable/tutorials/saving_model.html, model.schema). List
feature names directly:

```bash
jq '.learner.feature_names' xgboost_regression_model111.json
jq '.learner.gradient_booster.model.gbtree_model_param.num_trees' predict_travel_difficulty_dead
```

LightGBM text models carry a `feature_names=` header line and `Tree=N` blocks; if it is a text
dump, read the header directly, otherwise load with `lightgbm` and call `Booster.dump_model()`
for JSON ([C] https://lightgbm.readthedocs.io/en/latest/pythonapi/lightgbm.Booster.html). Run any
Python that parses downloaded model files with `python3 -I` and pass paths as arguments (the
files are untrusted data).

---

## 5. Dynamic instrumentation

**Install (versions pinned to today):**

```bash
pip3 install frida-tools                      # 14.13.1 (pulls frida core); Python >=3.7
# frida core as of today: 17.26.2 (2026-11-07). frida-server MUST match the client version.
```

([C] https://pypi.org/project/frida-tools/, https://github.com/frida/frida/releases). Download
the matching `frida-server-17.26.x-android-arm64.xz`, then:

```bash
adb root
adb push frida-server-17.26.x-android-arm64 /data/local/tmp/frida-server
adb shell "chmod 755 /data/local/tmp/frida-server"
adb shell "/data/local/tmp/frida-server &"
frida-ps -U | head            # smoke test
frida -U -f com.block.juggle -l hook.js --no-pause     # spawn
```

([C] https://frida.re/docs/android/). **Attach-timing caveat:** on Creator 3 the `libcocos.so`
module may not be present in `Process.enumerateModules()` at early attach, and some Frida builds
have crashed hooking it — spawn and hook after load, or interpose `android_dlopen_ext` and set
hooks when `libcocos.so` appears ([R] https://bbs.kanxue.com/thread-287026.htm).

**Two routes to plaintext JS:**

- **(a) Hook the key/decrypt function.** Resolve and hook `jsb_set_xxtea_key` (log the argument
  as a C string) or `xxtea_decrypt` (log/dump the decrypted buffer as it returns). This yields
  both the mechanism and every decrypted script. Keep the key out of logs and out of the repo.
- **(b) Hook the eval entry point.** Hook `se::ScriptEngine::evalString(const char*, uint32_t,
  Value*, const char*)` (and/or `runScript`) and dump `arg0` (the script text) plus `fileName`
  for each script as it is evaluated. This captures `main/index.<hash>.js` and every downloaded
  trait at the moment of execution, independent of the key
  ([C] ScriptEngine.h above). A ready-made analogue is `jscHookR` (dump/replace `.jsc` via Frida,
  needs frida-server ≥16) ([R] https://github.com/Mas0nShi/jscHookR).

**Deal logger (the core instrument).** After eval, inject a JS shim that monkey-patches the
generator (the reported `rC`/`iC`) to emit one record per hand. Fields the methodology requires
(`04-methodology-review.md` §E) plus the scoring/trait context:

```js
// shim injected via evalString hook; runs in the game's V8 context
const _emit = (o) => console.log("BBLOG " + JSON.stringify(o));  // tag-prefixed
// wrap the deal function:
_emit({
  t: Date.now(), ver: appVersion, online: isOnline,
  board: boardToBitstring(), pieces: [slot0, slot1, slot2],   // tray/slot order
  algoId: offerType, score, streak, best: personalBest,
  dtSinceLastHand: ms, modelOut: {difficulty, ecpm}, traits: assignedTraits
});
```

**Log transport + schema.** Simplest reliable transport is `console.log` with a fixed prefix →
logcat tag **`CocosScript`**, filtered host-side:

```bash
adb logcat -s CocosScript:* | grep -F 'BBLOG ' | sed 's/^.*BBLOG //' >> data/real/deals.jsonl
```

For high throughput, write instead to a JSONL file under the app's writable dir
`/data/data/com.block.juggle/files/bblog/deals.jsonl` (via `jsb.fileUtils` or a Frida file write)
and `adb pull` it. **JSONL line schema** (one object per line): `t` (epoch ms), `ver`, `online`
(bool), `board` (64-char 0/1, row-major), `pieces` (array of 3 shape ids in slot order), `algoId`
(offer/algo id), `score`, `streak`, `best`, `dtSinceLastHand` (ms), `modelOut`
(`{difficulty, ecpm}`), `traits` (array of assigned trait names). Append-only; one file per
session; first line a header record with AVD id, APK sha256, trait arm.

**RNG stream + counterfactual (methodology §E).** V8 `Math.random` is not seedable, so log it:
hook `Math.random` (JS side) to push each output with a call index and a call-site hash into the
same JSONL, so a hand can be replayed as a deterministic map `(inputs, RNG outputs) → hand`. A
**Frida counterfactual** calls the generator at the same captured RNG state with a swapped board
(empty vs near-full) and records the hand it would have produced; a parallel patched-to-uniform
run measures the effect on game length. **Airplane mode** rules out server-side generation.

**Non-root fallback.** `objection patchapk --source base.apk --ignore-nativelibs` embeds
`frida-gadget` so the app can be instrumented without root (objection 1.12.x supports frida 17)
([C] https://github.com/sensepost/objection/wiki/Patching-Android-Applications,
https://github.com/sensepost/objection/releases). **Risks:** repackaging changes the signature and
can trip integrity/anti-tamper checks; `--ignore-nativelibs` avoids disturbing `extractNativeLibs`
but a signature-checking app may still refuse to run. Prefer the rooted Google-APIs AVD; keep
patchapk only for a non-root device.

---

## 6. Network capture

**HTTP Toolkit "Android device via ADB"** is the low-friction route: it appears once an ADB
device is attached, works on Google-APIs/AOSP emulator builds (but **not** "Google Play" builds),
temporarily injects a system CA on rooted/emulator targets, and ships Frida unpinning scripts
([C] https://httptoolkit.com/docs/guides/android/;
https://github.com/httptoolkit/frida-interception-and-unpinning). Alternative: **mitmproxy** with
the CA installed as a system cert —

```bash
emulator @bb34 -writable-system -no-snapshot-load
adb root && adb remount
HASH=$(openssl x509 -inform PEM -subject_hash_old -in mitmproxy-ca-cert.cer | head -1)
adb push mitmproxy-ca-cert.cer /system/etc/security/cacerts/$HASH.0
adb shell "chmod 644 /system/etc/security/cacerts/$HASH.0" && adb reboot
```

([C] https://docs.mitmproxy.org/stable/howto/install-system-trusted-ca-android/). On **API ≥29**
the `/system` remount gets harder, and on **Android 14** the trust store moved into the Conscrypt
**APEX** (`/apex/com.android.conscrypt/cacerts`), needing a tmpfs-over-cacerts + `nsenter`
bind-mount into each zygote's namespace ([C]
https://httptoolkit.com/blog/android-14-install-system-ca-certificate/). **Staying on API 33/34
avoids the worst of this.**

**What to capture:** the launch/config response that **assigns the trait arm**; the
`bband1.afafb.com/.../remoteRes/0/remote/<Trait>/index.<hash>.js` **trait downloads**; the
`/v1/ecpm_prediction` endpoint (reported ~40 fields); and AppLovin/AdMob **bid responses**
([R] `03-toolchain-scout.md`; https://ayoships.com/breakdowns/block-blast). **Pinning is
uncertain** ([S]); if TLS fails, run `frida --codeshare akabe1/frida-multiple-unpinning -f
com.block.juggle` or the HTTP Toolkit unpinning scripts. The downloaded traits can also be lifted
straight from `/data/data/com.block.juggle/files/` (Section 1) and decrypted offline with the
Python `xxtea` package (6.3.0; `xxtea.decrypt(data, key, padding=...)`) plus Brotli/gzip —
without any network capture at all
([C] https://pypi.org/project/xxtea/).

---

## 7. Automated player and screen capture

**Record & stills.** scrcpy 5.0.1 (`brew install scrcpy`) for session video; `adb exec-out` for
frame-accurate stills ([C] https://formulae.brew.sh/formula/scrcpy;
https://github.com/Genymobile/scrcpy/blob/master/doc/recording.md):

```bash
scrcpy --record=session.mp4 --max-fps=30 --max-size=1080    # mirror + record
scrcpy --no-playback --no-window --record=session.mkv       # headless capture
adb exec-out screencap -p > frame.png                       # single still
```

**Drag input (pieces are dragged from the tray):**

```bash
adb shell input swipe x1 y1 x2 y2 300    # 300 ms = human-ish; vary it
```

**Pace like a human.** A reported `FastHandPunishTrait` means a fast bot *changes its own
treatment* — jitter swipe durations and inter-move delays to a human range (hundreds of ms to a
few seconds), or the measurement is confounded by the bot's speed ([R] `03-toolchain-scout.md`).

**Board reader (pixel sampling).** Crop the 8×8 board; sample **~11 points per cell** and compare
each against the background RGB **(48, 74, 139)** — a cell is filled when **>40%** of samples are
non-background ([R] https://vineeth14.github.io/BlockBlastSolver). For a resolution-independent
reader, `jason66l/blockblast_vision` detects the 9 grid lines per axis by brightness profile,
classifies each of the 64 cells by HSV value-channel brightness, and segments tray pieces with
Otsu thresholding on saturation ([R] https://github.com/jason66l/blockblast_vision). The Frida
deal logger (Section 5) is ground truth; the pixel reader is a cross-check and the only option if
instrumentation is blocked.

**Game-over / revive detection.** Template-match a fixed region for the game-over and revive
dialogs (distinct button art) on each captured frame; trigger end-of-game logging and the control
decision (accept/decline revive) from that.

**Airplane-mode control condition.** Reports say airplane mode is ad-free; run matched
online/offline sessions to test whether difficulty/generation changes when the backend is
unreachable (`04-methodology-review.md` §E). `adb shell cmd connectivity airplane-mode enable`.

---

## 8. Data hygiene

- **Raw logs** → `data/real/` only, which is **gitignored** (confirmed: `.gitignore` already lists
  `data/real/`, `data/raw/`, `*.jsonl`, `*.parquet`, with `!data/**/README.md`).
- **Never committed** (also already gitignored): APK/XAPK (`*.apk *.xapk *.apks *.apkm *.ipa`),
  decrypted bundles (`*.jsc`, `decrypted/`, `extracted/`), native libs (`*.so`), and keys
  (`keys/`, `*.key`). **Also never written down anywhere in the repo:** the XXTEA key value and
  any repack/anti-protection bypass steps.
- **Hash + version record.** Append `sha256` of every APK, every decrypted model, and every
  frida-server to `data/real/hashes.txt`; record the game `versionName`/`versionCode`,
  system-image revision, frida version, and the assigned trait arm in each session's header line.
- **Multiple fresh AVD profiles.** Create a separate clean AVD (new userdata, new install, new ad
  history) per trait arm you want to compare; arm assignment depends on device/history, so reusing
  one profile contaminates the comparison (Section 3 caveat).

---

## 9. Legal and ethical framing (US-centric; not legal advice)

- **Copyright / fair use.** Intermediate copying and disassembly to reach the *unprotected
  functional elements* of a program is fair use where it is the only way in and the purpose is
  legitimate: *Sega Enters. Ltd. v. Accolade, Inc.*, 977 F.2d 1510 (9th Cir. 1992) — the court
  held disassembly "for a legitimate reason and lack of other means to access the elements not
  protected by copyright constituted fair use," warning that otherwise the owner gains "a de facto
  monopoly over the functional aspects of the work"
  ([C] https://www.copyright.gov/fair-use/summaries/segaenters-accolade-9thcir1992.pdf).
- **DMCA §1201.** §1201(a)(1)(A) bars circumventing an access control; decrypting the XXTEA scripts
  is **arguably** such circumvention. §1201(f)(1) permits circumvention by one who "has lawfully
  obtained the right to use a copy" for "the sole purpose of identifying and analyzing those
  elements…necessary to achieve interoperability," and the **good-faith security-research
  exemption** (37 CFR **201.40(b)(18)**, renewed in the 2024 triennial rulemaking, 89 FR 85446,
  Oct 28 2024, running the standard three-year term to ~Oct 2027) covers research on a "lawfully
  acquired device," "in an environment designed to avoid any harm," where results are "not used or
  maintained in a manner that facilitates copyright infringement"
  ([C] https://www.law.cornell.edu/cfr/text/37/201.40;
  https://www.law.cornell.edu/uscode/text/17/1201). **The fit is imperfect:** this is difficulty
  fairness research, not security testing, and 201.40(b)(18)(iii) explicitly does not immunize you
  from the CFAA ([C] CDT on the CFAA double-liability problem:
  https://cdt.org/blog/security-research-and-the-dmca-the-copyright-office-streamlines-the-exemption-process/).
  **Mitigation: analyze your own lawfully downloaded copy; never publish the key or the bypass
  steps.**
- **Contract (the binding constraint in practice).** Hungry Studio's US Terms (operator **ARETIS
  LIMITED**, "Last Updated Nov 2 2026") §5 "Users' Conduct" bars users to "reverse engineer,
  decompile, disassemble, modify, or create unauthorized derivative works of the Services"
  (except where that restriction is prohibited by applicable law), and to "use bots, scripts,
  automation, scraping, data mining…" or "circumvent security, access restrictions, anti-cheat,
  anti-fraud, or technical protection measures." §13 sets Singapore law / SIAC; §17 for US
  residents sets AAA individual arbitration with a **30-day opt-out**
  ([C] https://www.hungrystudio.com/serviceus.html). Such clauses are generally enforceable
  (*Bowers v. Baystate Techs.*, 320 F.3d 1317 (Fed. Cir. 2003); *Davidson & Assocs. v. Jung*,
  422 F.3d 630 (8th Cir. 2005)).
- **Realistic exposure.** For a hobby/research blog analyzing your own copy, the realistic
  consequence is an **account/game ban**, not litigation — but the contract terms are real, so
  conduct the work on throwaway accounts/AVDs and keep it non-commercial.
- **What to publish / withhold.** Publish: methodology, aggregated statistics, short code/string
  identifiers for commentary, and file hashes. Do **not** publish: the APK, decrypted bundles, the
  XXTEA key, or any repack/anti-protection instructions.
- **Disclosure.** Send findings to the developer with a response window before publishing, and
  state in the writeup that comment was requested (whether or not they reply).

---

## 10. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Emulator will not render the game | High [R] | High (blocks everything) | Try `-gpu host` → `auto` → `swangle`/`software`; API 33 and 34; watch logcat for GL/Vulkan errors; last resort used Pixel 6a (§11) |
| 2 | `libcocos.so` symbols stripped (key setter not named) | Medium [S] | Medium | Recover key dynamically via Frida (§5a); locate setter by call pattern before `xxtea_decrypt` |
| 3 | `libtask.so` / scripts not where expected (generator native, not JS) | Medium [S] | Medium | Verify library list first; if native, hook the JNI bridge and `func_death_blcok` in Ghidra instead of JS |
| 4 | Integrity/anti-tamper check fails on repacked APK | Medium [S] | Medium | Prefer rooted AVD + runtime Frida over patchapk; use `--ignore-nativelibs`; keep repack as fallback only |
| 5 | Emulator assigned a low-value trait arm unlike real players | High [R] | High (external validity) | Record assigned arm per session; compare multiple fresh profiles; frame results as arm-conditional, not universal |
| 6 | `FastHandPunishTrait` triggered by the bot | Medium [R] | High (confound) | Human-speed, jittered swipe timing; log `dtSinceLastHand`; include a matched slow-play condition |
| 7 | Server rate limits / bot detection | Medium [S] | Medium | Throttle requests; realistic pacing; run the airplane-mode offline condition as an unthrottled baseline |
| 8 | Account ban | Medium [C/contract] | Low–Medium | Throwaway accounts/AVDs; non-commercial; no live-service abuse; disclose before publishing |
| 9 | TLS pinning blocks network capture | Low–Medium [S] | Low | Frida unpinning (akabe1 / HTTP Toolkit); or read trait cache from `files/` and decrypt offline |
| 10 | Analysis built on one unverified third-party teardown | High [R] | Medium | Independently reproduce every claim; tag provenance; this plan's value is the independent replication |

---

## 11. Ordered minimum viable setup ($0 budget)

All tools below are free; total time ≈ one weekend to one week. Paid fallback only at the end.

1. **Toolchain install (~45 min).** `brew install --cask android-commandlinetools android-platform-tools`; `brew install jadx ghidra scrcpy apktool`; `pip3 install frida-tools`. (Java is handled per-formula; `openjdk@17` already present covers the SDK CLI.)
2. **APK (~15 min).** Download the universal 10.9.x from APKMirror (and 10.8.2 if available); `unzip -l` to confirm `libcocos.so` + `.jsc`; `apksigner verify --print-certs`; record `shasum -a 256`.
3. **Static pass (~2–3 h).** `jadx-gui` the shell (AppLovin callbacks, `callNative*` bridges, event names); `strings`/Ghidra on `libcocos*.so` for the XXTEA setter; `jq` the XGBoost/LightGBM model JSON for `feature_names`.
4. **Emulator (~1 h).** `sdkmanager "system-images;android-34;google_apis;arm64-v8a"`; `avdmanager create avd`; `emulator -gpu host -no-snapshot-load`; `adb root`; `adb install`; confirm it draws via logcat `Cocos` frames. Apply the rendering workaround if blank.
5. **Frida to plaintext (~2–4 h).** Matching frida-server 17.26.x; `adb push`; hook `jsb_set_xxtea_key`/`xxtea_decrypt` (§5a) or `evalString` (§5b); dump `main/index.*.js` and cached traits; `prettier` and read.
6. **Locate the generator (~2–6 h).** grep decrypted JS for `OFFER_TYPE`, `algo`, `death`, `Trait`, `ecpm`, `random`; map algo ids; note the assigned traits.
7. **Instrument + collect (~1–2 days).** Inject the deal logger (JSONL schema §5) + `Math.random` logger; `adb input swipe` autoplayer at human pace; run hundreds of games online vs airplane mode; add the Frida counterfactual.
8. **Network (~1 h).** HTTP Toolkit ADB mode; capture arm assignment, `remoteRes` trait downloads, `/v1/ecpm_prediction`.
9. **Paid fallback (only if the emulator will not render or a realistic ad-history arm is required): a used, unlocked Pixel 6a, ~$115–142** (Swappa average ~$142, recent sold units $115–119;
   https://swappa.com/guide/google-pixel-6a/prices) — a real device sidesteps the emulator render
   problem and places the account in a genuine device/ad-history population instead of the
   emulator's likely low-value arm (Section 3). Root with Magisk; avoid carrier-locked (e.g.
   Verizon) units.

---

## Confidence and gaps

- **[C]** Engine decrypt/eval mechanism, hot-update writable path, and logcat tags are confirmed
  from Cocos engine source v3.8.0 and the official manuals. APKMirror version/size/min-SDK, the
  arm64-v8a Google-APIs image availability (API 33 r17, 34 r14, 35 r9), every tool version pinned,
  the emulator `-gpu`/snapshot flags, apksigner/APKEditor usage, the XGBoost JSON layout, the
  Hungry Studio Terms clauses, and the cited case law are all from primary pages.
- **[R]** All game-internal specifics — `libtask.so`/`AlgorithmCore`/`BinaryBoard`/`AlgoSelect`,
  the trait names, `rC`/`iC`, `algo_must_death=24001`, the model filenames, `/v1/ecpm_prediction`,
  and the "rendering workaround" — trace to one third-party teardown (Ayoships) plus the project's
  own prior scouting, not to independent confirmation. Ayoships notably does **not** name a
  `libtask.so`; that attribution is from the brief and must be verified against the actual APK.
- **Top three uncertainties:** (1) **whether the emulator will render at all**, and if so which
  GPU backend/API level works (the teardown needed an unspecified workaround); (2) **whether the
  Creator-3 `libcocos.so` is stripped**, which decides whether the key path is read statically or
  must be recovered live via Frida; (3) **whether the game's piece generation lives in the
  decrypted JS or in native `libtask.so`**, which determines whether the deal logger is a JS shim
  or a native/JNI hook. Secondary open items: exact logcat tag the game uses for its own
  `console.log` (engine default is `CocosScript`, but the app may override), whether offline mode
  disables remote traits, and whether TLS pinning is in use.

## Sources

https://docs.cocos.com/creator/3.8/manual/en/editor/publish/native-options.html
https://docs.cocos.com/creator/2.4/manual/en/publish/publish-native.html
https://docs.cocos.com/creator/3.8/manual/en/advanced-topics/hot-update.html
https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/bindings/manual/jsb_global_init.cpp
https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/bindings/jswrapper/v8/ScriptEngine.h
https://github.com/cocos/cocos-engine/blob/v3.8.0/templates/common/Classes/Game.cpp
https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/platform/android/java/src/com/cocos/lib/CocosHelper.java
https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/platform/android/FileUtils-android.cpp
https://github.com/cocos/cocos-engine/blob/v3.8.0/native/cocos/base/Log.cpp
https://www.apkmirror.com/apk/hungrystudio/block-blast-puzzle-games/
https://ayoships.com/breakdowns/block-blast
https://developer.android.com/tools/apksigner
https://github.com/REAndroid/APKEditor
https://github.com/patrickfav/uber-apk-signer/releases
https://developer.android.com/studio/install
https://developer.android.com/studio/run/emulator-commandline
https://developer.android.com/studio/run/emulator-acceleration
https://formulae.brew.sh/cask/android-commandlinetools
https://formulae.brew.sh/cask/android-platform-tools
https://formulae.brew.sh/cask/android-studio
https://gitlab.com/newbit/rootAVD
https://formulae.brew.sh/formula/jadx
https://formulae.brew.sh/formula/ghidra
https://github.com/NationalSecurityAgency/ghidra
https://support.applovin.com/en/max/android/ad-formats/rewarded-ads/
https://docs.thinkingdata.cn/ta-manual/latest/installation/installation_menu/client_sdk/android_sdk_installation/android_sdk_installation.html
https://dev.appsflyer.com/hc/docs/in-app-events-android
https://www.appgoblin.info/apps/com.block.juggle
https://xgboost.readthedocs.io/en/stable/tutorials/saving_model.html
https://lightgbm.readthedocs.io/en/latest/pythonapi/lightgbm.Booster.html
https://pypi.org/project/frida-tools/
https://github.com/frida/frida/releases
https://frida.re/docs/android/
https://bbs.kanxue.com/thread-287026.htm
https://github.com/Mas0nShi/jscHookR
https://pypi.org/project/xxtea/
https://github.com/sensepost/objection/wiki/Patching-Android-Applications
https://github.com/sensepost/objection/releases
https://httptoolkit.com/docs/guides/android/
https://github.com/httptoolkit/frida-interception-and-unpinning
https://httptoolkit.com/blog/android-14-install-system-ca-certificate/
https://docs.mitmproxy.org/stable/howto/install-system-trusted-ca-android/
https://formulae.brew.sh/formula/scrcpy
https://github.com/Genymobile/scrcpy/blob/master/doc/recording.md
https://developer.android.com/tools/adb
https://vineeth14.github.io/BlockBlastSolver
https://github.com/jason66l/blockblast_vision
https://www.copyright.gov/fair-use/summaries/segaenters-accolade-9thcir1992.pdf
https://www.law.cornell.edu/cfr/text/37/201.40
https://www.law.cornell.edu/uscode/text/17/1201
https://cdt.org/blog/security-research-and-the-dmca-the-copyright-office-streamlines-the-exemption-process/
https://www.hungrystudio.com/serviceus.html
https://swappa.com/guide/google-pixel-6a/prices
