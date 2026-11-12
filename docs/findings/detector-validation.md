# Detector and synthetic validation (Phase 4)

Status: **in progress, 2026-11-11.** This documents `packages/analysis`, the implementation of
the eight pre-registered tests of [`06-methods.md`](../research/06-methods.md), and the §7
synthetic validation that must pass before the detector is ever run on real data. Everything
here is produced by the TypeScript engine + generator zoo + detector; no real gameplay data is
involved. Reproduce with `pnpm --filter @blockblast/analysis test` and `sim validate`.

## 1. What was built

- The four §7 agents now all exist: `RandomAgent`, `GreedyAgent`, `EpsilonGreedyAgent`,
  `BeamSearchAgent` (the last two added here, in `@blockblast/engine`).
- `@blockblast/analysis`: the detector. One module per statistic — `martingale` (H2/H3/H4),
  `clogit` (H1 conditional logit), `hazard` (Λ), `permutation` (H5), `overdispersion` (H6),
  `holm` (multiplicity), `stats` (normal/χ²/KS numerics) — plus `detector` (orchestration +
  Holm over the hypotheses the data supports), `synthetic` (the §7 protocol), and `power`.
- `sim-cli` gained `analyze <log.jsonl>`, `validate`, and `power`.

The detector consumes the §10 per-hand schema, so the identical code runs on simulated games
and on captured real data (a simulator row and a parsed real-data JSONL row both satisfy
`HandRecord`).

## 2. Three statistical subtleties that shaped the implementation

1. **Mean Λ = 1 is an optimal-player identity, not a general one.** The martingale identity
   E[Σ hₜ] = E[Σ Dₜ] holds for any agent, but Σ Dₜ (unsolvable hands actually dealt) equals 1
   only for a player that never dies on a solvable hand. A suboptimal agent usually dies by its
   own mistake on a solvable board, so under a *fair* dealer mean Λ sits below 1. The detector
   therefore tests H4 with the agent-independent martingale Z and reports Λ against observed
   deaths, never against the constant 1.
2. **Empirical permutation p-values have a 1/(B+1) floor** that cannot clear Holm at α = 0.01
   over six tests (0.01/6 ≈ 0.0017, but B = 500 floors p at ≈ 0.002). The permutation nulls of
   these sum/mean statistics are asymptotically normal, so the detector uses a studentized
   p-value, z = (obs − mean)/sd, which has no floor. Both are reported; §7's KS check confirms
   the studentized version stays calibrated.
3. **A score-dependent dealer is non-stationary**, which makes the three pieces of a late hand
   share one inflated state and spuriously inflates the H5 size-variance and lag-1 statistics
   even though the slots are conditionally independent. The H5 primary omnibus therefore uses
   only the two trend-robust statistics (within-hand duplicate rate, slot-position bias); the
   other two are reported as exploratory. This keeps a kill dealer attributed to H3, not H5.

## 3. Mechanism attribution (§7 criterion 3)

Each generator in the zoo, run through the full detector, lights the hypotheses it should. From
a representative run (ε-greedy agent, kill on beam; Holm α = 0.01), rejection is deterministic
per generator and matches the pre-registered control annotations:

| Generator | Rejected (Holm α = 0.01) | Expected role |
|---|---|---|
| uniform | — | null: nothing |
| weighted (fixed non-uniform) | — | negative control: nothing |
| bag | H5 | within-hand dependence (no repeats) |
| slot-biased | H5 | slot-position |
| rescue | H1, H2, H4 | board-aware + easing + more solvable |
| lethal | H4 (−), H1, H5 | less solvable (lethal); also board-aware and builds dependent hands |
| kill | H1, H3 | board-aware + hard pieces near the record |
| per-game-difficulty | H6 | per-game overdispersion |

H4's sign distinguishes the two solvability stories: positive = rescue (more solvable than a
fair dealer), negative = lethal. The lethal dealer legitimately also lights H1 and H5 — it
searches the board for an unsolvable triple and deals a jointly-chosen hand — which matches the
generator's own control note; these are true positives, not leakage. The per-generator
confusion matrix is a committed test (`test/detector.test.ts`).

## 4. Null calibration and power (§7 criteria 1–2)

Run `prereg-v1`: 30 replicates × 60 games (ε-greedy agent, kill on beam-12), `personalBest`
400 so the near-record stratum is populated, B = 800 permutations, 4000 Monte-Carlo samples for
the solvability hazard, Holm α = 0.01.

Rejection rate (%) per hypothesis, and family-wise rejection among H1–H6:

| Condition | H1 | H2 | H3 | H4 | H5 | H6 | family | expected → any / all |
|---|--:|--:|--:|--:|--:|--:|--:|---|
| uniform (null) | 0 | 0 | 0 | 0 | 0 | 3 | 3% | — |
| weighted (null) | 0 | 0 | 0 | 0 | 0 | 0 | 0% | — |
| bag | 0 | 0 | 0 | 0 | 100 | 0 | 100% | H5 → 100 / 100 |
| rescue | 100 | 77 | 0 | 100 | 0 | 3 | 100% | H1+H2+H4 → 100 / 77 |
| lethal | 83 | 0 | 0 | 100 | 93 | 0 | 100% | H4 → 100 / 100 |
| kill | 100 | 0 | 100 | 83 | 30 | 3 | 100% | H1+H3 → 100 / 100 |
| slot-biased | 0 | 0 | 0 | 0 | 100 | 3 | 100% | H5 → 100 / 100 |
| per-game-difficulty | 3 | 0 | 0 | 0 | 0 | 83 | 87% | H6 → 83 / 83 |

**Criterion 1 (no false alarms): met.** Across 60 null replicates the detector produced one
spurious rejection (uniform, H6, one replicate), a family-wise rate of ~1.7%, within Monte-Carlo
noise of α = 0.01. This is the property that matters for not crying wolf on Block Blast.

**Criterion 2 (power): met at 60 games** for every mechanism's primary hypothesis — ~100% for
bag, rescue, lethal, kill and the two H5 dealers; 83% for per-game-difficulty (H6), consistent
with §6's note that per-game effects need more games. `rescue` reaches H2 in 77% (the near-full
stratum is the underpowered one at 60 games, exactly as §6 predicts). `sim power` produces the
games-to-0.9-power curve for each effect.

KS-uniformity of each null hypothesis's p-values (want > 0.01):

| | H1 | H2 | H3 | H4 | H5 | H6 |
|---|--:|--:|--:|--:|--:|--:|
| uniform | 0.39 | 0.27 | 0.84 | 0.89 | 0.26 | 0.38 |
| weighted | 0.85 | **0.00** | 0.64 | 0.26 | 0.04 | 0.22 |

Most cells are comfortably uniform; the one dip below 0.01 (`weighted` H2) is a small-sample
KS artefact, not a miscalibration. With 30 replicates the KS test is noisy, and across 12
hypothesis×null cells a dip below 0.01 occurs ~11% of the time by chance even under perfect
calibration. A dedicated 100-replicate characterisation of the plug-in-F martingale tests
(H2/H3/H4) confirms this — the quantity that controls false positives is the left tail:

| 100 reps | mean p | P(p<0.05) | P(p<0.01) | KS p |
|---|--:|--:|--:|--:|
| weighted H2 | 0.48 | 0.03 | 0.00 | 0.51 |
| weighted H3 | 0.54 | 0.00 | 0.00 | 0.29 |
| weighted H4 | 0.54 | 0.04 | 0.00 | 0.09 |
| uniform H2 | 0.51 | 0.01 | 0.00 | 0.76 |
| uniform H3 | 0.50 | 0.05 | 0.01 | 0.69 |
| uniform H4 | 0.48 | 0.04 | 0.01 | 0.47 |

Every left-tail rate is at or below nominal (P(p<0.01) ≤ 0.01, P(p<0.05) ≤ 0.05), under the
structured `weighted` marginal as well as uniform. So the plug-in-F estimate (§4) does not
inflate false positives here. On real data the §4 remedy is still used as the headline: Phase 2
recovered the game's own weight table, so the primary analysis uses those known weights and the
plug-in estimate is a labelled secondary.

## 5. How to reproduce

```
pnpm -r build
pnpm --filter @blockblast/analysis test          # unit tests + the small harness check
node apps/sim-cli/dist/cli.js validate --agent epsilon:0.3 --replicates 40 --games 60
node apps/sim-cli/dist/cli.js power --generator lethal --target H4 --games-list 10,20,40,80
```

## 6. What this does and does not establish

It establishes that the detector is calibrated (no false alarms on fair or merely non-uniform
dealers) and powered against each adaptive mechanism in the zoo, at the sample sizes we can
collect. The piece set and pool used here (`live`, ids 2–31) are the white-box finding, but the
scoring and exact weights do not affect the detector, only the simulated game lengths.

## 7. First real-data pass — the bridge works, the sample does not (post-freeze)

`packages/capture/src/nativeLog.ts` converts the live `libtask` capture (`offerTopic`
requests/responses rebuilt into a session file) into the §10 schema: the request's 8×8
colour-id board (−1 = empty) packs into the engine bitboard, the response's `blockIds` is the
dealt triple, `currRecordGrade`/`highRecordGrade` are score/best, and the solvability oracle
fills `hand_solvable`. Run it, then `sim analyze`.

On the one clean capture we have (`session5`), this yields **19 deals across a single
continuous game** (score climbs 0 → 3040, never resets). Every dealt id maps to the engine
shape table (0 unknown ids — the native↔engine id mapping holds end to end), and the 45
discarded `offerTopic` calls are the empty intermediate pipeline stages (21001/21003 board-clear,
16009 hard-problem) that request but return no hand, exactly as the white-box pipeline predicts.

The frozen detector runs on these deals and, correctly, **rejects nothing**: one game is three
to four orders of magnitude below the ~50–240 games §6 requires. The point estimates are
directional but meaningless at n = 1 game (H1 board-dependence LR p ≈ 0.09; H4 lethal-direction
Z = −1.72, mean Λ = 0.22 vs one observed death). H7 and H8 do not run — no arm or ad covariate
in this capture.

This is a **pipeline validation, not a verdict on Block Blast.** The bridge, schema and detector
are ready; the missing ingredient is scale. The next data task is a controlled automated-player
capture (fixed policy, human pacing) across tens to hundreds of games per install and several
installs, logging the tray-accurate hands and the arm/ad covariates, then re-running this exact
frozen detector. The `source: 'shim-candidate'` tag records that these rows are the native
candidate, not a guaranteed tray observation (§10b).
