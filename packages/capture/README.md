# @blockblast/capture

Drives the real *Block Blast!* (`com.block.juggle` 10.9.8) in the Android emulator over adb, so we
can log the hands the live generator deals. Screenshot → read board and tray → engine's
`GreedyAgent` picks one placement → calibrated drag → verify → one JSONL record per placement.

```
src/
  screen.ts        adb screencap → RGBA (pngjs); pixel helpers
  geometry.ts      measured screen constants (board frame, tray slots, colours)
  boardReader.ts   8x8 occupancy (5 samples per cell vs a refined empty colour) + play-screen check
  trayReader.ts    tray blobs → cell grid → mask → exact shape-id match (unknown masks reported)
  drag.ts          finger model, persistent calibration, motion-event drag, verified placement
  player.ts        the loop, deal detection, JSONL records
  cli.ts           play | read | calibration
frida/             Frida scripts (GL config fix, libtask trace, script dump) from Phase 2
napi-harness/      loading libtask.so standalone under Termux Node
test/              vitest: fixtures (real screenshots), synthetic screens, the maths
```

## Running

```sh
. scripts/phase2/env.sh                                   # adb on PATH
pnpm install
pnpm --filter @blockblast/capture play -- --n 20          # 20 placements (default), human-speed pacing
pnpm --filter @blockblast/capture play -- read            # print board + tray from a live screenshot
pnpm --filter @blockblast/capture play -- read some.png   # ... or from a file
pnpm --filter @blockblast/capture play -- calibration     # show the finger model and recorded landings
pnpm --filter @blockblast/capture test                    # vitest (offline)
pnpm --filter @blockblast/capture typecheck
```

Flags: `--n <placements>` (default 20), `--out <dir>` (default `data/real/adb-player`),
`--settle <ms>` (wait after a drop, default 1500), `--pool default|1010` (the pool the greedy
agent assumes for its "still placeable" feature). The device is `emulator-5554` unless
`BB_DEVICE` is set. Node 22 runs the TypeScript directly (`--experimental-strip-types`).

Preconditions the player does **not** manage: the emulator is booted, the game is in the
foreground on the normal play screen (`adb shell am start -n
com.block.juggle/org.cocos2dx.javascript.AppActivity.Default` brings it back), and whatever Frida
instrumentation you want is already attached. The player never taps anything but the drag: on a
dialog, ad, game-over or revive screen it saves a screenshot, writes a `stop` record and exits.

## Output

`data/real/adb-player/<run>.jsonl`, one JSON object per line:

- `deal` – written whenever all three slots are (re)filled: `hand` (ids per slot, `null` for an
  unrecognised piece, whose mask is in `masks`), `board`, `screenshot`. The first read of a run
  is `initial: true` even if the hand is mid-way through being played.
- `placement` – `boardBefore` (64-char notation + `lo`/`hi`), `hand` (slot ids, `null` for empty),
  `chosen` (slot, shapeId, row, col = top-left anchor), `actual` (where it landed), `attempts`
  (finger position, offset and outcome per try), `boardAfterExpected` (engine simulation),
  `boardAfter` (observed), `linesClearedExpected` / `linesClearedObserved`, `boardMatchesExpected`,
  `trayAfter`, `dealt` (this placement emptied the tray and a refill arrived), the finger `model`
  used, and the before/after screenshot paths.
- `stop` – reason, final screenshot, run summary.

Screenshots go to `<run>-shots/`, the final one to `<run>-final.png`; `calibration.json` in the
same directory persists the finger model and every observed landing.

## Geometry and calibration (1080x2400, `-gpu host`)

| Item | Value |
| --- | --- |
| Board frame | x 58–1022, y 575–1540; pitch 120.5 px |
| Empty cell colour | (35, 43, 84); refined per screenshot from samples within L1 45 of it |
| Page background | (59, 83, 148); six probe points must match for the "play screen" check |
| Tray window | y 1690–1950; slot windows x 60–385, 385–695, 695–1020 |
| Tray piece centres | x ≈ 225.5 / 540.5 / 854.5, y ≈ 1818.5 (pieces are centred in their slot) |
| Tray cell pitch | 53.6 px (a 2x2 is 108 px, a 3-bar 160 px) |

**Finger model** (`drag.ts`). The lifted piece is drawn at board scale and moves faster than the
finger, isotropically, about the pickup point:

```
piece_x = pickup_x + 1.515 · (finger_x − pickup_x)
piece_y = pickup_y + 1.515 · (finger_y − pickup_y) − 259
```

The y part is the Phase-2 fit (piece_y ≈ 1.515·finger_y − 1191 for a pickup at y ≈ 1815). The x
gain was measured with a held piece: dragging the slot-2 bar to finger (555, 1300) drew it centred
at (404, 772); the model predicts (401, 777) (a `piece_x = finger_x` model would predict 555).
Because the gain is applied about the pickup point, always press on the blob centre of the slot.
The target for a placement is the centre of the shape's bounding box on the board; the game snaps
within about half a cell, so the budget is roughly ±40 finger px.

After every verified landing the actual cell centre is recorded and both axes are refitted by least
squares (slope only when the data spans ≥150 px and stays within 20 % of the prior; otherwise just
the intercept). On a miss (board unchanged, piece back in the tray) the drop is retried with nudges
of (0,+25), (0,−25), (+25,0), (−25,0) finger px, up to three retries.

Drag mechanics: `adb shell input swipe` is ignored by this Cocos build; one
`adb shell input motionevent` per event works: DOWN at the blob centre, a 5 px MOVE to register the
pickup, 10 MOVEs to the destination, a 150 ms settle, UP. The verification waits 1.5 s, then reads
until two consecutive board reads agree.

First live sessions (2026-11-10, runs `2026-11-10T21-49-18-145Z` and `2026-11-10T21-50-37-965Z`):
15/15 placements landed on the first attempt with the model above, every observed board equalled
the engine's prediction, and the five line clears were observed as predicted. Caveat: the greedy
agent's scan-order tie-breaking put every drop on rows 0–1, so the vertical model below row 2
rests on the single Phase-2 drop (rows 3–4) and the held-piece measurement (y ≈ 772). The refit
after 15 landings is kx = 1.519, liftX = −0.6, ky = 1.515, liftY = −258.4.

## Known limitations

- Geometry is hard-coded for this emulator profile. Another resolution, a theme change or a
  layout A/B arm needs new constants (start from `read` on a screenshot).
- The tray reader assumes pieces are drawn with their bounding box centred in the slot and
  ≈53.6 px per cell. Greyed-out pieces (no legal placement) are still blobs; a piece mid-animation
  can be misread, which is why reads are repeated until stable.
- The board reader samples five fixed points per cell; a piece ghost/preview, a combo banner or
  clear particles crossing those points could flip a cell. The post-drop read is compared against
  the engine's prediction, and a change no placement explains stops the run.
- Unknown masks are logged, not guessed; if only unknown pieces remain, the run stops.
- The agent is the engine's one-step greedy; it plays to keep the game alive, not to score.
- The player cannot recover from a game over, ad, dialog or revive prompt and does not try; it also
  does not read the score.
- Vertical finger positions for row 7 from the tray are only ~55 px above the pickup; a lift
  constant drift of more than ~40 px would make bottom-row drops miss first (retries cover ±25).
