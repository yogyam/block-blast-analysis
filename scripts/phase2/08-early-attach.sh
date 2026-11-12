#!/usr/bin/env bash
# Launch the game paused at startup (debugger wait), attach Frida to the paused process, then release it via JDWP.
# Usage: scripts/phase2/08-early-attach.sh <frida-script.js> <log-file>
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; . "$ROOT/scripts/phase2/env.sh"
SCRIPT="$1"; LOG="$2"; PKG=com.block.juggle; ACT="$PKG/org.cocos2dx.javascript.AppActivity.Default"
pkill -f 'frida -U' 2>/dev/null; adb shell am force-stop $PKG; adb shell am set-debug-app -w $PKG
adb shell am start -n "$ACT" >/dev/null 2>&1
PID=""; for i in $(seq 1 40); do PID=$(adb shell pidof $PKG | tr -d '\r'); [ -n "$PID" ] && break; sleep 0.25; done
echo "paused pid: $PID"
nohup frida -U -p "$PID" -l "$SCRIPT" > "$LOG" 2>&1 & echo $! > "$ROOT/data/raw/emulator/frida-glfix.pid"
for i in $(seq 1 30); do grep -qE 'gl fix installed|\[glfix\] fallback installed' "$LOG" 2>/dev/null && break; sleep 0.5; done
echo "hooks after $((i/2)) s: $(grep -cE '\[glfix\]|\[unpin\]|\[jlog\]' "$LOG")"
adb forward tcp:8700 jdwp:$PID >/dev/null
# attach a JDWP client and quit: the debugger wait ends and the app continues
( printf 'quit\n' | "$JAVA_HOME/bin/jdb" -attach localhost:8700 >/dev/null 2>&1 ) ; sleep 1
adb forward --remove tcp:8700 >/dev/null 2>&1; adb shell am clear-debug-app >/dev/null 2>&1
echo "released; pid now: $(adb shell pidof $PKG | tr -d '\r')"
