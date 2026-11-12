#!/usr/bin/env bash
# Phase 2 step 3: create an arm64 Google-APIs AVD on Apple Silicon.
# Idempotent. Requires: brew casks android-commandlinetools + android-platform-tools, a JDK on PATH.
# Usage: scripts/phase2/01-setup-emulator.sh [API_LEVEL]   (default 34)
set -euo pipefail
API="${1:-34}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$(brew --prefix)/share/android-commandlinetools}"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$PATH"
IMG="system-images;android-${API};google_apis;arm64-v8a"
AVD="bb${API}"

echo "SDK root: $ANDROID_SDK_ROOT"
yes | sdkmanager --licenses >/dev/null 2>&1 || true
sdkmanager --install "platform-tools" "emulator" "build-tools;34.0.0" "$IMG"
if ! avdmanager list avd | grep -q "Name: ${AVD}$"; then
  echo no | avdmanager create avd --name "$AVD" --package "$IMG" --device pixel_6 --force
fi
# Give the AVD more RAM and disk; keep hardware keyboard on for adb input.
CFG="$HOME/.android/avd/${AVD}.avd/config.ini"
if [ -f "$CFG" ]; then
  sed -i.bak -E 's/^hw\.ramSize=.*/hw.ramSize=4096/' "$CFG"
  grep -q '^hw.ramSize' "$CFG" || echo 'hw.ramSize=4096' >> "$CFG"
  grep -q '^disk.dataPartition.size' "$CFG" || echo 'disk.dataPartition.size=8G' >> "$CFG"
  grep -q '^hw.keyboard' "$CFG" || echo 'hw.keyboard=yes' >> "$CFG"
fi
echo "AVD ${AVD} ready. Launch with:"
echo "  emulator @${AVD} -gpu host -no-snapshot-load -memory 4096 -no-boot-anim   # try -gpu auto / swangle / software if the game does not draw"
