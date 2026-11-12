# 00 — Project brief

> **You aren't playing Block Blast. Block Blast is playing you.**

Status: draft for review, 2026-11-09. Hypotheses below are *proposed* pre-registrations; they are frozen only when tagged in git (see `06-methods.md`, "Freeze protocol").

## The question

*Block Blast!* deals you three pieces at a time. Everyone who plays it eventually suspects that the deal is not random: the piece you need never comes, the game eases up after a losing streak, and it stiffens just as you approach your record. Until October 2026 this was folklore. Then a developer, Ayo Omolewa, published a teardown reporting that the game ships hundreds of server-assigned behaviour "traits", an explicit "lethal puzzle" algorithm, and on-device models that predict when you will quit and how much your ad views are worth. Hungry Studio has not responded.

Nobody has independently replicated that work, nobody has measured how large the effects are from real play, and nobody has written it up for people who are not reverse engineers. That is this project.

## What we are building

1. **An independent replication.** Our own decrypt of the app, our own reading of the generator, our own logging of what it does, on our own installs.
2. **A measurement.** Real dealt hands, thousands of them, tested against what a fair dealer would do, with effect sizes rather than vibes.
3. **A method anyone can rerun.** A statistical detector for adaptive dealing that is validated on synthetic data from known generators *before* it sees the real game, and that needs no decryption to apply.
4. **The strategy chapter.** Given how the dealer actually behaves, what should a player do? What does an agent do?
5. **One interactive essay** that carries a general reader through all of the above, with a toy to poke at every step.

## Audience

Someone who plays Block Blast on the train and has never read a line of code. Everything technical appears first as a picture or a toy, then as a sentence, then (optionally) as math in an appendix. A statistician or game developer reading the appendix should find nothing to object to.

## Thesis, stated carefully

The game's piece generator is not a fixed random process. It conditions on the board and on the player's history, in ways selected by server-side experiments, and some of those ways are tuned to advertising value rather than to the player's enjoyment. We expect to find: easing when a player is struggling (keeps you playing), stiffening when a player is about to beat a record (manufactures a near-miss and a revive opportunity), and specific trigger conditions tied to ad history. We may also find that the default, untreated generator is close to fair. We will report whatever we find, including the parts that make the game look better than the folklore says.

## Positioning and credit

The Ayoships teardown is prior art and is credited prominently. We treat each of its claims as a hypothesis, not a fact. Where we replicate, we say so. Where we cannot, we say that too. A second source (unsupo/Block-Blast-Solver) claims far more but publishes no artifacts, its "extracted" scripts are still encrypted, and its entire history spans under two hours; only its catalogue of ~95 genuine bundled trait *filenames* survives as evidence (`02-rigged-discourse.md` §4). It is a lead, not a source.

## Pre-registered hypotheses (proposed)

**H0 (null).** Each offered piece is an independent draw from a fixed distribution over the piece set, independent of the board, score, streak, session, player, and time.

| ID | Hypothesis | Primary observable | Pre-registered direction |
|---|---|---|---|
| H1 | **Board-aware dealing.** Piece choice depends on the current board. | Conditional logit of piece identity on piece-specific board features (fits anywhere, legal placements, lines clearable, completes a near-full line). | Any dependence (two-sided). |
| H2 | **Rescue / easing.** On near-full boards, after fail streaks, and below personal best, pieces are easier than a fair dealer's. | Martingale Z on "some piece fits" and "hand fully placeable", in the near-full / post-fail / below-best strata. | Z > 0 (more playable than chance). |
| H3 | **Kill near the record.** Past ~93% of personal best, past best + 1000, and after fast play, hard pieces appear more often. | Odds ratio of hard pieces (3x3, 1x5, 5x1, big L) in the near-record stratum; Z on "fits" in that stratum. | OR > 1; Z < 0. |
| H4 | **Lethal hands.** Unsolvable hands are dealt more often than chance, especially ones where two pieces fit individually. | Martingale Z on the "hand unsolvable in every order" indicator; game-level cumulative hazard Λ vs mean 1. | Z < 0 overall or in near-record strata (more deaths than chance). |
| H5 | **Within-hand dependence.** The three pieces are not independent draws. | Exact permutation tests: duplicate rate, size-sum variance, lag-k serial correlation. | Any (two-sided). |
| H6 | **Lifecycle adaptivity.** First games after install, first game after a loss, and later sessions behave differently. | H1–H4 statistics stratified by game index, days since install, and loss history, with policy held constant by the agent. | Easing early and after losses; stiffening later. |
| H7 | **Remote A/B arms.** Generator behaviour depends on server-assigned traits. | Logged trait assignment; differences in H1–H4 statistics across installs and online vs airplane mode. | Any difference. |
| H8 | **Ad-value-driven timing.** Difficulty spikes and revive offers track predicted ad value and rewarded-ad history. | Event-level test of the stated triggers (3 rewarded ads, eCPM ≥ 3.5× previous, score ≥ best + 1000) against logged ad events and model outputs. | Triggers fire as stated. |

Thresholds quoted in H3 and H8 come from the prior teardown and are tested as stated; if our decrypt shows different constants, the pre-registration is amended *before* real data collection and the amendment is logged.

Evidence pointers from the research, per hypothesis: H1/H2, the teardown's rescue-type traits and the second source's unverified "cover rate" pool claims; H3/H4/H8, the teardown's named traits and constants (`02-rigged-discourse.md` §3); H5, the teardown's repeat-limit traits; H6, genuine bundled trait names such as `FirstEightGamesFixedBoardTrait`, `NewUserEarlyRoundsBoardTrait`, and `CTRefactorNewUserBlockPoolTrait` (`02-rigged-discourse.md` §4). The discourse's full list of testable claims, mapped to these IDs, is `02-rigged-discourse.md` §5. Scoring itself appears to be A/B-tested (`HighComboScoringRuleAdjustTrait`, `LimitComboScoreToTenTrait`); that matters for the strategy chapter, not for the detector.

The piece universe is better known than the scouting suggested: the teardown's evidence bundle contains the game's own decoded shape table, 51 regular shapes plus special-mode rectangles and disconnected shapes (`03-prior-art.md` §1.3). What remains unknown is which subset Classic mode deals and with what weights, which is exactly what our logs estimate.

## What we will not claim

- That any individual player's game was rigged. We measure populations of hands on our own installs.
- That the emulator population equals the real-player population. Trait assignment depends on device, country, and ad history; we report what our installs were assigned and treat it as a limitation.
- Anything about iOS from Android data, or about Adventure mode from Classic data.
- Intent beyond what the code and the company's own statements show.

## Ethics and publication rules

Publish: methods, aggregate statistics, effect sizes, short identifiers and snippets for commentary, hashes of the files analysed. Never publish: the decryption key, decrypted bundles, the APK, repack or bypass instructions. Request comment from Hungry Studio before publication and record the response or silence. See `05-tech-and-re-plan.md` for the legal framing.

## Phases

| Phase | Output | Gate |
|---|---|---|
| 1 Research (now) | `docs/research/` | Reviewed together; hypotheses frozen |
| 2 White-box | Engine, generator, traits, models read from the app; logging shim | Canonical piece set and scoring confirmed |
| 3 Black-box pipeline | Thousands of logged hands under controlled conditions | Detector validated synthetically *before* this data is analysed |
| 4 Simulator + analysis | TypeScript engine, generators, agents, detector, power curves | Synthetic validation passes |
| 5 Essay | Interactive essay with reproducible figures | Every figure regenerates from code |

## Open questions for the review

1. Are the eight hypotheses the right eight? Anything to drop or add before freezing?
2. Classic mode only, or also Adventure?
3. How many fresh installs (trait arms) are we willing to run? Each is hours of emulator time.
4. Do we want a real-device arm (used Pixel, ~$120) for a population check, or accept the emulator-only limitation?
5. Right of reply: how long a window do we give Hungry Studio before publishing?
6. Analysis universe: all 51 regular shapes from the decoded table, or only shapes observed in our logs (the rule proposed in `06-methods.md` §9)?
