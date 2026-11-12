# Scout report: reverse-engineering toolchain and data paths

Agent run 2026-11-09. Items marked [unsure] were not verified.

## 0. Headline

Block Blast is **not Unity**. Per the Ayoships teardown (https://ayoships.com/breakdowns/block-blast; covered by The Star and mobilegamer.biz) it is a **Cocos Creator (JavaScript) game**: Java shell (jadx) + native Cocos library (Ghidra) + game logic in XXTEA-encrypted JS (`main/index.45fec.js`). Key claims (Android 10.8.2 / iOS 7.4.9):

- Piece generation in JS (functions `rC`/`iC`), offer types such as `hs.OFFER_TYPE.ZHI_SI_TI = 9` → `algo_must_death = 24001`, native helper `func_death_blcok`.
- ~700 server-assigned "traits" downloaded at runtime as XXTEA+Brotli JS from `bband1.afafb.com/update/block_android_online/remoteRes/0/remote/<Trait>/index.<hash>.js`. Named traits: `RewardHighValueAdHarvestTrait` (`HIGH_PRICE_MULTIPLIER=3.5`, `MIN_HISTORY_AD_WATCH_COUNT=3`), `PersonalMarginBreakTrait` (`prob 20`, `recordPercent 10`), `FastHandPunishTrait`, `MultiClearBoostThenKillTrait`, `FailStreakStrategyTrait`.
- On-device models as JSON: XGBoost difficulty classifier (`predict_travel_difficulty_dead`, 500 trees, 52 inputs), XGBoost eCPM regressor (`xgboost_regression_model111.json`), LightGBM next-day-activity model. Server endpoint `/v1/ecpm_prediction` (40 fields).
- Ads: AppLovin MAX + AdMob. AppGoblin SDK list for `com.block.juggle` adds Firebase (analytics only), AppsFlyer, ThinkingData, Volcengine, Bugsnag (https://www.appgoblin.info/apps/com.block.juggle). "Remote config" is **Hungry Studio's own backend, not Firebase Remote Config**.
- Author withheld the XXTEA key and anti-protection steps. Treat as a strong lead to verify independently.

**Implication:** white-box target is decrypted JS (easier than IL2CPP). Black-box "adaptive?" question is partly pre-answered; value is independent replication and quantification. **Caveat:** behavior depends on assigned arm, country, device model, ad history — an emulator with no ad history is a different population than real players.

## 1. Engine check and white-box toolchain

**Determine engine in 30 seconds:**
```
unzip -l base.apk | grep -E 'lib/arm64-v8a/lib|assets/(main|src|bin)' | head -40
```
- `libcocos.so` → Cocos Creator 3.x; `libcocos2djs.so` → Creator 2.x; `.jsc` under `assets/` = encrypted scripts (Cocos docs: "Encrypt JS" produces `.jsc`, key "generated randomly at project creation", optional zip — https://docs.cocos.com/creator/3.8/manual/en/editor/publish/native-options.html).
- `libil2cpp.so` + `global-metadata.dat` → Unity IL2CPP. `libgodot_android.so` → Godot. `libLaya*.so` → Laya.

**Cocos path (expected):**
1. `jadx-gui base.apk` for the Java shell (AppLovin `onUserRewarded`, JNI bridges like `callNativeGetMaxEcpmNumber`).
2. Key recovery: `strings lib/arm64-v8a/libcocos*.so | grep -i -A2 -B2 xxtea`; in Ghidra find `FileUtils::setXXTEAKeyAndSign` / `jsb_set_xxtea_key` / `xxtea_decrypt` and callers (https://awake-2ts.pages.dev/reversing/frameworks/cocos2d-x/, https://www.decompiler.com/cocos). Runtime alternative with Frida: enumerate exports matching `XXTEA`/`setXXTEA` and log args as C strings; or hook `evalString`/`executeScript` to dump plaintext JS as evaluated. Kanxue thread warns Creator 3 `libcocos.so` may not appear in `Process.enumerateModules()` at attach time; hook after launch (https://bbs.kanxue.com/thread-287026.htm). [unsure] Symbols may be stripped.
3. Offline decrypt: Python `xxtea` package (strip sign prefix, decrypt, un-zip or Brotli-decompress remote traits); https://github.com/bartlomiejduda/JSC-PyDecrypt-Tool, https://github.com/Mas0nShi/jsc-Decryption.
4. Read JS: `npx prettier`, grep `OFFER_TYPE`, `algo`, `death`, `ecpm`, `Trait`, `random`. XGBoost JSON models are plain JSON in assets.

**Unity path (if surprised):** Il2CppDumper, Cpp2IL, frida-il2cpp-bridge, AssetStudio/UABE.

## 2. Getting the APK (no device)

- APKMirror hosts `com.block.juggle`; latest 10.9.8 (Nov 2026), **universal APK, 164 MB, Android 7.1+** — no split needed (https://www.apkmirror.com/apk/hungrystudio/block-blast-puzzle-games/). Older versions were BUNDLE (split). Ayoships analyzed 10.8.2.
- XAPK/APKS/APKM: `java -jar APKEditor.jar m -i Block.xapk -o merged.apk` (https://github.com/REAndroid/APKEditor).
- **iOS:** skip. FairPlay decryption needs a jailbreak.

## 3. Running it on the Mac

- **Android Studio AVD, arm64-v8a image** (Apple Silicon). **Google APIs image** = `adb root` works, no Play Store; **Google Play image** = `adb root` refuses, needs rootAVD + Magisk (https://gitlab.com/newbit/rootAVD, https://8ksec.io/rooting-an-android-emulator-for-mobile-security-testing, https://www.trickster.dev/post/setting-up-rooted-android-emulator-with-frida-and-mitmproxy). Use Google APIs; sideload. API 33/34 most stable; cold boot.
- Block Blast **runs on an emulator**: Ayoships used "a clean Android 14 emulator" but needed "a rendering workaround so the game would draw" (unspecified). [unsure] Try `emulator -avd X -gpu host`, then `-gpu swiftshader_indirect`; watch logcat for GL/Vulkan errors.
- No evidence of hard emulator/root blocking; eCPM model takes device/country as inputs, so the emulator likely lands in a low-value arm.
- **Cheap phone:** used unlocked Pixel 6a ≈ $115–133, Pixel 7a ≈ $160–170 on Swappa; avoid Verizon models; root via Magisk. Only if emulator won't render or a realistic ad-history arm is wanted.

## 4. Dynamic instrumentation

- `pip3 install frida-tools`; matching `frida-server-<ver>-android-arm64.xz`; `adb push`, `adb root && adb shell chmod +x ... && adb shell /data/local/tmp/frida-server &`. Then `frida -U -f com.block.juggle -l hook.js`.
- Non-root fallback: `objection patchapk --source base.apk --skip-resources --ignore-nativelibs` (frida-gadget); can trip integrity checks.
- **Ideal logger (Cocos-specific):** inject a JS shim instead of hooking RNG natively. (a) Frida-hook the script-eval entrypoint and append JS that monkey-patches the generator to `console.log(JSON.stringify({board, pieces, algoId}))` → `adb logcat` [unsure about tag]; (b) decrypt → edit `main/index.*.js` → re-encrypt with recovered key → repack/sign (`apktool`, `uber-apk-signer`) → install. Either yields exact per-deal inputs/outputs including which algo/arm produced them. Native `Math.random` hooking is pointless if generation is rule-based.
- Dump downloaded trait cache from the app's writable dir (`/data/data/com.block.juggle/`, Cocos hot-update `getWritablePath()`; exact folder [unsure]).

## 5. Network

- **HTTP Toolkit** "Android device via ADB" on a rooted/Google-APIs AVD auto-installs a system CA and ships Frida unpinning (https://httptoolkit.com/android/, https://github.com/httptoolkit/frida-android-unpinning). mitmproxy equivalent: CA into `/system/etc/security/cacerts/` (Android 14 APEX bind-mount trick) + `frida --codeshare akabe1/frida-multiple-unpinning`.
- Targets: launch config assigning trait arms, `afafb.com/.../remoteRes/...` downloads, `/v1/ecpm_prediction`, AppLovin/AdMob bid responses. [unsure] whether pinning is used.

## 6. Screen-based fallback and automation

- Capture: `adb exec-out screencap -p` (~0.5 s) or scrcpy (`scrcpy --record`, ~33 ms). Grid reading: Vineeth's solver samples 11 points per cell vs background RGB (48,74,139), >40% non-background = filled; pieces harder (no fixed palette) (https://vineeth14.github.io/BlockBlastSolver). Templates: https://github.com/snlagr/sudoku-adb, https://github.com/FabPei/marvel-snap-bot, AdbAutoPlayer.
- Autoplay: pieces are dragged → `adb shell input swipe x1 y1 x2 y2 300`. Caveat: `FastHandPunishTrait` exists, so a fast bot changes its own treatment.
- YouTube dataset: `yt-dlp` + `ffmpeg -vf fps=2`; ToS prohibits downloading; confounded by unknown arms/devices. Low value.
- Natural control: airplane mode is ad-free per reports; compare offline vs online. [unsure] whether offline disables remote traits.

## 7. Legal/ethical framing (US-centric; not legal advice)

- Copyright: intermediate copying for unprotected functional elements is fair use (*Sega v. Accolade*, 9th Cir. 1992, https://www.copyright.gov/fair-use/summaries/segaenters-accolade-9thcir1992.pdf). DMCA §1201(f) interoperability and the good-faith security-research exemption (to Oct 28 2027) fit imperfectly — decrypting XXTEA scripts is arguably circumventing an access control; **never publish the key or bypass steps** (https://cdt.org/blog/security-research-and-the-dmca-the-copyright-office-streamlines-the-exemption-process/).
- Contract: Hungry Studio Terms §5 bar reverse engineering, bots, scraping, circumventing TPMs; Singapore law, SIAC arbitration; US users AAA arbitration with 30-day opt-out (https://www.hungrystudio.com/serviceus.html). Enforceable (*Bowers v. Baystate*; *Davidson v. Jung*). Realistic exposure for a hobby blog: account ban.
- Publish: methods, aggregated statistics, short identifiers/snippets for commentary, hashes. Don't publish: APK, decrypted bundles, keys, repack instructions.
- Disclosure: send findings to the studio before publishing with a response window; note in the post that you asked for comment.

## Minimum viable setup (≈ $0, one weekend to one week)

1. APK (15 min): universal 10.9.x from APKMirror; `unzip -l` to confirm Cocos; `sha256sum`.
2. Static pass (2–3 h): `jadx-gui`; `strings`/Ghidra on `libcocos*.so` for the XXTEA setter; read the JSON models.
3. Emulator (1 h): AVD arm64-v8a Google APIs API 34; cold boot `-gpu host`; `adb install`; confirm it draws.
4. Frida (2–4 h): frida-server via `adb root`; hook XXTEA key path / `evalString`; decrypt `main/index.*.jsc` and cached traits; prettify.
5. Locate generator (2–6 h): grep `OFFER_TYPE`, `algo`, `death`, `Trait`; map algo ids; note assigned traits.
6. Instrument (1–2 days): JS shim logging board + 3 pieces + algo id per deal; `adb input swipe` autoplayer; hundreds of games online vs airplane mode.
7. Network (1 h): HTTP Toolkit ADB mode; capture arm assignment and `/v1/ecpm_prediction`.
8. Only if blocked: used Pixel 6a (~$120).

Key uncertainties: emulator rendering workaround, whether Creator 3 symbols are stripped, logcat tag for JS console, on-device cache path, and that all internals come from one unverified third-party teardown.
