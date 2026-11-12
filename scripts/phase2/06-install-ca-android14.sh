#!/usr/bin/env bash
# Install the mitmproxy CA as a system trust anchor on a rooted Android 14 AVD, idempotently.
# Android 14 serves system CAs from the Conscrypt APEX (read-only), so we build a tmpfs copy with the extra cert and
# bind it over the APEX path in the zygote namespaces only (once each); apps forked afterwards inherit it.
# Usage: scripts/phase2/06-install-ca-android14.sh data/raw/network/<hash>.0
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; . "$ROOT/scripts/phase2/env.sh"
CERT="$1"; NAME="$(basename "$CERT")"
adb root >/dev/null 2>&1 || true; adb wait-for-device
adb push "$CERT" /data/local/tmp/"$NAME" >/dev/null
adb shell "set -e
  if ! mount | grep -q ' /system/etc/security/cacerts type tmpfs'; then
    mkdir -p -m 700 /data/local/tmp/cacerts
    cp /apex/com.android.conscrypt/cacerts/* /data/local/tmp/cacerts/ 2>/dev/null || true
    cp /data/local/tmp/$NAME /data/local/tmp/cacerts/$NAME
    mount -t tmpfs tmpfs /system/etc/security/cacerts
    cp /data/local/tmp/cacerts/* /system/etc/security/cacerts/
    chown root:root /system/etc/security/cacerts/*; chmod 644 /system/etc/security/cacerts/*
    chcon u:object_r:system_security_cacerts_file:s0 /system/etc/security/cacerts/* 2>/dev/null || true
  fi
  for z in zygote64 zygote; do
    pid=\$(pidof \$z 2>/dev/null | cut -d' ' -f1); [ -z \"\$pid\" ] && continue
    if ! nsenter --mount=/proc/\$pid/ns/mnt -- grep -q \"$NAME\" /apex/com.android.conscrypt/cacerts/ -r -l 2>/dev/null && ! nsenter --mount=/proc/\$pid/ns/mnt -- ls /apex/com.android.conscrypt/cacerts/$NAME >/dev/null 2>&1; then
      nsenter --mount=/proc/\$pid/ns/mnt -- mount --bind /system/etc/security/cacerts /apex/com.android.conscrypt/cacerts
    fi
    echo \"\$z (\$pid): mounts mentioning cacerts = \$(grep -c cacerts /proc/\$pid/mounts), cert present = \$(nsenter --mount=/proc/\$pid/ns/mnt -- ls /apex/com.android.conscrypt/cacerts/ | grep -c $NAME)\"
  done"
echo "CA $NAME installed for new app processes (overlay is lost on reboot; rerun after each boot)"
