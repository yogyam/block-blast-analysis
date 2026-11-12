#!/usr/bin/env bash
# Stepped drag for Cocos touch handling, one adb command per event (the batched form was not registered).
# Usage: drag.sh x1 y1 x2 y2 [steps=12] [snapshot_path]  — if snapshot_path is given, a screenshot is taken while held.
set -u
x1=$1; y1=$2; x2=$3; y2=$4; n=${5:-12}; snap=${6:-}
adb shell input motionevent DOWN "$x1" "$y1"
for i in $(seq 1 "$n"); do x=$(( x1 + (x2 - x1) * i / n )); y=$(( y1 + (y2 - y1) * i / n )); adb shell input motionevent MOVE "$x" "$y"; done
[ -n "$snap" ] && adb exec-out screencap -p > "$snap"
adb shell input motionevent MOVE "$x2" "$y2"
adb shell input motionevent UP "$x2" "$y2"
