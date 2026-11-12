# Methodology review (planning agent, 2026-11-09)

Critique of the draft plan's hypotheses, tests, power analysis, synthetic validation, and engine design. These corrections were adopted into the plan and belong in `06-methods.md`.

## A. Confounds, selection effects, valid conditioning

1. **Conditional test is valid with the right filtration and null.** Under H0 the hand H_t is independent of board B_t and everything before t, for any policy, because B_t is a function of H_1..H_{t-1} and the player's actions. Not valid: (a) a Poisson-binomial null treating p_t as fixed constants, (b) Monte Carlo conditioning on the whole board sequence (B_{t+1} nearly determines H_t). Fix: martingale framing. With I_t the indicator and p_t = P_F(I_t=1 | B_t), Z = sum_t (I_t - p_t) / sqrt(sum_t p_t (1 - p_t)) is asymptotically N(0,1) by the martingale CLT, including stopped games. Verify calibration in the simulator (p-values uniform under H0).

2. **H4 as "count unplayable hands" is degenerate** — N completed games yield exactly N unplayable hands. Reframe as cumulative hazard: h_t = 1 - q(B_t), q = exact H0 probability the hand is fully placeable in some order. Under H0 each game's Lambda_g = sum_{t<=T_g} h_t has mean 1 (discrete Exp(1) analogue). Rescue → mean Lambda > 1; kill → < 1. One-sample z on mean Lambda; QQ vs Exp(1). Abandoned games right-censored (Nelson-Aalen). Event = "not fully placeable in any order", a pure function of (board, hand).

3. **Which hypotheses need the fixed-policy agent.** H1-H5 valid with any policy (policy affects power only). H6/H7 are confounded by learning and board distribution if tested with unconditional statistics; use conditional statistics (Z, Lambda) and/or hold the policy constant. For H3, test streak and score *jointly* with board features in one model.

4. **Terminal-hand censoring.** If CV misses the final hand (game-over overlay), every surviving hand has I_t=1 by selection → spurious rescue. Capture at hand-appearance time; log final hand (`is_terminal`); revive = segment boundary (`segment_id`). Confirm via Frida *when* the hand is generated.

## B. Unknown marginals, test choice, multiplicity

5. **Primary test: conditional logit with piece fixed effects.** P(piece k at t) ∝ w_k · exp(beta · g_k(B_t)), g_k piece-specific board features (fits-anywhere, # legal placements, max lines clearable, completes a 7/8 line, size × fill). Alternative-specific constants w_k absorb the unknown marginal; LR test of beta = 0 (chi-square, df = # features) valid because the partial likelihood factorises over turns conditional on the past. Odds ratios with game-clustered SEs. Keep martingale Z as the explainable companion.

6. **Permutation tests.** Hand-only statistics (duplicates, size-sum variance, lag-k serial correlation) can use exact permutation by re-partitioning pooled pieces into triples. Board-conditional statistics cannot be shuffled within a game. Cross-game permutation for H1 is approximate; verify size synthetically.

7. **Multiplicity.** One primary test per hypothesis (8); Holm at family alpha 0.01; pre-registered directions. Per-piece/per-feature follow-ups exploratory, BH at q = 0.05.

## C. Sample size

8. 10 pp lift in P(some piece fits), near-full stratum (p0 ≈ 0.6-0.7), two-sided alpha 0.01, power 0.9: n ≈ (2.576·sqrt(0.24) + 1.282·sqrt(0.21))² / 0.01 ≈ 340 stratum-turns. 5 pp ≈ 1,350. 2 pp ≈ 8,500. 1 pp ≈ 34,000. A decent greedy agent visits near-full boards 3-10 turns/game → 340 stratum-turns ≈ 50-100 games; 8,500 ≈ 1,000-3,000 games. H4: mean Lambda 1.25 vs 1 → ~240 games; 1.10 → ~1,500. Human CV data (tens of games) detects only large effects. `sim-cli power`: R = 1,000 replicates per (generator, effect size, agent, G games) with the frozen tests at Holm-adjusted alpha → power curves + stratum-turns per 1,000 games per agent. A weak or epsilon-greedy agent multiplies power for rescue hypotheses.

## D. Synthetic validation and freezing

9. Add: (a) weighted and bag generators as *negative controls*; (b) weak effect sizes; (c) p-value uniformity under H0 (QQ) as pass criterion; (d) mechanism-attribution confusion matrix; (e) robustness to agent mismatch; (f) CV noise injection at measured cell-error rate. Mechanisms that evade the listed set: per-game difficulty from lifetime stats (→ Dirichlet-multinomial overdispersion test + H6); slot-position rules (→ slot tests); hole-shape targeting (→ richer features); rejection sampling on whole hands (→ H5 partially); server-side time variation (→ interleave installs over calendar time; log version and config snapshot).

10. **Freeze hygiene.** Tag a commit with analysis code, feature list, tests, alpha, exclusion rules, piece-set derivation rule, marginal-estimation rule. Post the hash publicly before any real log exists. Keep `data/real/` unreadable to the analysis package until the tag exists. Later work is exploratory.

## E. White-box confirmation

11. **Reproduce from the logged RNG stream, not the seed.** V8/JSC Math.random in Cocos is not seedable. Hook the RNG and log each output with call-site hash and call index; hook generator entry/exit and log (board, score, streak, internal DDA fields, bag, remote-config snapshot, app version) and output hand. Test the reimplementation as a deterministic map (inputs, RNG outputs) → hand. Stronger: a Frida *counterfactual* calling the generator at the same RNG state with a modified board (empty vs near-full), plus a patched-to-uniform run to measure effect on game length. Check airplane mode to rule out server-side generation.

## F. Engine and architecture

12. Avoid `bigint` in hot loops; two Uint32 words (rows 0-3, 4-7), precomputed (lo, hi) masks per piece per anchor; fit = `((b.lo & p.lo) | (b.hi & p.hi)) === 0`. `Generator` stateful: `{ next(state, rng), reset(), serializeState() }`. `Hand` ordered. `Agent.choose(board, remainingHand) → Placement`, one placement at a time; engine clears between placements. `GameDriver` (`SimDriver`, `AdbDriver`, `FridaDriver`) with `observe()`/`act()`; agent never touches adb. Greedy features for 1010!/Woodoku: lines cleared; hole count; # empty connected regions; perimeter/edge transitions; count of piece types still placeable (3x3, 1x5, 5x1); near-complete-line bonus; corner/wall preference. Beam width ~20 over orderings.

## G. What a skeptic attacks

13. Piece-set misspecification (derive from logs + decompiled table; pre-register). Marginal drift across versions/remote config (stratify by version/date). Emulator/root detection changing behaviour (validate marginals on a real phone subset). "Adaptive" vs "adversarial" conflation (report direction and net effect on game length, real vs patched-uniform). Effect sizes over p-values. Classic mode only, revives segmented. Legal framing; offer the developer a right of reply.
