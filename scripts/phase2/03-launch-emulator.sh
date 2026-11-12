#!/usr/bin/env bash
# Phase 2 step 3: boot the AVD headless-capable, wait for boot, enable root, take a screenshot.
# Usage: scripts/phase2/03-launch-emulator.sh [AVD=bb34] [GPU=host]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/scripts/phase2/env.sh"
AVD="${1:-bb34}"; GPU="${2:-host}"
LOGDIR="$ROOT/data/raw/emulator"; mkdir -p "$LOGDIR"
if adb get-state >/dev/null 2>&1; then echo "a device is already connected: $(adb devices | sed -n 2p)"; else
  nohup emulator @"$AVD" -gpu "$GPU" -no-snapshot-load -memory 4096 -no-boot-anim -no-audio -no-window ${EXTRA_EMU_ARGS:-} \
    > "$LOGDIR/emulator-$AVD-$GPU.log" 2>&1 &
  echo "emulator pid $! (gpu=$GPU, headless). Log: $LOGDIR/emulator-$AVD-$GPU.log"
fi
adb wait-for-device
for i in $(seq 1 120); do
  if [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then break; fi; sleep 2
done
echo "boot_completed=$(adb shell getprop sys.boot_completed | tr -d '\r') after ~$((i*2))s"
adb root >/dev/null 2>&1 && sleep 2 && adb wait-for-device && echo "adb root: $(adb shell id | tr -d '\r')"
for p in ro.build.version.release ro.product.cpu.abi ro.build.flavor; do printf "%s=%s " "$p" "$(adb shell getprop $p | tr -d "\r")"; done; echo
adb exec-out screencap -p > "$LOGDIR/boot-$AVD.png" && echo "screenshot: $LOGDIR/boot-$AVD.png"
