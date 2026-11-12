# findings

- [`whitebox.md`](whitebox.md) — Phase 2 white-box results: the native generator `libtask.so`,
  the standalone harness, the live per-deal logger, counterfactuals, and the (decoded) server
  side.
- [`libtask-decompiled.md`](libtask-decompiled.md) — the Ghidra read of `libtask.so`.
- [`phase2-log.md`](phase2-log.md) — the Phase 2 lab notebook (dated evidence trail).
- [`detector-validation.md`](detector-validation.md) — Phase 4: the detector (`packages/analysis`)
  and its synthetic validation against the generator zoo, the check that must pass before the
  method is run on real data, plus the first real-data pass.
- [`capture-status.md`](capture-status.md) — Phase 3: the scaled live-capture pipeline (proven
  working end to end) and the two blockers that pause it (board themes break the CV reader; the
  native `offerTopic` candidate can differ from the dealt tray).

Black-box results at scale on real captured gameplay are not here yet; they come after the scaled
capture is built out, run against the frozen method.
