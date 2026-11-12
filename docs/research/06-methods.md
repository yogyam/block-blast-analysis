# 06 — Methods: detecting an adaptive dealer from the hands it deals

Status: draft for review, 2026-11-09. Incorporates a methodology review (`scouting/04-methodology-review.md`). The sections marked **FROZEN AT TAG** are the ones that get locked in a tagged commit before any real data exists.

## 1. Setting and notation

- A **board** B is an 8x8 occupancy grid. We store it as two 32-bit words (rows 0–3, rows 4–7).
- The **piece set** P is the finite set of shapes the game can deal, each orientation its own element (the game has no rotation). Its canonical contents are confirmed in Phase 2; see §9 for the derivation rule.
- A **hand** H = (h₁, h₂, h₃) is the ordered triple of pieces shown in the tray.
- A **turn** t is one dealt hand together with the board B_t at the moment of dealing, plus context: score, personal best, combo streak, time since the previous hand, session and install identifiers.
- A **game** is a sequence of turns ending in a terminal hand (no piece of the hand can be placed) or in abandonment. A revive starts a new **segment** within the same game.

**H0 (fair dealer).** Conditional on everything that happened before turn t, the three pieces of H_t are independent draws from one fixed distribution F over P.

F is unknown. It need not be uniform. H0 says only that it is *fixed* and *blind*.

## 2. Why conditioning on the board is legitimate for any player

The board B_t is a deterministic function of earlier hands and the player's earlier choices. Under H0, H_t is independent of the entire past, so it is independent of B_t, of the score, of the streak, and of the player's policy. That gives us a clean conditional test: for any function of (B_t, H_t) we can compute its distribution under H0 *given B_t exactly*, and compare to what was dealt.

This holds whether the player is a human, a bot, or a toddler. The policy affects only *which boards we visit*, and therefore the power of the test, not its validity.

Two things break this and are forbidden:

1. Treating the per-turn null probabilities p_t as fixed constants and using a Poisson-binomial. They are random (they depend on B_t), which is why we use a martingale normalisation (§3.1).
2. Conditioning on anything *after* the deal. The next board B_{t+1} nearly determines H_t. Any Monte Carlo that resamples a hand and then checks it against the board the player actually produced is invalid.

## 3. Primary statistics **FROZEN AT TAG**

One primary statistic per hypothesis. Everything else is exploratory.

### 3.1 Martingale Z (H2, H3, H4)

Let I_t be a 0/1 indicator computable from (B_t, H_t), for example "at least one piece of the hand fits somewhere", or "the hand can be fully placed in some order", or "the hand contains a 3x3". Let p_t = P_H0(I_t = 1 | B_t), computed exactly or by controlled Monte Carlo from F and the board (§4). Then

    Z = Σ_t (I_t − p_t) / sqrt( Σ_t p_t (1 − p_t) )

is asymptotically standard normal under H0 by the martingale central limit theorem. The sum may be restricted to a stratum (near-full boards, near-record turns, post-fail games) because stratum membership is decided *before* the deal from information in the past. Stopped games and censored games are fine for the same reason.

Sign convention: Z > 0 means the dealer gave more of the indicator than chance; for "fits" indicators that is rescue, for "unsolvable" indicators that is lethal dealing.

### 3.2 Conditional logit with piece fixed effects (H1, primary; H2/H3 companion)

For the piece in slot j of turn t, model

    P(piece = k | B_t) ∝ w_k · exp( β · g_k(B_t, context_t) )

where w_k is an alternative-specific constant for piece k (absorbing the unknown marginal F) and g_k is a vector of piece-specific features computed from the board and the pre-deal context:

- fits anywhere (0/1)
- number of legal placements (log1p)
- maximum lines clearable by one placement
- completes a line that is currently at 7 of 8
- piece size × board fill
- piece "hardness" class (3x3, 1x5, 5x1, big L) × score relative to personal best
- piece hardness × seconds since previous hand (for FastHandPunish)
- piece hardness × combo streak

Likelihood-ratio test of β = 0 (chi-square, degrees of freedom = number of features). The partial likelihood factorises over turns conditional on the past, so standard asymptotics apply; we report odds ratios with game-clustered standard errors. Because the w_k are free, this test does not require knowing F, and because features enter jointly, a "kill after streak" effect cannot be a relabelled board-fill effect.

### 3.3 Cumulative hazard and the game-level view (H4)

The naive test "count hands where nothing fits" is degenerate: every completed game ends in exactly one.

Instead let D_t = 1 if H_t is *not fully placeable in any order* on B_t (a pure function of board and hand, computable for every logged hand including the terminal one), and let h_t = P_H0(D_t = 1 | B_t) be the fair dealer's per-turn hazard. The martingale Z of §3.1 with I = D is the primary statistic. For the essay and as a diagnostic, each game's accumulated hazard

    Λ_g = Σ_{t in game g} h_t

has mean 1 under H0 for games played to a natural death (a discrete analogue of the Exp(1) identity for survival times). Games abandoned early are right-censored and handled with Nelson–Aalen. Mean Λ > 1 is rescue (players survive longer than their hazard predicts); mean Λ < 1 is lethal dealing.

Secondary (exploratory): the "looks playable" refinement from the teardown, D_t = 1 and at least two pieces fit individually.

### 3.4 Exact permutation tests on hand composition (H5)

Statistics that depend only on hands, not boards, can be tested by exact permutation: pool all dealt pieces and re-partition them at random into ordered triples.

- duplicate rate within hands
- variance of hand size-sum
- lag-k serial correlation of piece identity or size across consecutive hands within a game (bag detection; k = 1, 2, 3)
- slot-position effects: is the left slot systematically smaller than the right (hands are ordered)

Board-conditional statistics must *not* be permuted within a game; earlier hands built the board.

### 3.5 Overdispersion across games (H6 companion)

A dealer that sets a difficulty level once per game from lifetime statistics is invisible to per-turn tests. Dirichlet-multinomial test of per-game piece-frequency vectors against a common multinomial; report the overdispersion parameter.

### 3.6 Stratified comparisons (H6, H7)

Only the conditional statistics above (Z, conditional-logit odds ratios, Λ) are compared across sessions, installs, online vs airplane mode, or days since install. Unconditional quantities such as game length or mean piece size are confounded by learning and by board distribution and are not used for inference. Where possible the same fixed-policy agent plays every condition.

### 3.7 Event tests for stated triggers (H8)

Each stated trigger from the teardown (for example: three rewarded ads completed, loaded eCPM ≥ 3.5 × previous, score ≥ best + 1000) defines a pre-deal condition. We test the hard-piece odds ratio and the Z on "fits" in trigger-on vs trigger-off turns, matched on board fill. If the shim logs the algorithm id per deal, the direct test is simply whether the stated algorithm fires when and only when the condition holds.

## 4. Computing the fair dealer's probabilities

Everything in §3 needs p_t = P_H0(I_t = 1 | B_t) for the chosen indicator.

- **"Some piece fits."** Let S(B) ⊆ P be the pieces with at least one legal placement. p = 1 − (1 − F(S(B)))³. Exact and cheap.
- **"Hand contains a hard piece."** p = 1 − (1 − F(hard))³. Exact.
- **"Hand fully placeable in some order."** Requires a depth-3 search with clears between placements. A hand with *no* piece in S(B) is certainly unplaceable, so those multisets are skipped in bulk. A hand with some pieces outside S(B) can still be solvable, because a line cleared by an earlier placement can make room for a piece that did not fit at deal time (the engine's tests include such a case), so the search must run the full depth-3 enumeration with clears for every multiset that has at least one fitting piece. On near-full boards |S(B)| is small and the enumeration is exact (the engine switches to exact enumeration when |S(B)| is at or below a threshold, default 12). On sparse boards |S(B)| is large but the hazard is close to zero; there we use Monte Carlo with at least 20,000 hands and record the standard error alongside p_t. The synthetic validation (§7) checks that this estimation error does not inflate the false-positive rate.
- **Caching.** All quantities are keyed by (board, F-version); boards recur, especially early in games.

**The marginal F.** For Z and Λ we use the plug-in estimate: pooled frequencies of dealt pieces across the dataset being tested (**marginal-estimation rule, FROZEN AT TAG**). The conditional logit does not need F. Plug-in estimation slightly perturbs the null; §7 checks calibration under exactly this procedure. If Phase 2 recovers the real default weights, we add a second analysis with those weights, labelled as such.

## 5. Multiplicity and reporting **FROZEN AT TAG**

- Eight primary tests (one per hypothesis). Holm correction at family-wise α = 0.01. Pre-registered directions as in `00-brief.md` where a direction is stated; two-sided otherwise.
- Per-piece, per-feature, per-stratum follow-ups are exploratory. Benjamini–Hochberg at q = 0.05, labelled exploratory everywhere they appear.
- Report effect sizes with 99% confidence intervals: odds ratios, hazard ratios, differences in P(fits), mean Λ. P-values are secondary.
- Report direction *and* net effect: an "adaptive" dealer that only rescues is a different story from one that kills. The headline number for the essay is the change in expected game length under the real dealer vs the fair dealer with the same agent.

## 6. Sample size

Back-of-envelope for a two-sided test at α = 0.01 and power 0.9 on a difference in P(some piece fits) in a stratum where the fair probability is about 0.6–0.7:

| Effect | Stratum-turns needed |
|---|---|
| 10 percentage points | ~340 |
| 5 pp | ~1,350 |
| 2 pp | ~8,500 |
| 1 pp | ~34,000 |

For the game-level hazard: detecting mean Λ = 1.25 vs 1 needs ~240 completed games; 1.10 needs ~1,500.

A competent agent visits near-full boards for only 3–10 turns per game, so 340 stratum-turns is roughly 50–100 games and 8,500 is roughly 1,000–3,000 games. Human-played recordings (tens of games) will detect only large effects, and the essay must say so.

A deliberately weak or ε-greedy agent spends more turns on near-full boards and multiplies power for H2 and H4 while remaining valid (§2). We run both.

**Simulation-based power** (`sim-cli power`): for each (generator, effect size, agent, games) run 1,000 replicates, apply the frozen tests at the Holm-adjusted α, and output power curves and stratum-turns per 1,000 games per agent. These curves set the data-collection targets.

## 7. Synthetic validation protocol **FROZEN AT TAG**

The detector is applied to real data only after it passes this protocol on simulated data.

**Generator zoo** (`packages/generators`):

| Generator | Role |
|---|---|
| Uniform | null |
| Weighted (non-uniform, fixed) | negative control: must not trigger H1–H4 |
| Bag (7-bag-like, no repeats until exhausted) | negative control for H1–H4; positive control for H5 |
| GuaranteeOneFits | rejection-sample until some piece fits |
| GuaranteeSolvable | rejection-sample until the hand is fully placeable |
| Rescue(θ) | on boards above fill θ, bias toward pieces that fit |
| Kill(θ) | past θ of a notional personal best, bias toward hard pieces |
| Lethal(π) | with probability π, deal an unsolvable hand with two pieces that fit individually |
| PerGameDifficulty | choose weights once per game |
| SlotBiased | smaller pieces in the left slot |
| Mixture | combinations of the above at weak and strong settings |

**Agents:** Random, ε-Greedy, Greedy, BeamSearch. Tune nothing on the evaluation agents.

**Pass criteria:**

1. Under Uniform, Weighted, and Bag, each adaptivity test's p-values are uniform on [0,1] (QQ plot and Kolmogorov–Smirnov), and the family-wise false-positive rate at Holm α = 0.01 is ≤ 0.01 across 1,000 replicates.
2. Each adaptive generator is detected at the planned sample size with power ≥ 0.9 at its "strong" setting and the power at its "weak" setting is reported.
3. Mechanism attribution: a confusion matrix of generator → which hypotheses reject. Rescue-only should light H2 and H4 (Z > 0), not H3. Lethal should light H4 (Z < 0). Bag should light H5 only.
4. Agent mismatch: criteria 1–3 hold for every agent, including ones not used during development.
5. Noise: with board-reading errors injected at the measured per-cell error rate of the capture pipeline, criterion 1 still holds.
6. Estimation: with p_t computed by Monte Carlo where §4 allows, criterion 1 still holds.

## 8. Freeze protocol

Before any real log exists on disk:

1. Commit the analysis package, the feature list, the test implementations, α and q, the exclusion rules (§10), the piece-set derivation rule (§9), and the marginal-estimation rule (§4).
2. Tag it (`prereg-v1`) and publish the commit hash somewhere timestamped and public (a public repository or an OSF registration).
3. The real-data run invokes the tagged version. Anything run afterwards is exploratory and labelled.
4. Amendments before data collection are allowed and are themselves tagged (`prereg-v2`, with a changelog). Amendments after data collection are exploratory by definition.

`data/real/` is gitignored and unreadable to the analysis package until the tag exists (a guard in the loader checks for the tag).

## 9. Piece set and scoring derivation rule **FROZEN AT TAG**

The candidate universe is the game's own shape table, which the prior teardown's evidence bundle decoded from the 10.8.2 main script: ids 1–51 are regular shapes (id 41 duplicates 40 and the generator skips it), 101–111 are large rectangles presumably for special modes, 200–203 are disconnected shapes (`03-prior-art.md` §1.3). Phase 2 re-extracts this table from our own decrypt and diffs it. The analysis set P is the subset of the table observed at least once in our Classic-mode logs; shapes never dealt get weight zero under the plug-in F, which is the correct H0 treatment. Any shape observed in logs but absent from the table is a defect in our decoding and halts analysis until resolved. Scoring constants are taken from the app and verified against logged score deltas; they matter for the strategy chapter, not for the detector, and may themselves be A/B-tested (bundled trait names suggest so).

The reference solvability oracle (used for D_t and for q(B)) is our own TypeScript implementation, cross-checked on random boards and hands against a port of the teardown's `verify_unsolvable.py` (64-bit bitboard, simultaneous row/column clears, permutation search).

## 10. Data schema and exclusion rules **FROZEN AT TAG**

One JSONL row per dealt hand:

| Field | Type | Notes |
|---|---|---|
| install_id, session_id, game_id, segment_id | string | segment increments on revive |
| turn_idx | int | within segment |
| board_lo, board_hi | uint32 | rows 0–3, 4–7 at the moment of dealing |
| hand | [id, id, id] | slot order left to right |
| is_terminal | bool | no piece of this hand can be placed at deal time |
| pieces_placed | int | 0–3; most deaths in simulation happen mid-hand, after 1–2 placements, so this distinguishes a dead deal from a dead board |
| hand_solvable | bool | the oracle's verdict D_t (false in both death modes); computed, not observed |
| score, personal_best, combo_streak | int | pre-deal values |
| seconds_since_last_hand | float | |
| legal_moves_count | int | computed |
| chosen_placements | list | what the player did (for replay and agent eval) |
| lines_cleared | int | by this hand |
| revive_offered, revive_taken, ad_shown | bool | |
| ad_ecpm | float or null | from shim or network capture |
| algo_id, offer_type | string or null | from shim |
| trait_snapshot_hash | string | hash of assigned-trait list |
| app_version, device_profile, country, online | string/bool | |
| source | enum | shim, adb, cv |
| timestamp | ISO 8601 | |

Exclusions: Adventure-mode and Daily hands; hands with unreadable boards (cv source) are dropped and the drop rate reported; segments after a revive are kept but flagged, and the primary analysis runs on first segments only. Nothing else is excluded.

**Capture traps.** If the terminal hand is missed because a game-over overlay covers it, every surviving hand has "fits" = 1 by selection and H2/H4 show spurious rescue. The capture pipeline records at hand-appearance time and logs the terminal hand explicitly. We also confirm via instrumentation *when* the game generates the hand (at the previous hand's completion, or earlier); if earlier, B_t is the board at generation time, not at display time.

### 10b. What Phase 2 changed about the data (2026-11-10)

- The game's own request to its native generator is now logged per deal (`packages/capture/frida/libtask-json-log.js`). Its board encoding is an 8x8 array of **colour ids with −1 for empty**; the request also carries `currRecordGrade` (score), `highRecordGrade` (personal best), `mode`, `chapterNum`, `filterBlocks` (shapes removed from the pool), `lastBlockIds`, feature flags, and `algoList` (the algorithm the script asks for). The response carries the executed `algoType`, the candidate hand, the strategy's own name per slot, suggested positions, and the pool used.
- **Intent and outcome can differ.** The script layer sometimes alters the native candidate before dealing, deals on its own when the native side returns nothing, and, when several algorithms run in one deal, chooses among their outputs. Therefore the analysis unit remains the **dealt hand as observed in the tray**; the native log joins to it by time as covariates: `requested_algos`, `executed_algo`, `strategy_name`, `candidate_hand`, `candidate_used` (bool), `lethal_candidate_present` (bool, from algorithm 24001's output), `filter_blocks`, `pool_ids`.
- These covariates turn H3/H4 from inference into near-direct measurement: the rate at which the lethal search is *requested*, the rate at which it *finds* a hand, and the rate at which that hand is *dealt*, each as a function of score relative to personal best and board fill, can all be estimated. The pre-registered black-box tests stay as the method that needs none of this, so the essay can show both agree.
- Score is a double in the native interface; shapes are identified by the game's own ids (1–42 in native pools, with 41 excluded), matching the 51-entry table for ids 1–51.

### 10c. The assignment is observable (2026-11-10, evening)

The server's per-install experiment assignment (`game_init`: bucket, plan, four A/B memberships, 335 named feature flags with parameters) and the per-tier piece weight table plus session seed (`initData`) are both readable on the wire. H7 therefore changes from "infer arms from behaviour" to "record the arm and test behaviour conditional on it": every data file carries `bucketId`, `plan`, the experiment ids, and the subset of difficulty-related flags (`DeadlyToHard`, `FastNearTkxcClass`, `MultiClearBoostThenKill`, `RewardHighValueAdHarvest`, `MABXiBai`, `ConsecutiveLossRecovery`, `NewUserLevel`, …) as covariates. The install's maturity scores, which the client sends with the request, are covariates too. Fresh installs sample the assignment distribution; the pre-registration should state how many installs and that the arm is recorded before any play.

## 11. White-box confirmation

If Phase 2 yields a readable generator, the strongest confirmation is to reimplement it in `packages/generators` and reproduce logged hands exactly. V8/JavaScriptCore `Math.random` is not seedable, so we log the RNG *stream* (each output with call index) alongside each deal and test the reimplementation as a deterministic map (board, context, RNG outputs) → hand. A Frida counterfactual, calling the real generator at the same RNG state with a swapped board, demonstrates board-dependence in one picture. A patched-to-uniform run measures the effect on game length directly.

## 12. Threats to validity, stated up front

- **Population.** Our installs run in an emulator with a chosen device profile and no organic ad history; trait assignment may differ from real players. We log and report assigned traits; a real-device arm is the mitigation if budget allows.
- **Drift.** Remote configuration can change between sessions; we log app version and trait snapshot per hand and stratify.
- **Piece-set misspecification.** Handled by §9.
- **Bot behaviour as treatment.** A fast bot may trigger speed-based traits; the agent paces itself to human speed and we vary pacing deliberately as a factor.
- **Detection of the emulator or root.** We cannot rule out behaviour changes; we compare marginals against a real device if available and against human screen-recorded play.
- **Adaptive vs adversarial.** We report direction and net effect on game length, not just "non-random".
