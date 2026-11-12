/**
 * Screenshots from the emulator over adb, decoded into an RGB buffer.
 *
 * `adb exec-out screencap -p` writes a PNG to stdout; we decode it with pngjs. The same
 * decoder reads saved fixtures so the pure readers can be tested offline.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { PNG } from 'pngjs';

/** An RGB(A) raster. `data` is tightly packed RGBA, 4 bytes per pixel, row-major. */
export interface Screenshot {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** An RGB triple. */
export type Rgb = readonly [number, number, number];

/** Serial of the emulator we drive; adb commands target it explicitly. */
export const DEVICE_SERIAL = process.env['BB_DEVICE'] ?? 'emulator-5554';

/** 64 MB is plenty for a 1080x2400 PNG. */
const MAX_BUFFER = 64 * 1024 * 1024;

/** Run an adb command against the device and return stdout as a Buffer. */
export function adb(args: readonly string[], opts: { timeoutMs?: number } = {}): Buffer {
  return execFileSync('adb', ['-s', DEVICE_SERIAL, ...args], {
    maxBuffer: MAX_BUFFER,
    timeout: opts.timeoutMs ?? 20_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Decode a PNG buffer. */
export function decodePng(buf: Buffer): Screenshot {
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.byteLength) };
}

/** Read a PNG from disk (test fixtures, saved runs). */
export function loadPng(path: string): Screenshot {
  return decodePng(readFileSync(path));
}

/** Take a screenshot over adb. Optionally save the PNG bytes to `savePath`. */
export function screenshot(savePath?: string): Screenshot {
  const buf = adb(['exec-out', 'screencap', '-p'], { timeoutMs: 30_000 });
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50) {
    throw new Error(`screencap returned ${buf.length} bytes that are not a PNG`);
  }
  if (savePath !== undefined) {
    mkdirSync(dirname(savePath), { recursive: true });
    writeFileSync(savePath, buf);
  }
  return decodePng(buf);
}

/** Pixel at (x, y) as an RGB triple. Out-of-range coordinates are clamped. */
export function pixel(img: Screenshot, x: number, y: number): Rgb {
  const cx = Math.min(img.width - 1, Math.max(0, Math.round(x)));
  const cy = Math.min(img.height - 1, Math.max(0, Math.round(y)));
  const i = (cy * img.width + cx) * 4;
  return [img.data[i] ?? 0, img.data[i + 1] ?? 0, img.data[i + 2] ?? 0];
}

/** Manhattan (L1) distance between two colours. */
export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

/** max(channel) - min(channel): a cheap saturation measure. */
export function chroma(c: Rgb): number {
  return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
}

/** Mean colour of a list of samples (empty list → [0,0,0]). */
export function meanColor(samples: readonly Rgb[]): Rgb {
  if (samples.length === 0) return [0, 0, 0];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const s of samples) {
    r += s[0];
    g += s[1];
    b += s[2];
  }
  const n = samples.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Crop a rectangle out of a screenshot (used to keep fixtures small). */
export function crop(img: Screenshot, x0: number, y0: number, w: number, h: number): Screenshot {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const srcStart = ((y0 + y) * img.width + x0) * 4;
    out.set(img.data.subarray(srcStart, srcStart + w * 4), y * w * 4);
  }
  return { width: w, height: h, data: out };
}

/** Encode a screenshot back to PNG bytes. */
export function encodePng(img: Screenshot): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return PNG.sync.write(png);
}
