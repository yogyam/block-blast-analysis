# 01 · Game facts: Block Blast! (Hungry Studio)

Research-phase document, written 2026-11-09. Tags per `README.md`: **[C]** confirmed (primary source or two independent sources), **[R]** reported (one credible secondary source), **[S]** speculative (forum, SEO, or inference). Every figure carries the URL it came from. Where the scouting notes (`scouting/01-game-facts-scout.md`) and the primary source disagree, the primary source wins and the change is noted.

## 1. Publisher and corporate structure

| Claim | Tag | Source |
|---|---|---|
| Store-facing brand is **Hungry Studio**; the legal seller/provider on the App Store is **ARETIS LIMITED** | [C] | https://apps.apple.com/us/app/block-blast/id1617391485 and https://apps.apple.com/gb/app/block-blast/id1617391485 (both list "Provider: ARETIS LIMITED") |
| Hungry Studio is **headquartered in Hong Kong**, founded **2021** | [C] | https://www.pocketgamer.biz/tencent-in-talks-to-take-a-small-stake-in-block-blast-developer-hungry-studio/ ("headquartered in Hong Kong"); https://www.digitalturbine.com/case-studies/hungry-studio-hit-8-arpdau-in-one-month-with-dt-exchange (Hong Kong); founding year also in the studio's own Stevie essay |
| Apple developer page (id 1655290753) lists six titles: Block Blast!, Block Blast!+ (Apple Arcade), Double Tile!, Match Out!, Solitaire Master!, Sudoku Blast! | [C] | https://apps.apple.com/us/developer/hungry-studio/id1655290753 |
| Hungry Studio is the overseas brand of **北京迦游网络 (Beijing Jiayou Network)**, founded by **刘学正 Liu Xuezheng** (ex-7k7k); ~1,000 staff by late 2025; Lei Jun personally held ~5.8% (bought for ~RMB 90k in 2020, exited 2023) | [R] | https://www.gcores.com/articles/211752 (2026-03-11; quote: "2021年，他们正式成立了海外品牌Hungry Studio"). The piece is a **user submission** ("本文系用户投稿，不代表机核网观点") and does not mention Aretis, Hong Kong or Singapore. Keep [R] until a corporate registry or English-language outlet confirms. |
| **Tencent in talks** for a "small stake"; discussions ran for months; "no final decision has been made" | [R] | https://www.pocketgamer.biz/tencent-in-talks-to-take-a-small-stake-in-block-blast-developer-hungry-studio/ (Feb 26 2026, citing Bloomberg). No valuation or percentage given; no close reported as of Nov 2026. |
| Won copyright case against **Oakever Games** (QBlock clone), N.D. Cal., Judge Araceli Martinez-Olguin, ruling April 15 [2026] | [R] | https://anahatainteractive.com/blog/mechanics-are-free-art-isn-t-what-the-block-blast-cloning-case-means-for-puzzle-studios (Sept 22 2026). Plaintiff named only as "Hungry Studio"; the scout's "Aretis as plaintiff" is not in this source. |
| Briefly **unavailable on Google Play** around May 28 2026; restored; Hungry Studio confirmed the return but gave no reason | [C event / S cause] | https://www.pocketgamer.biz/hungry-studios-block-blast-no-longer-available-on-google-play/ |
| Monetization VP is **Monica Hu**; DT Exchange added across banners, rewarded video and interstitials for "up to 8%" ARPDAU within a month | [C] | https://www.digitalturbine.com/case-studies/hungry-studio-hit-8-arpdau-in-one-month-with-dt-exchange |
| Public spokesperson is **Jason Wang, VP** | [C] | https://mobilegamer.biz/block-blast-maker-hungry-studio-a-b-tested-its-way-to-the-top-of-the-charts/ ; https://www.pocketgamer.biz/block-blast-surges-past-40m-daily-active-users/ |

The DoNews article the scout cited (self-flagged AI-generated) is dropped; gcores alone carries the Beijing link.

## 2. Identifiers and versions

| Item | Value | Tag | Source |
|---|---|---|---|
| Android package | `com.block.juggle`, developer "HungryStudio" | [C] | https://www.apkmirror.com/apk/hungrystudio/block-blast-puzzle-games/ |
| iOS App Store id | `1617391485`; title "Block Blast!", subtitle "Daily Puzzle & Block Crush"; 210.4 MB; category Puzzle | [C] | https://apps.apple.com/us/app/block-blast/id1617391485 |
| Apple developer id | `1655290753` | [C] | https://apps.apple.com/us/developer/hungry-studio/id1655290753 |
| Current Android line | **10.9.8** (Nov 10 2026). Recent uploads: 10.9.7 (Nov 7), 10.9.6 (Nov 6), 10.9.5 (Nov 4), 10.9.3 (Oct 31), 10.9.2 (Oct 28), 10.9.1 (Oct 23), 10.9.0 (Oct 22), 10.8.9 (Oct 21), 10.8.6 (Oct 16): a new build every 2–4 days | [C] | https://www.apkmirror.com/apk/hungrystudio/block-blast-puzzle-games/ |
| Current iOS line | **7.5.9** (shown "4d ago" on Nov 9 2026); release notes are boilerplate ("We're always improving Block Blast! Turn on auto-updates…") | [C] | https://apps.apple.com/us/app/block-blast/id1617391485 |
| Builds analyzed by prior teardowns | Android 10.8.2 (build 10820) and iOS 7.4.9 (build 7491) by Ayoships; Android 10.9.0-10900 by unsupo | [C as to what they claim] | https://ayoships.com/breakdowns/block-blast ; https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/REVERSE_ENGINEERING_REPORT.md |
| Android first seen | 2022-09-23; 1.1B installs; 4.77★ from 5.8M ratings | [R] | https://appgoblin.info/apps/com.block.juggle |
| iOS release | April 3 2022 | [R] | scout note; not re-verified (the App Store page does not show a release date) |
| Former Play title | "Block Blast Adventure Master" | [R] | scout note; consistent with the unitQ slug https://www.unitq.com/unitq-scorecards/blockblastadventuremaster |
| Engine | Cocos Creator + JSB, native `libtask.so`; gameplay rules shipped as encrypted JS "traits" (XXTEA + Brotli per Ayoships; files begin with an `HEK:` header per unsupo) from `bband1.afafb.com` / `bbios1.afafb.com` | [R→C: two RE sources, no official statement] | https://ayoships.com/breakdowns/block-blast ; https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/README.md |

Note the version lines are not comparable across platforms (iOS 7.x, Android 10.x). The player claim that "build 7.6.3 was fairer" (see `02-rigged-discourse.md`) therefore cannot be an iOS build as of today (iOS is at 7.5.9) and would have to be an Android build from roughly 2024 if it exists; APKMirror's archive pages returned HTTP 403 so this was not checked.

## 3. Scale and revenue

### Downloads (third-party estimates)

| Period | Figure | Tag | Source |
|---|---|---|---|
| 2022 | 7.5M | [R] | https://www.blog.udonis.co/statistics/block-blast (AppMagic, June 9 2026) |
| 2023 | 138M | [R] | same |
| 2024 | 240M (Udonis) vs ~216M (mobilegamer, Jan 2025); Udonis says #1 for 2024, mobilegamer says #2 behind Roblox | [R, conflicting] | same; https://mobilegamer.biz/block-blast-maker-hungry-studio-a-b-tested-its-way-to-the-top-of-the-charts/ |
| 2025 | **368M, #1 worldwide** (Roblox 295M, Free Fire 287M, Subway Surfers 191M, Pizza Ready 166M); Udonis gives 363M | [C: two AppMagic-based reports] | https://mobilegamer.biz/the-top-mobile-game-downloads-of-2025/ ; Udonis |
| 2026 YTD (to May) | 121M | [R] | Udonis |
| Peak month | 49.1M (end of 2024); Hungry Studio's own essay says 31M in January 2025 "surpassing even Roblox" | [R] | Udonis; Stevie essay |
| Lifetime | 870M (AppMagic/Udonis); 868M (PocketGamer); ~725M (Appfigures, via TechCrunch) | [R, range] | Udonis; https://www.pocketgamer.biz/hungry-studios-block-blast-no-longer-available-on-google-play/ ; https://techcrunch.com/2026/08/11/2025s-most-downloaded-game-block-blast-is-going-ad-free-on-apple-arcade/ |
| Trend | "downloads may have fallen from their peak in late 2024" | [R] | TechCrunch, Aug 11 2026 |

### Active users

| Date | Official | Third-party | Source |
|---|---|---|---|
| Dec 2024 | **40M DAU / 160M MAU**, "over 200m downloads since its launch in 2021" [C] | — | https://www.pocketgamer.biz/block-blast-surges-past-40m-daily-active-users/ (Dec 6 2024); repeated in the Stevie essay |
| Dec 2025 / Jan 2026 | **70M DAU / 300M MAU** [C] | AppMagic monthly DAU 32.0–38.2M and MAU 184.5–215.9M across Jun 2025–May 2026 (e.g. May 2026: 35.5M / 208.7M); Sensor Tower MAU 181M [R] | https://en.antaranews.com/news/399953/homepage-v2.html (Business Wire reprint, Jan 15 2026; original https://www.businesswire.com/news/home/20260108572322/en returned 403); Udonis; https://www.applixir.com/blog/the-block-blast-playbook-what-127m-in-ad-revenue-actually-bought/ |

The official DAU is roughly double the AppMagic panel estimate. Both cannot be right; we treat the official figure as the company's claim and the panel figure as the independent one.

Retention and engagement (AppMagic via Udonis) [R]: D1 26.1%, D7 4.1%, D30 1.1%, D90 0.4%, D365 0.1%; 12.06-minute average session; 2.71 sessions/day.

### Revenue

| Claim | Tag | Source |
|---|---|---|
| Essentially ad-only: lifetime IAP ≈ **$66,000**; 2025 IAP < $10,000 | [R] | Udonis |
| Sensor Tower: **$127M ad revenue, Jan–May 2026**, highest of any mobile game in the period (Candy Crush Saga $81.1M) | [R] | https://www.applixir.com/blog/the-block-blast-playbook-what-127m-in-ad-revenue-actually-bought/ ; same figure cited at https://ayoships.com/breakdowns/block-blast |
| Daily ad revenue estimates: ~$584k/day (Udonis); "$700-1 million a day" on ~48M DAU (Braberg, Oct 2026); **$1.8M on Black Friday 2025** on ~55M DAU (Braberg) | [R, estimates; author states "no inside knowledge"] | Udonis; https://www.gamigion.com/block-blasts-1m-day-ad-logic-just-got-cracked/ ; https://www.gamigion.com/?p=28695 |
| iOS ad-free subscriptions: **1 Week $4.99, 1 Month $9.99, 1 Year $49.99** (US); £4.99/£9.99/£49.99 (GB) | [C] | App Store US and GB pages |
| As of March 2025 the game had "no in-app purchases, shop, or 'No Ads' purchase" — so the subscription is a later addition (or iOS-only) | [R] | https://balancy.co/blog/2025/03/26/how-could-block-blast-by-hungry-studio-earn-more-monetization-and-gameplay-deconstruction/ ; https://www.gamigion.com/take-aways-from-playing-block-blast/ |
| **Block Blast!+** on Apple Arcade from **Sept 3 2026**, "no ads, no in-app purchases" | [C] | https://www.apple.com/newsroom/2026/08/apple-arcade-levels-up-with-block-blast-plus-and-art-of-fauna-cozy-puzzles-plus/ ; https://mobilegamer.biz/hungry-studios-hit-puzzler-block-blast-is-heading-to-apple-arcade/ ; TechCrunch |
| Growth "heavily relied on user acquisition" (Jason Wang); ~100,000 ad creatives in 2025 | [C] / [R] | mobilegamer Jan 14 2025; gcores |

## 4. Rules

There is no official rulebook. The App Store description gives only: "Place cube blocks on the 8x8 board with precision", "Complete rows or columns of tiles and watch the block crush effects cascade", "Plan your moves to unlock massive points and extend your endless high score run", "Keep your board clear to make room for bigger plays" [C] (https://apps.apple.com/us/app/block-blast/id1617391485). The rest below is agreed by two independent reimplementations that were each checked against play: kittimzhe/blockblast-bench (https://raw.githubusercontent.com/kittimzhe/blockblast-bench/main/README.md) and unsupo/Block-Blast-Solver (https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/GAME_MECHANICS.md), plus the Balancy/Gamigion play reports.

| Rule | Statement | Tag |
|---|---|---|
| Board | 8×8, 64 cells; Classic mode starts empty (some A/B arms pre-fill the start board: see trait names `FirstEightGamesFixedBoardTrait`, `NatureDefaultBoardTrait`, `InitBoardToleranceTrait` in §6 of `02-rigged-discourse.md`, and the review "Now when I restart there are random blocks already placed" at https://glotier.com/games/block-blast) | [C] / [S for pre-fill] |
| Tray | 3 pieces shown; may be placed in any order; **the tray refills only after all 3 are placed** | [C] |
| Rotation | None. Pieces are placed exactly as shown | [C] |
| Clears | Any complete row or column clears; several can clear on one move; a cell at a row/column intersection clears once but counts as two lines | [C] |
| Gravity | None. Cleared cells simply empty; nothing falls | [C] |
| Game over | When none of the remaining tray pieces fits anywhere. One rewarded-ad revive is offered (see §7) | [C] |
| Combo | Clearing on consecutive placements builds a combo counter; a placement that clears nothing resets it | [C as behaviour; constants contested, §6] |
| Placeability guarantee | unsupo claims a native `SafetyCheckLogicComponent::hasLiveWay` DFS rerolls a hand if no placement order can place all three; Ayoships describes the opposite for specific triggers (a hand kept only if *no* order works). Neither describes the default generator | [S] |

## 5. Piece set (contested)

Three candidate sets are in circulation. None is from the developer. The canonical set must be read from the app in Phase 2.

| Candidate | Count | Source | Provenance |
|---|---|---|---|
| **A. kittimzhe/blockblast-bench** | **19** | https://raw.githubusercontent.com/kittimzhe/blockblast-bench/main/blockblast/pieces.py | Hand-authored from play; README says the official generator is "专有且疑似自适应" (proprietary and suspected adaptive). Uniform weights by default. |
| **B. unsupo/Block-Blast-Solver** | **43 IDs (41 unique)** | https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/shapes.json and https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/SHAPES_CATALOG.md | Claimed dump of `AlgorithmCore::g_arrShape` (43 × 40-byte structs) from `libtask.so` via Unicorn emulation. No dump artifact published. IDs 0/1 and 40/41 are duplicates. |
| **C. Fan/SEO "19"** | 19 | https://playgama.com/blog/game-faqs/how-many-blocks-are-there-in-block-blast/ | "19 unique block shapes … the 7 classic Tetris pieces plus 12 extra variations." Internally inconsistent with A (A has no T/S/Z). No source cited. |
| **D. Fan "34"** | 34 | — | Appeared in the scout notes; no page stating "34" was found in two searches. Treat as unsupported. |

### Side-by-side by shape family

Grid: `X` filled, `.` empty. Column "B (IDs)" gives unsupo's shape IDs.

| Family | Shapes | A (19) | B (IDs) | C (19) |
|---|---|---|---|---|
| Single | `X` | yes | 0, 1 (dup) | yes |
| Bars, horizontal | `XX` `XXX` `XXXX` `XXXXX` | yes (4) | 3, 5, 17, 11 | yes |
| Bars, vertical | `X/X` … `X/X/X/X/X` | yes (4) | 2, 4, 7, 22 | yes |
| 2×2 square | `XX/XX` | yes | 9 | yes |
| 3×3 square | `XXX/XXX/XXX` | yes | 13 | yes |
| 3×2 and 2×3 rectangles | `XXX/XXX`, `XX/XX/XX` | **no** | 35, 36 | unclear |
| Small L (3 cells, 4 orientations) | `XX/X.` `XX/.X` `X./XX` `.X/XX` | yes (4) | 6, 15, 27, 28 | yes |
| Big L (5 cells, corner, 4 orientations) | `XXX/X../X..` `XXX/..X/..X` `X../X../XXX` `..X/..X/XXX` | yes (4) | 21, 12, 23, 24 | yes |
| L/J tetrominoes (8 orientations) | `X../XXX` `XXX/..X` `XX/X./X.` `XX/.X/.X` `..X/XXX` `XXX/X..` `.X/.X/XX` `X./X./XX` | **no** | 8, 30, 31, 32, 33, 34, 29, 42 | "Tetris pieces" |
| T tetrominoes (4) | `.X./XXX` `XXX/.X.` `X./XX/X.` `.X/XX/.X` | **no** | 10, 26, 20, 25 | "Tetris pieces" |
| S/Z tetrominoes (4) | `.XX/XX.` `XX./.XX` `X./XX/.X` `.X/XX/X.` | **no** | 14, 18, 16, 19 | "Tetris pieces" |
| **Diagonals** (2- and 3-cell, disconnected) | `X./.X` `.X/X.` `X../.X./..X` `..X/.X./X..` | **no** | 37, 38, 39, 40, 41 (dup) | **no** |

Observations:

- A and C agree on the count but not the contents; B is a superset of A except that B adds rectangles, all 16 tetromino orientations and five disconnected diagonals.
- The diagonals (B IDs 37–41) have never been reported by players or guides for Classic mode. unsupo places them in its `POOL_SAFE`. If they are real table entries they may belong to Adventure levels, to an unused arm, or to nothing; if they are not real, the 43-table is fabricated or misread. **This is the single sharpest check Phase 2 can run on unsupo's credibility.**
- One App Store reviewer complains of "'T', 'U' and '+' pieces" (https://justuseapp.com/en/app/1617391485/block-blast/reviews). U and plus pentominoes appear in no candidate set; either players describe shapes loosely or the live set is larger than any candidate.
- Ayoships refers to piece IDs up to at least 13 but publishes no table (scout note; the article's digest does not describe the default set).

## 6. Scoring (unresolved)

No official formula exists. Four incompatible descriptions:

| Source | Placement | Line clear | Multi-line | Combo/streak | Other | Tag |
|---|---|---|---|---|---|---|
| unsupo `GAME_MECHANICS.md` (https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/GAME_MECHANICS.md) | 1 pt per cell | **10 × lines² × combo** | quadratic in lines (2 lines = 40 at combo 1) | combo = number of consecutive clearing moves (first clear = 1); resets to 0 on a non-clearing move | worked table: 1 line/combo 1 = 10; 2 lines/combo 3 = 120; 4 lines/combo 8 = 1,280 | [R, claimed from binary] |
| kittimzhe README (https://raw.githubusercontent.com/kittimzhe/blockblast-bench/main/README.md) | 1 pt per cell | progressive: **1 line = 10, 2 = 30, 3 = 60** | as left | nth consecutive clear multiplies clear points by **(1 + 0.5 × (n−1)), capped ×4** | **Perfect clear +300**; README states "官方计分常数未公开" (official constants not public) | [S, explicit approximation] |
| Fan wiki (https://blockblast-free-nocms-publish.pages.dev/wiki/scoring-and-combos) | 1 pt per cell ("1 Block Square = 1 Point") | 10 per line | "Double Points", "Triple Points", "Massive Multiplier!" (no numbers) | flat streak bonus: +10 on turn 2, +20 on turn 3, "and so on"; resets on a non-clear | none | [S] |
| Misc. SEO guides (search digest) | 1 pt per cell | 10 per line, or 10 per *cell* cleared | ×3 / ×6 / ×10 for 2/3/4 lines | ×2 / ×3 / ×4 combo multipliers | contradictory | [S] |

Two further complications. First, the APK's bundled asset list contains trait names that suggest **the scoring rule itself is an A/B variable**: `HighComboScoringRuleAdjustTrait`, `LimitComboScoreToTenTrait`, `ComboScoreRollingLimitTrait`, `ComboScoreSplitTrait`, `MergeBlockFixedScoreTrait`, `MergeBlockMultiplyScoreTrait` (filenames at https://api.github.com/repos/unsupo/Block-Blast-Solver/git/trees/main?recursive=1) [S, inference from names]. Second, the "Clear Board" (all-clear) bonus is visible in play (`BoardClearChangeSkinTrait`, the Balancy screenshots) but no source quantifies it. Phase 2 must log (cells placed, lines cleared, combo state, score delta) per move and fit the formula directly.

## 7. Modes and monetization layout

**Modes** [C]: Classic (endless, high-score run; App Store: "extend your endless high score run"); **Adventure** (time-limited pixel-art campaign; Balancy and Gamigion report 96 levels over 7 days revealing one pixel per level; called "Chapter"/"travel" in code per Ayoships' `predict_travel_difficulty_dead` and unsupo's `IsOpenTravelFailChangeDefaultBoardTrait`); **Daily** puzzles (App Store subtitle "Daily Puzzle & Block Crush"). Sources: https://balancy.co/blog/2025/03/26/how-could-block-blast-by-hungry-studio-earn-more-monetization-and-gameplay-deconstruction/ ; https://www.gamigion.com/take-aways-from-playing-block-blast/ ; https://ayoships.com/breakdowns/block-blast.

**Ad layout** (three independent play reports agree) [C]:

| Placement | Behaviour | Sources |
|---|---|---|
| Banner | Static, bottom of screen | Balancy ("Static banners at the bottom of the screen"); Gamigion; Applixir; Digital Turbine lists banners |
| Interstitial | After every game/level, "short and skippable"; a reviewer: "There's an ad after every game, and even if I say no to reviving it gives me an ad regardless" | Balancy; Gamigion; https://www.applixir.com/blog/the-block-blast-playbook-what-127m-in-ad-revenue-actually-bought/ ; https://glotier.com/games/block-blast |
| Rewarded revive | One rewarded video at game over; "revival is allowed only once per game session"; "If you lose again, it will be final" | Balancy; Gamigion; Applixir |
| Win-streak counter | Display only, "no rewards for any milestones or penalties for losing a streak" | Balancy; Gamigion |

**Reported conditional layers** (single RE source, Ayoships) [R]: an **extra revive** when the loaded rewarded ad's predicted eCPM is ≥ 2× the interstitial's (`IsOpenInterAndRewardAdvDecideReviveTrait`, other arms 1.5× and 2.5×); an extra revive for players who accept more than 75% of revive offers (`IsOpenDeathChangeReviveCountTrait`); a **free "pink" revive button that skips the ad**, once per day, when a 1,000-tree LightGBM next-day-inactivity model scores ≥ 0.69 (`NewNextDayLowActivityTrait` → `NextDayLowActivityFirstReviveFreeTrait`); an added full-screen ad when predicted price is high (`FullScreenAdAddByEcpmTrait`) and none when very low (`IsOpenEcpmTooLowNoInterTrait`). Mediation: AppLovin MAX (eCPM read via `callNativeGetMaxEcpmNumber`). Source: https://ayoships.com/breakdowns/block-blast. SDK scan: 18 ad networks, mediation AppLovin/Unity/ByteDance/AdMob, AppsFlyer, Firebase, ThinkingData, Volcengine, Bugsnag [R] https://appgoblin.info/apps/com.block.juggle (the "Unity" entry is an ads/mediation SDK, not the engine).

## 8. iOS age rating

**13+** on both the US and GB storefronts, with descriptors "Infrequent: Simulated Gambling", "Infrequent: Sexual Content or Nudity", "Contains: Advertising" [C] (https://apps.apple.com/us/app/block-blast/id1617391485 ; https://apps.apple.com/gb/app/block-blast/id1617391485). The scout's "13+/17+" is downgraded: several user reviews mention 17+, so the rating may have been higher at some point, but today's listing is 13+ [S for the 17+ history]. The "Simulated Gambling" descriptor most plausibly refers to ad content or a spin/wheel feature rather than core play; it is self-declared by the developer and is worth citing as context, not as evidence of anything about the generator.

## Confidence and gaps

**Solid [C]:** Aretis Limited as seller and Hungry Studio as brand, Hong Kong HQ, 2021 founding, identifiers, current version lines and release cadence, official DAU/MAU milestones (40M/160M Dec 2024; 70M/300M Jan 2026), 2025 #1 download rank (368M, AppMagic), iOS subscription prices, Apple Arcade ad-free build (Sept 3 2026), age rating 13+ with Simulated Gambling descriptor, the core rules (8×8, 3-piece tray refilled only when empty, no rotation, rows and columns clear, no gravity), and the three-placement ad layout with one rewarded revive.

**Reported [R]:** the Beijing Jiayou / Liu Xuezheng / Lei Jun history (single Chinese user-submitted article), Tencent talks (Bloomberg via PocketGamer, no close), all third-party download/revenue/retention numbers (AppMagic, Sensor Tower, Appfigures, Braberg's estimates disagree by up to 2×), the Oakever ruling, the engine/trait architecture (two RE sources, no official statement), and every conditional revive rule (one RE source).

**Not resolved:**

1. **Piece set.** 19 (kittimzhe) vs 43/41 (unsupo). The disconnected diagonals and the 3×2/2×3 rectangles are the discriminating shapes. Phase 2: dump the shape table from the native library and/or log every dealt piece across many games and compare the observed support set.
2. **Scoring constants.** Quadratic-in-lines × combo (unsupo) vs progressive 10/30/60 with capped multiplier (kittimzhe) vs flat +10/+20 streaks (fan wiki). Phase 2: per-move logging and regression; also check whether scoring differs across A/B arms.
3. **Default generator.** Uniform, weighted, pool-based, or solvability-filtered? No source describes it; Phase 2's baseline must be measured, not assumed.
4. **Whether the Apple Arcade build carries the same trait system** (it is ad-free, so ad-driven rules have nothing to key on, but difficulty rules could remain).
5. **Reconciling 2024 figures** (216M vs 240M; #1 vs #2) and official vs panel DAU (70M vs ~35M).
6. **7.6.3 build identity** and whether any public archive holds it.

## Sources

- https://apps.apple.com/us/app/block-blast/id1617391485
- https://apps.apple.com/gb/app/block-blast/id1617391485
- https://apps.apple.com/us/developer/hungry-studio/id1655290753
- https://www.apkmirror.com/apk/hungrystudio/block-blast-puzzle-games/
- https://appgoblin.info/apps/com.block.juggle
- https://www.unitq.com/unitq-scorecards/blockblastadventuremaster
- https://www.pocketgamer.biz/tencent-in-talks-to-take-a-small-stake-in-block-blast-developer-hungry-studio/
- https://www.pocketgamer.biz/block-blast-surges-past-40m-daily-active-users/
- https://www.pocketgamer.biz/hungry-studios-block-blast-no-longer-available-on-google-play/
- https://www.digitalturbine.com/case-studies/hungry-studio-hit-8-arpdau-in-one-month-with-dt-exchange
- https://www.gcores.com/articles/211752
- https://anahatainteractive.com/blog/mechanics-are-free-art-isn-t-what-the-block-blast-cloning-case-means-for-puzzle-studios
- https://mobilegamer.biz/block-blast-maker-hungry-studio-a-b-tested-its-way-to-the-top-of-the-charts/
- https://mobilegamer.biz/the-top-mobile-game-downloads-of-2025/
- https://mobilegamer.biz/hungry-studios-hit-puzzler-block-blast-is-heading-to-apple-arcade/
- https://en.antaranews.com/news/399953/homepage-v2.html
- https://www.businesswire.com/news/home/20260108572322/en (403 at fetch time; cited via the Antara reprint)
- https://blog.stevieawards.com/hubfs/apsa25%20Gold%20entries%20PDFs/Judge-20977-Hungry%20Studio%20-%20Block%20Blast-%20for%20Best%20Mobile%20Apps-Casual%20Games.pdf
- https://www.blog.udonis.co/statistics/block-blast
- https://www.applixir.com/blog/the-block-blast-playbook-what-127m-in-ad-revenue-actually-bought/
- https://www.gamigion.com/block-blasts-1m-day-ad-logic-just-got-cracked/
- https://www.gamigion.com/?p=28695
- https://www.gamigion.com/take-aways-from-playing-block-blast/
- https://balancy.co/blog/2025/03/26/how-could-block-blast-by-hungry-studio-earn-more-monetization-and-gameplay-deconstruction/
- https://www.apple.com/newsroom/2026/08/apple-arcade-levels-up-with-block-blast-plus-and-art-of-fauna-cozy-puzzles-plus/
- https://techcrunch.com/2026/08/11/2025s-most-downloaded-game-block-blast-is-going-ad-free-on-apple-arcade/
- https://raw.githubusercontent.com/kittimzhe/blockblast-bench/main/README.md
- https://raw.githubusercontent.com/kittimzhe/blockblast-bench/main/blockblast/pieces.py
- https://api.github.com/repos/kittimzhe/blockblast-bench/git/trees/main?recursive=1
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/README.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/GAME_MECHANICS.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/SHAPES_CATALOG.md
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/shapes.json
- https://raw.githubusercontent.com/unsupo/Block-Blast-Solver/main/docs/REVERSE_ENGINEERING_REPORT.md
- https://api.github.com/repos/unsupo/Block-Blast-Solver/git/trees/main?recursive=1
- https://ayoships.com/breakdowns/block-blast
- https://playgama.com/blog/game-faqs/how-many-blocks-are-there-in-block-blast/
- https://blockblast-free-nocms-publish.pages.dev/wiki/scoring-and-combos
- https://justuseapp.com/en/app/1617391485/block-blast/reviews
- https://glotier.com/games/block-blast
