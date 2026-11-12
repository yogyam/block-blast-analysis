# 02 · The "rigged" discourse: players, developer, and the two teardowns

Research-phase document, written 2026-11-09. Tags per `README.md`: **[C]** confirmed, **[R]** reported, **[S]** speculative. Quotes are verbatim from the fetched page unless marked paraphrase.

**Access note.** `reddit.com` (including `old.reddit.com`) is blocked for our crawler and excluded from our search tool, so no Reddit thread was read directly. Reddit-origin claims below come through secondary pages and are tagged [S]. TikTok videos cited by the scout were not fetched.

## 1. What players claim

The best accessible corpus is App Store reviews mirrored at https://justuseapp.com/en/app/1617391485/block-blast/reviews (undated). A review-sampling page, https://glotier.com/games/block-blast (July 2026), found **40%** of negative reviews allege the "piece feed feels rigged to force a loss" and **73%** complain of "too many or forced ads"; its denominators are inconsistent (13 vs 30), so indicative only [S].

| # | Hypothesis | Representative quotes | Where | Tag |
|---|---|---|---|---|
| H1 | **Board-aware dealing** (pieces chosen from the board state, not random) | "these 'randomly' generated pieces are not random, but chose by how your board looks and how filled it is." (Q.burna) · "they will give you the most absurd blocks that have no place on your board." (Queen Block Blaster) · "it seems like I'm always given the 'T', 'U' and '+' pieces when I have nowhere to put them." (Justmia03) | justuseapp | [S] |
| H2 | **A wall just past personal best / a score threshold** | "the devs purposely rig the game once you get past like 2500 points" (Glu3_Eat3r) · "the difficulty ramps from 0 to 100 as soon as you hit about 2000 points" (WoLvErInE199A) · "The moment you reach around 2,500 points the game changes dramatically" (glotier excerpt) · players "receive difficult pieces when they're close to breaking their record" | justuseapp; glotier; https://blockblastsolverss.com/is-block-blast-rigged/ | [S] |
| H3 | **"God mode" after a losing streak** | "losing multiple times activates a 'God Mode' that drops ideal pieces" (Michael Khripin, Balancy, Mar 2025) · "Actually, loose streak results in activating 'god mode' when the game just drops pieces the player needs." (Khripin, Gamigion, Apr 1 [2025]) · "It creates a wow effect, but ultimately diminishes the fact that these multiple games were actually lost." | https://balancy.co/blog/2025/03/26/how-could-block-blast-by-hungry-studio-earn-more-monetization-and-gameplay-deconstruction/ ; https://www.gamigion.com/take-aways-from-playing-block-blast/ | [R: two write-ups, same author] |
| H4 | **Generous openings** (easy first games / pre-arranged start boards) | No direct player quote found. Nearest: "Now when I restart there are random blocks already placed, so I lose fast on a low score" (glotier); a guide says "new games start with simpler shapes" (Playgama). Bundled APK trait filenames (`FirstEightGamesFixedBoardTrait`, `NewUserEarlyRoundsBoardTrait`, `IsOpenClassNewUserDefaultBoardTrait`, `CTRefactorNewUserBlockPoolTrait`, `SlowPacedUserInitBoardTrait`) make the hypothesis concrete | glotier; https://playgama.com/blog/game-faqs/how-do-you-enable-easy-mode-on-block-blast/ ; https://api.github.com/repos/unsupo/Block-Blast-Solver/git/trees/main?recursive=1 | [S] |
| H5 | **Android easier than iOS** (or vice versa) | One player "scored over 4.1 million points on Android" but "struggled to break 30,000 points on iPhone" | blockblastsolverss (secondhand, unnamed) | [S] |
| H6 | **Older build "7.6.3" was fairer** | A Reddit user said 7.6.3 "generated playable pieces nearly all the time" and reached "over a million points"; after updating they were "struggling to reach 30,000 points" · "Please return it back to how it was before the last update!!!!!!" and "the game algorithm now gives you pieces that are impossible to use." (Da Irish Jdawg) | blockblastsolverss (no thread URL); justuseapp | [S]. We could not confirm a 7.6.3 build exists on either platform (see `01-game-facts.md` §2) |
| H7 | **Repeated pieces / only big pieces** | "the game will [give] you the exact same piece over and over and over again in a row." (TheSachafromLA) · "They immediately give you all the biggest blocks but none of the small ones" (Glu3_Eat3r) | justuseapp | [S] |
| H8 | **Ad timing is the motive** | "there's an incentive for the AI to only let you get so far unless you watch their ads." (Gmeister7) · "There's an ad after every game, and even if I say no to reviving it gives me an ad regardless." (glotier excerpt) | justuseapp; glotier | [S] |

Skeptical voices are weak: solver-SEO pages say "there is no proven evidence that Block Blast is rigged" (blockblastsolverss; https://smartblockblastsolver.com/blogs/block-blast-faq) [S]; one HN commenter: "I play block blast classic mode with adguard and don't see any ads" (noisy_boy, https://news.ycombinator.com/item?id=50217946).

## 2. What the developer has said

Hungry Studio has **never commented on randomness or piece generation**. Its public statements are about experimentation and "adaptive" experience, in marketing register. All quotes verbatim.

**Stevie Awards (Asia-Pacific 2025) Gold entry, nomination 20977, category F58 "Award for Innovation in Entertainment Apps"** [C], https://blog.stevieawards.com/hubfs/apsa25%20Gold%20entries%20PDFs/Judge-20977-Hungry%20Studio%20-%20Block%20Blast-%20for%20Best%20Mobile%20Apps-Casual%20Games.pdf (text extracted with pdftotext):

- "One of its most notable features is 'experience equality', ensuring that the game remains accessible and enjoyable for a diverse player base."
- "For example, **A/B tests help customize difficulty levels, allowing players to progress at a pace that suits their skill level.** This adaptive approach ensures that both beginners and seasoned players find the game challenging yet rewarding."
- "…a highly optimized player journey, continuously refined through AI-driven iteration and over 3,000 A/B tests."
- "One of Block Blast!'s key innovations is **Block AI Robot**, a proprietary AI tool developed by Hungry Studio. This technology enhances game balance and progression, **analyzing player behavior in real-time to create an adaptive experience.** By leveraging AI, Block Blast! ensures that each session remains engaging, challenging, and tailored to individual players' preferences."
- "The game offers adaptive editions optimized for different network conditions and hardware."
- Figures: "By the end of 2024, Block Blast! reached 40 million daily active users, and by January 2025, it became the most downloaded mobile game, surpassing even Roblox with 31 million downloads in a single month."

**mobilegamer.biz interview, Jan 14 2025 (Neil Long; Jason Wang, VP)** [C], https://mobilegamer.biz/block-blast-maker-hungry-studio-a-b-tested-its-way-to-the-top-of-the-charts/:

- "Every week, we run more than 50 A/B tests across different versions of features, visuals, and gameplay mechanics."
- "Most of these tests – about 97% – fail. But we see this as a strength, not a weakness."
- "Honestly, we can openly admit that Block Blast's growth has heavily relied on user acquisition."
- On the simulation tool: "It's capable of mimicking real user interactions, making our iteration and evaluation processes faster and more effective."
- The article does not discuss difficulty settings.

**Business Wire press release, Jan 8 2026 (via Antara reprint, Jan 15 2026)** [C], https://en.antaranews.com/news/399953/homepage-v2.html: "70M DAU", "300M MAU"; "more than 10,000 A/B tests" in 2025; "over 300 experiments running in parallel each day"; **Block AI** described as a user-behavior simulation platform enabling "high-density automated testing before new versions go live", credited with cutting post-launch experience issues by "more than 50%". The release does not mention difficulty, adaptivity or personalization. The Star later quoted Wang from a January release: the game "may look simple, but it is powered by an extensive A/B testing framework" (https://www.thestar.com.my/tech/tech-news/2026/10/28/is-block-blast-rigged-a-developer-decompiled-the-viral-game-to-find-out).

**Reading across these.** The 2025 essay describes Block AI Robot as a live, per-player, real-time adaptive system that "customize[s] difficulty levels"; the 2026 release recasts Block AI as a pre-release simulation tool. The earlier text, written by the studio itself, is the closest thing to a developer admission of in-game adaptivity. Experiment counts vary by source: ~3,000 with ~100 successes (Khripin), 10,000+ in 2025 (official), "around 25,000" (Braberg, https://www.gamigion.com/?p=28695) [R].

**Silence on the October 2026 allegations** [C]: mobilegamer.biz asked Ayoships, Hungry Studio, King and Sybo for comment: "At the time of writing none of them have replied." (https://mobilegamer.biz/this-creator-says-he-decompiled-block-blast-candy-crush-and-subway-surfers-to-reveal-their-monetisation-secrets/, Oct 27 2026). The Star: "Hungry Studio did not reply to a request for comment ahead of publication." (Oct 28 2026). Press For Play: "No response from the publisher has been reported." (https://pressforplay.com/blog/block-blast-ad-logic-teardown/, Oct 23 2026). Gamigion's piece does not mention the studio.

## 3. Teardown 1: Ayo Omolewa / Ayoships (Oct 15 2026)

Source: https://ayoships.com/breakdowns/block-blast ("How Block Blast harvests its players for ad money"); author described by mobilegamer.biz as "data scientist, content creator and a0.dev founder". Builds: Android 10.8.2 (build 10820), an APKPure XAPK downloaded Oct 11 2026 with signature verified; iOS 7.4.9 (build 7491) IPA, 4,670 resources checked against Apple's code signature. Tools: jadx, Ghidra, Android 14 emulator, Apple simulator, live iPhone capture. Only "a rendering workaround" was applied; no changes to scores, ads, flags or config.

**Architecture claims.** The server assigns "arms" of named "traits": about **700** named, **254** selected on the test install, **101** downloaded post-install as **XXTEA**-encrypted, **Brotli**-compressed JavaScript from `bband1.afafb.com` (Android) and `bbios1.afafb.com` (iOS). Native decoding matched a memory dump "across 25,317,680 bytes".

### Every named rule, model and constant

| Name (as published) | Kind | Trigger conditions and constants (quoted or exact) | Effect |
|---|---|---|---|
| `RewardHighValueAdHarvestTrait` | Rule (Android arm 332243014) | Constants: `HIGH_PRICE_MULTIPLIER = 3.5`, `MEDIUM_PRICE_MULTIPLIER = 1.5`, `MIN_HISTORY_AD_WATCH_COUNT = 3`, `RECENT_AD_NO_ESCAPE_COUNT = 3`, `TARGET_AD_LEVEL = "high"`. All three must hold: (1) the last **3** rewarded ads were completed (AppLovin MAX `onUserRewarded`); (2) the loaded rewarded ad's eCPM (`callNativeGetMaxEcpmNumber("2")`) is ≥ **3.5×** the last rewarded ad's; (3) score ≥ high score + `scoreDeltaStep` = **1,000** (other bundled configs: 500, 750). Once per game via `currentGameHasTriggeredDeath`; a revive raises the bar so it can fire again. | `onBottomOfferAlgo` replaces the deal with `deathAlgorithm` → `ZHI_SI_TI`. If the engine finds no lethal set, the rule resets and retries next deal. Author ran 28 downloaded-file checks (pass); live iPhone showed 72.39 vs 37.41 eCPM (1.94×), below threshold, so it did not fire. |
| `RewardHighValueAdHarvestV2Trait` | Rule (iOS) | `requireRecentNoEscape` can be disabled; the app ships **12** versions, half disable the ad-history check and require **1 to 3** ads. Price bar: **3.2×** the first ad loaded in the session during week one, **2.7×** through day 30, **3×** the last ad afterwards. | Same lethal request. Author: can fire "after a single ad, even one closed early". |
| "Lethal puzzle" / `ZHI_SI_TI = 9` → `algo_must_death = 24001`; native `func_death_blcok` (sic); label 致死题 | Generator algorithm | Finds two pieces that fit the current board and one that does not; "keeps the set only if no order and no set of positions places all three", counting line clears. Test board: "we tried all 171 placements, and none of them finish it"; on an empty board the same three pieces "fit 67,680 ways in each order". | A hand that looks playable but cannot be completed. |
| `PersonalMarginBreakTrait` | Rule | `recordPercent 10`, `prob 20`, `replaceAlgoId 9`: once score is **10%** past the high score, each deal has a **20%** chance of requesting algorithm 9. Live example: record 1,304 → threshold 1,434; unplayable set dealt at 3,356 (verified by two exhaustive searches). | Lethal hand. |
| `FastHandPunishTrait` | Rule | Last **six** sets averaged under **4.2 s** per set **and** score past **93%** of high score. | Requests hard pieces. |
| `FailStreakStrategyTrait` | Rule | After **two** games below the record. | "asked for easier pieces" (undefined). |
| `MaturityDevelopmentV2Trait` | Rule | Session "maturity" = habit + skill + ad history; example 10.98 + 14.66 + 19.27 = **44.91** vs line **65**. | Below the line "it swapped some of the hard puzzles it would have dealt for easy fills". Above-line behaviour not stated. |
| `MultiClearBoostThenKillTrait` | Rule + server | Sends user ID to two (unnamed) server endpoints, receives two labels; code labels tiers 怼死不敏感 ("not sensitive to being forced to die"). After a big clear, requests the lethal puzzle "a few rounds later", once the game has lasted about as long as the player's usual game. No exact round count. | Lethal hand after a multi-clear. |
| `MABXiBaiTrait` | 6-arm bandit | Arms: lethal puzzle **never**, or allowed after ~**4, 6, 10, ~17, 30 minutes**. Measures whether a new game starts within **15 minutes** and the share of revive offers accepted. | Chooses when lethal puzzles may begin. |
| `AdPlusMinusStrategyTrait` | Rule | After one kind of extra revive offer. | Adds a random bonus of **up to 10%** of the high score to the current score. |
| `predict_travel_difficulty_dead` | On-device XGBoost classifier | **500** trees, **52** inputs; scores **12** options (`sw_process` 1–4 × difficulty 1–3), keeps the highest. Used in Adventure ("travel"/Chapter). | Picks where in a level to apply difficulty/death. |
| `IsOpenDeathChangeReviveCountTrait` | Rule (Adventure) | Level stretches: option 1 [0, 0.3], 2 [0.3, 0.8], 3 [0.8, 1], 4 [1, −1]. Extra revive if the player usually takes revives (> **75%**). From the **4th** deal after the stretch, requests algorithm 9 when `needZs` is set and `zsRoundNum > 3`. | Lethal hand positioned within a level; other rules ease levels when option 4 is chosen. |
| `xgboost_regression_model111.json` | On-device XGBoost regressor | **59** trees, depth ≤ 8, **27** inputs (18 ad-related) → `finalEcpm`. Author's probe outputs: US iPhone 15 **25.48**, US Android **48.96**; Brazil 8.08 / 17.90; India 5.59 / 14.83; first-score 500 → 25.79, 2,000 → 21.12, 10,000 → 20.34. Tree walk ported and reproduced by the author. | Predicted ad value feeds the rules below. |
| `IsOpenInterAndRewardAdvDecideReviveTrait` (`checkEcpm`) | Rule | Rewarded eCPM ≥ **2×** interstitial eCPM (other versions 1.5×, 2.5×). | Extra revive offered. |
| `FullScreenAdAddByEcpmTrait` / `IsOpenEcpmTooLowNoInterTrait` | Rules | High predicted price / very low predicted price. | Adds a full-screen ad / skips full-screen ads. |
| Next-day activity model | On-device LightGBM | **1,000** trees, **93** inputs; threshold **0.69**. | `NewNextDayLowActivityTrait` sets the trigger; `NextDayLowActivityFirstReviveFreeTrait` shows a **pink revive button that skips the ad**, once per day. |
| Server-side models | Remote | churn, LTV, revive-click, xDeepFM; endpoint `/v1/ecpm_prediction` receives **40** fields (carrier, storage, hour, recent ad-price stats…). "Their weights stay on the server, so all we can show is what the phone sends." | Unknown. |

**What is not described:** the default generator when no rule fires (random? weighted? solvability-filtered?), the full piece table, and the prevalence of each arm across the player base. The author's FAQ argues the harvest rule "does not respond to play skill".

**Published:** `evidence.zip` (113 KB, Android), `evidence-ios.zip` (2.7 MB), `evidence-ios-live.zip` (270 KB), each with decoded rules, code excerpts with line numbers, SHA-256 hashes, and scripts `verify_reward_harvest.js`, `verify_unsolvable.py`, `verify_packaged_algorithm.js`, `run_all.py`. **Withheld:** "The key and the steps for getting past the apps' protection aren't in the bundles." The author offers the decoding method to journalists and researchers on request, and promises on-page corrections. Credit and a link are required for reuse.

**Coverage and verification status** [C]: Gamigion (Braberg, Oct 23 2026) relays the findings with a $700k–$1M/day revenue estimate and no independent check (https://www.gamigion.com/block-blasts-1m-day-ad-logic-just-got-cracked/). Press For Play (Oct 23): "We have not seen the code ourselves, so treat everything here as reported, not confirmed." mobilegamer.biz (Oct 27) reports them as allegations (video ~1.4M Instagram likes, 1.6M TikTok views; the author claims >15M total). The Star / Inc. / TNS (Oct 28): "one developer's analysis", no code shown, no expert commentary. **Hacker News** (https://news.ycombinator.com/item?id=50217946, 122 points, 54 comments, ~Oct 24 2026): **no commenter claimed independent verification**; the key and method were not discussed; the main complaint was LLM-sounding prose ("If they can't be bothered to write, I can't be bothered to read." — jjbinx007). **As of Nov 9 2026 there is no public independent replication.**

## 4. Teardown 2: unsupo/Block-Blast-Solver (Oct 23 2026)

Repository facts [C] (https://api.github.com/repos/unsupo/Block-Blast-Solver): created 2026-10-23T00:05:54Z, last push 01:49:54Z the same day (under two hours of history), 0 stars, 0 forks, language Dart; contains `AGENTS.md` and `.agents/skills/`, i.e. an agentic coding workflow. Target: `com.block.juggle` 10.9.0-10900 APKM (base APK 171 MB, 14 dex files).

**Claims** (https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/REVERSE_ENGINEERING_REPORT.md ; https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/DEEP_REVERSE_ENGINEERING_SECRETS.md ; https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/FULL_AUDIT_AND_FINDINGS.md ; https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/MONETIZATION_AND_AD_STRATEGY.md):

- Engine: Cocos Creator + JSB; native `libtask.so` (6.7 MB, unstripped) with `BaseBoard`, `BinaryBoard`, `AlgorithmCore`, `AlgoSelect`, `SafetyCheckLogicComponent`; JS assets encrypted under an `HEK:` header.
- `AlgorithmCore::g_arrShape`: 43 × 40-byte structs, initializer at `0x507904`, dumped by Unicorn emulation.
- `SafetyCheckLogicComponent::hasLiveWay`: DFS over the 3! orderings including clears; a hand with no completing order is rerolled; after **8** failures, fall back to the safe pool.
- Pools: `POOL_SAFE` (13 IDs: 6, 27, 28, 15, 3, 2, 5, 4, 37, 38, 39, 40, 41), `POOL_HARD` (11 IDs: 11, 13, 22, 12, 24, 21, 23, 14, 16, 18, 19), `POOL_STANDARD` (28). `coverRate` = popcount/64: **≥ 0.58** → 75% from SAFE; **≤ 0.28** → 35% HARD / 65% STANDARD.
- 17 score tiers at `0x1a27fc`: 0, 300, 500, 700, 1000, 1400, 1800, 2200, 2500, 3000, 3800, 4500, 5200, 6000, 6800, 7600, **8400**; hard-shape odds **5% → 40%**; `handleWeightControl` (`0x4f1044`) bands < 100 / 100–370 / > 370 or 450.
- Source-file names: `AlgoSelectBlockDealDeathState.cpp`, `AlgoSelectBlockRandomNoDie.cpp`, `AlgoSelectBlockAvoidClearBoard.cpp`, `AlgoSelectBlockEntropy3MediumIOS.cpp`, `AlgoSelectStopRefreshScore.cpp` (终止刷分, anti-farming: `statelessIdDowngrade: 37`, `blockGroupDowngrade: 1`, `trap_high_near_danger`).
- Monetization: `RewardHighValueAdHarvestTrait`, `AdPlusMinusStrategyTrait`, `Churn_prediction_tier_1/2/3`, `hs_updateMaturityScoreWithTotalScore`; `afafb.com` pushes `statelessId`, `blockGroup`, `noDie`, `interstitial_interval`. A "harvest funnel": solvability guaranteed below 1,400; harvest fires above 3,800; "over 70%" accept the revive ad (unsourced).
- Scoring: 1 pt per cell + 10 × lines² × combo.

**Reliability assessment.**

1. **No artifacts.** The tree (https://api.github.com/repos/unsupo/Block-Blast-Solver/git/trees/main?recursive=1) contains no `.so`, no memory dump, no Ghidra/Unicorn project, no decrypted JavaScript. The only model file is the author's own PPO checkpoint.
2. **The `extracted_js/` files are still encrypted.** We fetched https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/extracted_js/assets_assets_NoFailBlockTrait_index.ca207.js: 1.5 KB of opaque bytes beginning `HEK:`. So every behavioural description of a bundled trait in `DEEP_REVERSE_ENGINEERING_SECRETS.md` (e.g. `ComboBorderEffectTrait` "magenta glow #E040FB, combo ≥ 2", the pentatonic audio claims) **cannot have been read from those files**; it is inferred from filenames or invented.
3. **Internal inconsistencies:** pools sum to 52 against 43 shapes; three names for the native library (`libtask.so`, `libtask_arm64.so`, `libblockblast.so`); `statelessId` 123 vs 8 for the same module; bands 100–370 vs "> 370/450"; an "8-note pentatonic scale"; "NoDie" relief for at-risk players sits awkwardly beside the forced-death funnel.
4. **"Verification" is self-referential.** The 415-move differential test compares the author's C++, Python and Dart reimplementations with each other, never with the app.
5. **Timing and style.** Created eight days after the Ayoships article; the two shared trait names and the `afafb.com` domain were already public. The prose has the register of LLM output, and its harvest threshold ("> 3,800") is one of its own score tiers rather than Ayoships' relative rule (high score + 1,000).

**What survives as independently useful.** The `extracted_js/` *filenames* are genuine hash-suffixed Cocos bundle entries and catalogue ~95 bundled trait names Ayoships did not publish, e.g. `CTRefactorBAlgorithmDynamicDifficultyTrait`, `CTRefactorAlgorithmStrategyDealTrait`, `CTRefactorNewUserBlockPoolTrait`, `ComboHelpAlgoTrait`, `NoFailBlockTrait`, `HistoryBoardOfferBlockTrait`, `FirstEightGamesFixedBoardTrait`, `HighComboScoringRuleAdjustTrait`, `LimitComboScoreToTenTrait`. **None of Ayoships' named rule traits appear among the bundled files**, consistent with (not proof of) his claim that they are hot-downloaded post-install. `hs_updateMaturityScoreWithTotalScore` is specific and absent from Ayoships; if real it independently supports a "maturity score". The `HEK:` header is consistent with XXTEA + Brotli. Everything else (pools, `coverRate`, tiers, `hasLiveWay`, `Entropy3MediumIOS`) is a single-source [S] claim with no artifact.

### Corroboration matrix

| Claim | Ayoships | unsupo | Independent? |
|---|---|---|---|
| Cocos Creator engine, encrypted JS traits | yes | yes (`HEK:` header) | yes: different detail |
| `afafb.com` config/asset domains | yes (full hostnames) | yes (bare domain) | weak: public before unsupo |
| `RewardHighValueAdHarvestTrait`, `AdPlusMinusStrategyTrait` | yes (constants) | name only | weak: public before unsupo |
| "Maturity" score | `MaturityDevelopmentV2Trait` (65 line) | `hs_updateMaturityScoreWithTotalScore` | plausible, unverified |
| Lethal/death generator | `func_death_blcok`, algo 24001 | `AlgoSelectBlockDealDeathState.cpp` | plausible, unverified |
| Easier pieces for at-risk players | `FailStreakStrategyTrait`, LightGBM pink revive | `AlgoSelectBlockRandomNoDie.cpp`, churn tiers | plausible, unverified |
| Solvability check on default deals | not described | `hasLiveWay` | single source |
| Pools / coverRate / score tiers | not described | yes | single source |
| 43-shape table | not published | yes | single source |

## 5. What the discourse predicts, as testable claims

Each item names an observable that can be logged from gameplay (board state, dealt pieces, timing, score, ad events) without any decryption. Arrows (→) map each claim to the pre-registered hypothesis IDs in `00-brief.md`; claims without an arrow are exploratory sub-tests under the nearest ID.

- **Board-aware dealing (→ H1, H2) (players; unsupo pools/coverRate).** P(small piece | fill ≥ 0.58) and P(large piece | fill ≤ 0.28) should exceed the marginal rates. Null: dealt piece independent of board state.
- **Wall past personal best (→ H3, H4, H8) (`PersonalMarginBreakTrait`).** Hazard of an unsolvable hand should jump to ~0.20 per deal once score > 1.10 × record, and be rare before. Separately, a kink at record + 1,000 that appears only when a rewarded ad has just loaded (`RewardHighValueAdHarvestTrait`).
- **Lethal-hand signature (Ayoships).** Unsolvable hands should disproportionately have exactly two individually placeable pieces and one unplaceable one; random generation yields a different composition.
- **God mode (→ H2, H6) (`FailStreakStrategyTrait`, `MaturityDevelopmentV2Trait`).** After two games below the record, early deals in the next game should offer more legal placements than after a record game.
- **Generous openings (→ H6) (trait names).** The first eight games on a fresh install should have longer games and less variable start boards/deals than a mature account under the same protocol.
- **Platform difference (→ H7; Android-only scope, so deferred) (`Entropy3MediumIOS`).** Matched protocols on Android and iOS should differ in piece entropy or game length; null: same.
- **Version drift (→ H7).** An older APK under the same protocol should yield longer games. Needs archive access; low priority.
- **Repetition (→ H5).** Run lengths of identical consecutive pieces vs. independence under the fitted marginal; also within-hand duplicates.
- **Ad coupling (→ H8).** Game-over timing should correlate with rewarded-ad load events and eCPM proxies (country, device, hour); with ads blocked at the network level the post-record hazard should fall.
- **Fast-hand punishment.** < 4.2 s per set over six sets at > 0.93 × record should raise the hard-piece rate; a slow-play control should not.
- **Multi-clear then kill.** Unsolvable-hand hazard should rise a few deals after a 3+ line clear, in long games only.
- **Session-time gating (`MABXiBaiTrait`).** Within an install, unsolvable hands absent before a cutoff (4/6/10/17/30 min) and present after; cutoffs differ across installs.
- **Revive bonus (`AdPlusMinusStrategyTrait`).** After certain revives, score jumps by ≤ 10% of the record with no placement.
- **Solvability floor (unsupo `hasLiveWay`).** Outside triggers, hands with no completing order should be ~0 if filtered, or match the simulated rate for the fitted marginal if not.
- **Score tiers (unsupo).** Hard-piece share should step at 300, 500, 700, 1,000, 1,400 … 8,400 and plateau; a smooth or flat curve falsifies it.
- **Scoring formula.** Per-move deltas should fit exactly one candidate in `01-game-facts.md` §6; residuals that vary by install indicate A/B-tested scoring.

## Confidence and gaps

**Solid [C]:** Hungry Studio's own statements and its silence on the October 2026 coverage; the Ayoships article's *claims* (constants, trait names, model sizes, what was published and withheld); unsupo's metadata, lack of artifacts and still-encrypted `extracted_js/`; no public independent replication of either teardown as of Nov 9 2026.

**Reported [R]:** the "god mode" observation (one analyst, two outlets); Ayoships' findings themselves (single analyst, evidence bundles published, key withheld, press relayed without verification); view counts.

**Speculative [S]:** all player hypotheses (App Store reviews via a mirror; Reddit unreachable; 7.6.3 and Android-vs-iOS claims are secondhand and anonymous); everything in unsupo beyond filenames; the inference that bundled trait names describe behaviour.

**Phase 2 must settle:** (1) whether the trait system and named rules exist in a current build (hook the trait loader on an emulator, or infer behaviourally via the tests above); (2) the default generator and any `hasLiveWay`-style filtering; (3) prevalence: which arms a fresh install receives and how often lethal rules fire; (4) the piece table (settles the diagonals question); (5) scoring; (6) whether the ad-free Apple Arcade build retains difficulty rules.

## Sources

- https://justuseapp.com/en/app/1617391485/block-blast/reviews
- https://glotier.com/games/block-blast
- https://blockblastsolverss.com/is-block-blast-rigged/
- https://smartblockblastsolver.com/blogs/block-blast-faq
- https://playgama.com/blog/game-faqs/how-do-you-enable-easy-mode-on-block-blast/
- https://balancy.co/blog/2025/03/26/how-could-block-blast-by-hungry-studio-earn-more-monetization-and-gameplay-deconstruction/
- https://www.gamigion.com/take-aways-from-playing-block-blast/
- https://blog.stevieawards.com/hubfs/apsa25%20Gold%20entries%20PDFs/Judge-20977-Hungry%20Studio%20-%20Block%20Blast-%20for%20Best%20Mobile%20Apps-Casual%20Games.pdf
- https://mobilegamer.biz/block-blast-maker-hungry-studio-a-b-tested-its-way-to-the-top-of-the-charts/
- https://en.antaranews.com/news/399953/homepage-v2.html
- https://www.businesswire.com/news/home/20260108572322/en (403 at fetch time)
- https://www.pocketgamer.biz/block-blast-surges-past-40m-daily-active-users/
- https://www.gamigion.com/?p=28695
- https://ayoships.com/breakdowns/block-blast
- https://www.gamigion.com/block-blasts-1m-day-ad-logic-just-got-cracked/
- https://mobilegamer.biz/this-creator-says-he-decompiled-block-blast-candy-crush-and-subway-surfers-to-reveal-their-monetisation-secrets/
- https://www.thestar.com.my/tech/tech-news/2026/10/28/is-block-blast-rigged-a-developer-decompiled-the-viral-game-to-find-out
- https://pressforplay.com/blog/block-blast-ad-logic-teardown/
- https://www.techradar.com/pro/the-dark-side-of-free-mobile-games-how-developers-reverse-engineer-your-patience-to-milk-ad-revenue (body not retrievable)
- https://news.ycombinator.com/item?id=50217946
- https://api.github.com/repos/unsupo/Block-Blast-Solver
- https://api.github.com/repos/unsupo/Block-Blast-Solver/git/trees/main?recursive=1
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/README.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/REVERSE_ENGINEERING_REPORT.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/DEEP_REVERSE_ENGINEERING_SECRETS.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/FULL_AUDIT_AND_FINDINGS.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/MONETIZATION_AND_AD_STRATEGY.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/GAME_MECHANICS.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/extracted_js/assets_assets_NoFailBlockTrait_index.ca207.js
- https://raw.githubusercontent.com/kittimzhe/blockblast-bench/main/README.md
