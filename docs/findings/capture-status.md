# Scaled real-data capture — status and blockers (Phase 3)

Status: **paused 2026-11-12.** The capture *pipeline* is proven end to end; turning it into an
unattended multi-game harvester needs more robustness work than a quick task, so it is paused
deliberately. The detector it feeds is built, validated and frozen (`prereg-v1`); see
[detector-validation.md](detector-validation.md).

## What works (proven this session)

On a fresh emulator (`bb34`, Android 14, rooted) with the game spawned under the Frida logger:

- **Rendering.** The EGL config fix (`packages/capture/frida/gl-config-fallback.js`) makes the
  game render on the host GPU. It must be loaded through the **`frida` CLI**, not `spawn-ready.py`:
  Frida 17 unbundled the Java bridge, so `session.create_script(rawSource)` no longer exposes the
  `Java` global the fix needs, while the CLI still bundles it. Launch:
  `tail -f /dev/null | frida -U -f com.block.juggle -l <combined.js> -o <log>`. The combined script
  wraps `gl-config-fallback.js` and `libtask-json-log.js` each in its own IIFE (they share a
  top-level `const log`).
- **Deal logging.** `libtask-json-log.js` emits one `BBCALL {…}` line per native call;
  `offerTopic` lines carry the pre-deal board, `currRecordGrade`/`highRecordGrade`, the candidate
  `blockIds`, `blockPoses`, and `algoType`. Theme-independent and exact.
- **Automated play.** `sim-cli`-style `capture play` reads the board/tray by CV, the GreedyAgent
  chooses, and calibrated `motionevent` drags place pieces (finger model kx≈1.519, liftY≈−258).
  It placed 15 pieces cleanly in a row. The CV tray read and the native log independently agree on
  the dealt pieces on the default theme.
- **Ingest.** `packages/capture/src/nativeLog.ts` converts a captured session into the §10 schema,
  and `sim analyze` runs the frozen detector on it.

## The two blockers (why unattended scale is non-trivial)

1. **Board themes break the CV mid-game.** The board re-skins with progress (blue → pink by
   ~score 687). The board/tray reader's empty/fill colours and background probes are calibrated
   per theme, so a theme change reads as `screen: unexpected` and halts the greedy player. A
   robust player needs per-theme colour calibration (or a theme-agnostic cell classifier), plus a
   screen-state detector for the leave-confirm dialog, interstitial ads, and the game-over screen,
   and a restart action (Classic is one continuous game — you re-enter it, you do not start a new
   one until game over).
2. **The native candidate ≠ the dealt tray (§10b).** The script layer sometimes alters the native
   `offerTopic` candidate before putting pieces in the tray. Observed directly: the log's latest
   `offerTopic` was `[5,6,13]` while the tray on screen held different pieces. So driving play by
   the native `blockPoses` (the "suggested moves" shortcut, `drive-suggested.mjs`) is unreliable,
   and native candidate hands are not a faithful record of what was dealt. The analysis unit must
   be the **tray** hand (CV), with the native log joined as covariates.

## The sound path to resume

Make the CV board/tray reader theme-robust (calibrate the handful of board themes, or classify
cells by local contrast rather than absolute colour), add a small screen-state machine
(`play | leave-dialog | ad | game-over`) with the corresponding taps (dismiss, wait-out, restart),
then run the existing greedy `capture play` loop unattended across many games and several fresh
installs (clear app data between installs to sample the `bucketId`/`plan` assignment, §10c). Log
the CV tray hands (`source: cv`) and join the Frida `BBCALL` log by time as covariates
(`executed_algo`, `candidate_hand`, `candidate_used`, …). Then re-run the **frozen** detector with
the Phase-2 weight table as the known marginal F.

Restart recipe: `scripts/phase2/03-launch-emulator.sh bb34 host` → `04-start-frida.sh` → the
`frida` CLI launch above → tap **Classic** at (540, 1530) on the 1080×2400 home screen.

## Artifacts

- `packages/capture/src/nativeLog.ts` — native capture → §10 schema (committed, tested).
- `packages/capture/drive-suggested.mjs` — the suggested-move driver; kept as a reference but
  **superseded** by the §10b finding (native candidate ≠ tray). Not a valid capture method.
- `data/raw/network/combined-live.js` — the assembled EGL-fix + logger spawn script (gitignored).
