# Research summary (Phase 1) — for review

Date: 2026-11-09. Eight documents, one bibliography (217 unique URLs), four raw scouting notes. Claims are tagged [C] confirmed / [R] reported / [S] speculative inside each document; this page gives the shape of what we know and what we must decide.

## What is established

- **The game.** 8x8 board, three pieces per hand in a fixed slot order, no rotation, refill only after all three are placed, rows and columns clear, no gravity, game over when no remaining piece fits. Classic, Adventure, and Daily modes. Monetized almost entirely by ads: banner, interstitial after every game over, one rewarded revive per run, plus conditional extras. [C] (`01` §4, §7)
- **Scale.** Roughly 870M lifetime downloads, the most-downloaded mobile game of 2025, official 70M daily / 300M monthly actives in Jan 2026, ad revenue on the order of $1M per day; lifetime in-app purchases negligible. iOS carries an "Infrequent: Simulated Gambling" descriptor. An ad-free Apple Arcade build exists. [C/R] (`01` §3, §8)
- **The company says it adapts difficulty.** Its own awards submission: A/B tests "customize difficulty levels"; "Block AI Robot ... analyzing player behavior in real-time to create an adaptive experience." 10,000+ A/B tests in 2025. It has never commented on randomness and did not answer any outlet covering the October 2026 teardown. [C] (`02` §2)
- **Engine and architecture (per the teardown, unreplicated).** Cocos Creator with XXTEA-encrypted JavaScript; ~700 server-assigned behaviour "traits"; a named "lethal puzzle" generator that deals hands with two individually placeable pieces and no completing order; on-device XGBoost and LightGBM models for difficulty, ad value, and churn; triggers tied to rewarded-ad history and score relative to personal best. The author published evidence bundles and verification scripts and withheld the key. [R] (`02` §3)
- **The piece universe.** The teardown's bundle contains the game's own decoded shape table: 51 regular shapes (one duplicate the generator skips), plus special-mode rectangles and disconnected shapes. Which subset Classic deals, and with what weights, is unknown. [C for the table; the Classic pool is open] (`03` §1.3)
- **The second source is weak.** unsupo/Block-Blast-Solver: no artifacts, "extracted" scripts still encrypted, under two hours of history, internal contradictions. Only its ~95 genuine bundled trait filenames count as evidence; they independently suggest new-user easing and A/B-tested scoring. [C about the weakness] (`02` §4)
- **Reusable prior art.** A reference solvability oracle (the teardown's `verify_unsolvable.py`), two complete computer-vision board-reading recipes with thresholds, several board-aware "helping" generators to use as synthetic mechanisms, a 19-piece benchmark with agent baselines, and a strong n-tuple agent for a sibling game. No published dataset of dealt hands exists for any game in this family. (`03`)
- **The literature predicts exactly this.** Dynamic difficulty adjustment dates to 2004; EA's 2018 patent ties per-user churn prediction to difficulty "knobs" including random seeds, "undetectable to the user"; a 2025 industrial-organization paper estimates personalized difficulty could raise revenue by 71%; near-miss psychology explains why a loss just short of a record keeps people playing. No patents are assigned to Hungry Studio or Aretis. (`04`)
- **The toolchain is clear and costs nothing.** This Mac (arm64, 24 GB) has Java, Node, pnpm, Python; it lacks every Android tool. The runbook pins versions for the SDK, emulator image (arm64 Google APIs, API 33–35), jadx, Ghidra, Frida, scrcpy, HTTP Toolkit, and gives the decrypt and shim path specific to Cocos Creator 3.x. (`05`)

## What we are proposing

- **Eight pre-registered hypotheses** (`00` table), with primary statistics that are valid for any player because they condition on the board at deal time: a martingale Z, a conditional logit with per-piece fixed effects, a cumulative-hazard view for lethal dealing, exact permutation tests for within-hand structure, an overdispersion test for per-game difficulty, and stratified comparisons for lifecycle and A/B effects. Holm at family α = 0.01; everything else exploratory. (`06` §3–5)
- **Synthetic validation before real data.** A generator zoo (fair, weighted, bag, rescue, kill, lethal, per-game, slot-biased, mixtures) and pass criteria including p-value uniformity under fair dealers and a mechanism-attribution confusion matrix. (`06` §7)
- **Sample sizes.** Roughly 50–100 games to detect a 10-point rescue effect on near-full boards; 1,000–3,000 games for a 2-point effect; ~240 games for a 25% hazard distortion. A deliberately weak agent multiplies power. (`06` §6)
- **A freeze.** Tag the analysis before any real log exists; publish the hash; anything after is exploratory. (`06` §8)
- **An essay in eight sections**, each with one interactive and a mandatory "what we did not find" section. (`07`)

## Decisions needed from you

1. Freeze the eight hypotheses as written, or amend first?
2. Classic mode only? (Proposed: yes.)
3. How many fresh emulator installs (trait arms) to run? Each is hours of unattended play. (Proposed: start with three.)
4. Real-device arm for a population check (used Pixel 6a, roughly $120), or accept the emulator-only limitation? (Proposed: defer until the emulator population is characterised.)
5. Right-of-reply window for Hungry Studio before publishing. (Proposed: 14 days.)
6. Analysis universe: shapes observed in our logs (proposed) or all 51 regular shapes?

## Biggest risks

- The emulator may not render the game, or may be assigned to an unrepresentative trait arm. Mitigations in `05` §10.
- The generator may live in native code rather than JavaScript, changing the instrumentation route.
- Everything about internals rests on one unreplicated teardown until Phase 2.

## Next

On your go-ahead: Phase 2 (APK, emulator, decrypt, locate generator, logging shim) and the engine package in parallel. Estimated one weekend to one week to first logged hands.
