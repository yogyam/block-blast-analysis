#!/usr/bin/env bash
# Phase 2 steps 1–2: identify engine, verify signature, inventory assets, decompile Java shell,
# and check whether the native libraries carry symbols.
# Usage: scripts/phase2/02-static-triage.sh <base.apk> [split_config.*.apk ...]
# Output: data/raw/triage/<apk-basename>/ (gitignored). Read-only with respect to the APK.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/scripts/phase2/env.sh"
APK="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
NAME="$(basename "$(dirname "$APK")")-$(basename "$APK" .apk)"
SPLITS=()
shift || true
for s in "$@"; do SPLITS+=("$(cd "$(dirname "$s")" && pwd)/$(basename "$s")"); done
OUT="$ROOT/data/raw/triage/$NAME"
mkdir -p "$OUT"
cd "$OUT"

echo "== hash"; shasum -a 256 "$APK" | tee hash.txt
echo "== signature"; apksigner verify --verbose --print-certs "$APK" 2>&1 | tee apksigner.txt | /usr/bin/grep -E 'Verifies|Signer #1 certificate SHA-256|Verified using' || true
echo "== manifest basics"; apktool d -q -s -f -o "$OUT/apktool" "$APK" >/dev/null 2>&1 || echo "apktool failed (non-fatal)"
[ -f apktool/AndroidManifest.xml ] && /usr/bin/grep -oE '(package|android:versionName|android:versionCode|android:minSdkVersion|android:targetSdkVersion)="[^"]*"' apktool/AndroidManifest.xml apktool/apktool.yml 2>/dev/null | sort -u | head -10 || true
[ -f apktool/apktool.yml ] && /usr/bin/grep -E 'versionName|versionCode|minSdkVersion|targetSdkVersion' apktool/apktool.yml || true

echo "== full file listing (base + splits)"; { unzip -l "$APK"; for s in "${SPLITS[@]}"; do echo "### $s"; unzip -l "$s"; done; } > listing.txt
echo "== engine fingerprint"
/usr/bin/grep -E 'lib/arm64-v8a/' listing.txt | awk '{print $1, $4}' | sort -k2 | tee libs-arm64.txt
echo "-- verdict:"
if /usr/bin/grep -qE 'libcocos\.so' listing.txt; then echo "Cocos Creator 3.x (libcocos.so)"; fi
if /usr/bin/grep -qE 'libcocos2djs\.so' listing.txt; then echo "Cocos Creator 2.x / cocos2d-x JS (libcocos2djs.so)"; fi
if /usr/bin/grep -qE 'libil2cpp\.so|global-metadata\.dat' listing.txt; then echo "Unity IL2CPP"; fi
if /usr/bin/grep -qE 'libgodot' listing.txt; then echo "Godot"; fi
echo "== script assets (.jsc / .js) count and samples"
/usr/bin/grep -cE '\.(jsc|js)$' listing.txt || true
/usr/bin/grep -E '\.(jsc|js)$' listing.txt | awk '{print $1, $4}' | sort -k1 -n -r | head -15
echo "== model / config JSON (xgboost, lightgbm, model, trait)"
/usr/bin/grep -iE '(xgb|xgboost|lightgbm|lgb|model|trait|config).*\.(json|txt|bin)$' listing.txt | awk '{print $1, $4}' | head -40 | tee models.txt
echo "== extract native libs + assets of interest"
mkdir -p extract && (cd extract && unzip -oq "$APK" 'lib/arm64-v8a/*' 'assets/*' 2>/dev/null || true; for s in "${SPLITS[@]}"; do unzip -oq "$s" 'lib/arm64-v8a/*' 'assets/*' 2>/dev/null || true; done)
echo "== native symbol check (stripped?)"
for so in extract/lib/arm64-v8a/*.so; do
  b="$(basename "$so")"; sz=$(stat -f%z "$so")
  dyn=$(nm -D "$so" 2>/dev/null | wc -l | tr -d ' ')
  sym=$(nm "$so" 2>/dev/null | wc -l | tr -d ' ')
  printf '%-32s %10d bytes  dynsyms=%-6s syms=%-6s\n' "$b" "$sz" "$dyn" "$sym"
done | tee symbols.txt
echo "== interesting symbols/strings in cocos + task libs"
for so in extract/lib/arm64-v8a/libcocos*.so extract/lib/arm64-v8a/libtask*.so; do
  [ -f "$so" ] || continue
  echo "-- $so"
  nm -D "$so" 2>/dev/null | /usr/bin/grep -iE 'xxtea|evalString|runScript|ScriptEngine|AlgoSelect|AlgorithmCore|BinaryBoard|hasLiveWay|func_death|g_arrShape' | head -40
  strings -n 8 "$so" | /usr/bin/grep -iE 'xxtea|AlgoSelect|AlgorithmCore|BinaryBoard|hasLiveWay|func_death|ZHI_SI|algo_must|\.cpp$' | sort -u | head -60
done | tee strings-of-interest.txt
echo "== jadx (Java shell) -> jadx/"
jadx -q -d "$OUT/jadx" --no-res --deobf-min 3 "$APK" >/dev/null 2>&1 || echo "jadx finished with errors (common; continuing)"
echo "-- JNI bridges / ad callbacks:"
/usr/bin/grep -rhoE 'native [A-Za-z<>\[\] ]+ [A-Za-z_]*(Ecpm|ecpm|Native|native)[A-Za-z_]*\(' "$OUT/jadx/sources" 2>/dev/null | sort -u | head -30
/usr/bin/grep -rlE 'onUserRewarded|onAdRevenuePaid|MaxAdRevenueListener' "$OUT/jadx/sources" 2>/dev/null | head -10
echo "== done: $OUT"
