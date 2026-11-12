#!/usr/bin/env bash
# Network capture: relaunch the AVD routed through a local mitmproxy, install the CA, spawn the game under the GL fix + unpinning.
# Usage: scripts/phase2/07-capture-network.sh   (then interact / run the player; flows land in data/raw/network/)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; . "$ROOT/scripts/phase2/env.sh"
OUT="$ROOT/data/raw/network"; mkdir -p "$OUT"; TS=$(date +%Y%m%d-%H%M%S)
pkill -f 'frida -U' 2>/dev/null || true; adb emu kill >/dev/null 2>&1 || true; sleep 4; pkill -f qemu-system-aarch64 2>/dev/null || true; sleep 2
pkill -f 'mitmdump' 2>/dev/null || true
nohup mitmdump -q --listen-host 127.0.0.1 --listen-port 8080 --set stream_large_bodies=5m -w "$OUT/flows-$TS.mitm" > "$OUT/mitmdump-$TS.log" 2>&1 &
echo "mitmdump pid $! -> $OUT/flows-$TS.mitm"
EXTRA_EMU_ARGS="-http-proxy http://127.0.0.1:8080" "$ROOT/scripts/phase2/03-launch-emulator.sh" bb34 host | tail -2
"$ROOT/scripts/phase2/06-install-ca-android14.sh" "$(ls "$OUT"/*.0 | head -1)" | tail -2
"$ROOT/scripts/phase2/04-start-frida.sh" >/dev/null 2>&1 || true
{ for f in gl-config-fallback.js unpin.js libtask-json-log.js; do echo "(function(){"; cat "$ROOT/packages/capture/frida/$f"; echo; echo "})();"; done; } > "$OUT/combined-$TS.js"
nohup python3 "$ROOT/scripts/phase2/spawn-ready.py" "$OUT/combined-$TS.js" "$OUT/frida-$TS.log" > /dev/null 2>&1 & echo $! > "$ROOT/data/raw/emulator/frida-glfix.pid"
sleep 30; echo "game pid: $(adb shell pidof com.block.juggle | tr -d '\r')"; echo "flows so far: $(grep -c . "$OUT/mitmdump-$TS.log" 2>/dev/null || echo 0) log lines"
