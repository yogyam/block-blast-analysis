#!/usr/bin/env bash
# Reboot the AVD under different GPU backends until the Cocos GL surface initializes
# (no "No config chosen" from GLSurfaceView). Usage: 05-gpu-trial.sh swangle auto software host:window
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; . "$ROOT/scripts/phase2/env.sh"
AVD="${AVD:-bb34}"; PKG=com.block.juggle; ACT="$PKG/org.cocos2dx.javascript.AppActivity.Default"
for SPEC in "$@"; do
  GPU="${SPEC%%:*}"; WIN=""; [ "$SPEC" != "$GPU" ] || WIN="-no-window"
  echo "=== trial: -gpu $GPU ${WIN:-(windowed)}"
  adb emu kill >/dev/null 2>&1 || true; sleep 4; pkill -f "qemu-system-aarch64-headless|qemu-system-aarch64" >/dev/null 2>&1 || true; sleep 3
  nohup emulator @"$AVD" -gpu "$GPU" -no-snapshot-load -memory 4096 -no-boot-anim -no-audio $WIN ${EXTRA_EMU_ARGS:-} > "$ROOT/data/raw/emulator/emulator-$AVD-$GPU.log" 2>&1 &
  adb wait-for-device
  for i in $(seq 1 120); do [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break; sleep 2; done
  adb root >/dev/null 2>&1 || true; sleep 2; adb wait-for-device
  "$ROOT/scripts/phase2/04-start-frida.sh" >/dev/null 2>&1 || true
  adb logcat -c; adb shell am start -n "$ACT" >/dev/null 2>&1; sleep 40
  adb exec-out screencap -p > "$ROOT/data/raw/emulator/game-gpu-$GPU.png"
  NOCFG=$(adb logcat -d | /usr/bin/grep -c 'No config chosen')
  JS=$(adb logcat -d | /usr/bin/grep -ciE 'jswrapper|CocosScript|JS: |cocos2d: ')
  echo "GPU=$GPU no_config_chosen=$NOCFG cocos_js_log_lines=$JS pid=$(adb shell pidof $PKG | tr -d '\r') egl=$(adb shell getprop ro.hardware.egl | tr -d '\r')"
  adb logcat -d | /usr/bin/grep -iE 'GLThread|No config|cocos2d-x|jswrapper|CocosScript' | head -8
  if [ "$NOCFG" = "0" ] && [ -n "$(adb shell pidof $PKG | tr -d '\r')" ]; then echo "SUCCESS with -gpu $GPU"; exit 0; fi
done
echo "no GPU mode worked"; exit 1
