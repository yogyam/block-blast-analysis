#!/usr/bin/env bash
# Push (if needed) and start frida-server as a daemon on the connected rooted AVD.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/scripts/phase2/env.sh"
V="${FRIDA_VERSION:-17.26.2}"
BIN="$ROOT/data/raw/frida/frida-server-$V-android-arm64"
adb root >/dev/null 2>&1 || true; adb wait-for-device
if ! adb shell "test -x /data/local/tmp/frida-server" 2>/dev/null; then
  adb push "$BIN" /data/local/tmp/frida-server >/dev/null && adb shell chmod 755 /data/local/tmp/frida-server
fi
if [ -z "$(adb shell pgrep -f frida-server | tr -d '\r')" ]; then adb shell "/data/local/tmp/frida-server -D"; sleep 2; fi
echo "frida-server pid: $(adb shell pgrep -f frida-server | tr -d '\r' | tr '\n' ' ')"
frida-ps -U | head -3
