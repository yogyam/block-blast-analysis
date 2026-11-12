# Scout report: clones, solvers, agents, prior RNG analyses, DDA literature, writing exemplars

Agent run 2026-11-09. Legend: **[C]** confirmed by fetching the page/README or GitHub API; **[U]** from search snippets or secondary coverage only.

## 0. Headline

Someone already decompiled Block Blast and found an adaptive, ad-value-driven piece generator. Ayo Omolewa ("Ayoships"), *How Block Blast harvests its players for ad money*, 15 Oct 2026 — https://ayoships.com/breakdowns/block-blast **[C, single analyst, unverified by third parties]**

- Method: Android 10.8.2 (jadx + Ghidra; engine is **Cocos, not Unity**), iOS 7.4.9, clean emulator + live iPhone capture. Game logic ships as ~700 server-assigned, XXTEA-encrypted/Brotli-compressed JS "traits" with A/B "arms" (254 selected, 101 downloaded on a test install).
- Generator: a named **"lethal puzzle"** algorithm (`ZHI_SI_TI`, algorithm 24001, native `func_death_blcok`) that searches all orderings/placements (including clears) and keeps a 3-piece hand only if **no sequence places all three**, while two pieces fit individually so it looks playable.
- Triggers: `RewardHighValueAdHarvestTrait` (3 rewarded ads completed, loaded ad eCPM ≥ 3.5× last, score ≥ high score + 1000); `PersonalMarginBreakTrait` (10% past record → 20% chance per deal); `FastHandPunishTrait` (<4.2 s avg per set and >93% of high score → hard pieces); `FailStreakStrategyTrait` / `MaturityDevelopmentV2Trait` (easier pieces when below record / low "maturity" score); `MABXiBaiTrait` (bandit over when lethal puzzles may start). Three on-device tree models (XGBoost eCPM regressor, 500-tree "where to kill" classifier, LightGBM churn predictor gating an ad-free "pink revive").
- Released: evidence bundles (decoded rules, code excerpts, hashes), scripts `verify_unsolvable.py`, `verify_reward_harvest.js`. Decryption key withheld. **Default (non-lethal) generator and the full piece table are NOT described.**
- Coverage: TechRadar, The Star, mobilegamer.biz (Hungry Studio had not responded). AI-assisted summary: https://dev.to/om_shree_0709/reverse-engineering-block-blast-5eop
- Hungry Studio's own statements corroborate heavy experimentation: >50 A/B tests/week, 97% fail (Jason Wang, VP, mobilegamer.biz Jan 2025 https://mobilegamer.biz/block-blast-maker-hungry-studio-a-b-tested-its-way-to-the-top-of-the-charts/ **[C]**); >10,000 tests in 2025, 300 parallel/day, "Block AI" simulation platform, 70M DAU (Business Wire Jan 2026 **[C via mirror]**). A "Block Algorithm with ~100 nested sub-rules" quote surfaced in a snippet but source not located **[U]**. No patents found for Hungry Studio / Aretis Limited **[U]**.

## 1. Reusable code

Block Blast 8×8 (all **[C]** via GitHub API):

| Repo | Lang | What | Notes |
|---|---|---|---|
| https://github.com/kittimzhe/blockblast-bench | Python, stdlib, MIT, pushed 2026-10-28 | Seeded env, **19-shape piece set** (1×1, bars 2–5 both orientations, 2×2, 3×3, small L ×4, big L ×4), configurable scoring, uniform-or-weighted RNG, beam/heuristic/greedy/random baselines, 107 tests | Baselines (50 seeds): random 68, greedy 149, heuristic 485, beam-80 2565 |
| https://github.com/EmirUsta/block-blast-jax-rl | Python/JAX, MIT | Bitmask board, 3.5M env steps/s batched, PPO + AlphaZero-style MCTS | Random 50 / PPO 250 / MCTS(200 sims) 2031 mean; piece set "matched to original by playing" |
| https://github.com/NathanDuboisset/RL_project | Jupyter | DQN/Rainbow, afterstate value net, PPO + exhaustive 3-piece round search | PPO+search: 687 placements mean |
| https://github.com/RisticDjordje/BlockBlast-Game-AI-Agent | Python/Gym, MIT, 39★ | Pygame clone + DQN/PPO/masked PPO, 192-action space | **Engine guarantees ≥1 piece fits** |
| https://github.com/jason66l/blockblast_vision | Python/OpenCV + React | CV: grid-line detection via high-pass brightness profiles, HSV cell classification, Otsu on tray; read live iPhone mirror at 20 fps; bitboard solver <50 ms | Best CV prior art |
| https://github.com/buzdarama/block-blast-solver (+ https://dev.to/michal15/i-built-a-solver-that-reads-block-blast-screenshots-and-plans-the-best-moves-3cj4) | FastAPI/Next | Screenshot → board; relative-color classification; ~99% cell accuracy on 71 screenshots | |
| https://github.com/dffge552/block-blast | JS, MIT | Browser clone + "BFEN" board notation, screenshot OCR, **5 solvability-biased generators by board density** | Example adaptive generator |
| https://github.com/git-papaya/BlastIt | Swift | 64-bit bitboard + "solvability-guaranteed" generator | |
| Others: tokaa1/blockerino (TS, 23★), Inkflow-Gab/blockblast-player (Kotlin CV+search), riccdev06/bb-helper (Android overlay), GSRHaX/BlockBlaster (iOS Shortcuts), trungj2655/block-blast-solver (Rust/C++), https://github.com/topics/block-blast | | | Mostly 0–7★, 2026 |

Relatives:
- **1010!**: https://github.com/CarlosMartinezCuenca/1010RL (Gymnasium, 19 pieces, n-tuple TD + search: **40,020 mean vs random 79**, DQN 98; MIT) **[C]**; https://github.com/LonamiWebs/Klooni1010 (Java/libGDX, 243★, GPL-3) **[C]**.
- **Woodoku/Blockudoku 9×9**: https://github.com/gary-z/blokie (C++→WASM, exhaustive per-hand enumeration + hand-tuned eval) **[C]**; https://github.com/helpingstar/gym-woodoku **[C]**; https://github.com/ZhigaMason/blockudoku-rl (**47-shape catalogue**) **[U]**; https://github.com/CosmicSubspace/WoodokuAI (C++ search + ADB autoplay on Android) **[C]**.
- Curated index: https://github.com/dffge552/awesome-block-puzzle **[C]**.

**Datasets**: none found for any of these games. Nobody has published logged piece sequences.

## 2. Academic agents / difficulty measurement

- Wang, Guo, Guei, Shih, Wu, Wu, *Evaluating Game Difficulty in Tetris Block Puzzle* (arXiv 2603.18994, GPW 2025) — 8×8 block puzzle, Stochastic Gumbel AlphaZero as difficulty probe; T-pentomino hardest. **[C]**
- **OpenBlock** (arXiv 2609.22177, Aug 2026) — adaptive tile-matching platform with verified-solvable generator; compared spawn-difficulty distributions in won vs lost games; live rollout +1.8 pp D1 retention. **[C]**
- Kristensen, Valdivia, Burelli, *Estimating player completion rate using RL* (CoG 2020, arXiv 2306.14626); *Difficulty Modelling in Mobile Puzzle Games* (arXiv 2401.17436). **[C]**
- Pape, Helmers, Iaria, Wagner, Runge (2025), *Personalized content, engagement, and monetization in a mobile puzzle game*, IJIO 98, doi 10.1016/j.ijindorg.2024.103128 — personalizing difficulty could raise revenue **71%**. **[C abstract]**

## 3. Prior "is the RNG rigged?" analyses

- **Block Blast**: only the decompile above plus SEO "not rigged" explainers. No Reddit datasets found.
- **Woodoku**: app-store complaints; Tripledot replied "pieces are generated randomly" **[U]**.
- **Candy Crush**: Overthinking It (2013) https://www.overthinkingit.com/2013/09/05/candy-crush/ **[C]**. King's F-1 IPO filing: rules identical for all players (https://www.gamesbrief.com/2014/02/if-king-fixes-candy-crush-saga-to-make-you-pay-more-based-on-your-behaviour-they-are-going-to-prison) **[C]**. Deceptive Patterns entry https://deceptive.design/articles/candy-crush-saga-impossible-levels **[C]**.
- **Royal Match**: *Schudde v. Dream Games* (W.D. Wash., Aug 2024) alleges probability manipulation under gambling law; https://truthinadvertising.org/wp-content/uploads/2024/09/Schudde-v-Dream-Games-complaint.pdf **[U]**.
- **Toon Blast**: Medium analysis claims levels ease after 3–4 fails **[U]**. Wordscapes: fan dataset of difficulty flags https://www.solvingwordscapes.com/wordscapes-level-dataset/ **[U]**.
- **Methodological exemplars**: Hearthstone pity timer (pack logs; legendary rate rising after ~30 packs, max 39; later confirmed) https://hearthstone.wiki.gg/wiki/Pity_Timer **[U]**; Genshin soft-pity at ~74–75 from 50k+ players' logs **[U]**. Tetris: tetrisconcept "Randomizer Theory" threads model randomizers as Markov chains https://tetrisconcept.net/goto/post?id=57271, https://tetris.wiki/TGM_randomizer **[U]**. None test *conditional* distributions given state — OpenBlock's won/lost comparison is closest.

## 4. DDA / engagement-design literature

- Hunicke & Chapman 2004, *AI for DDA in Games* (Hamlet) https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf; Hunicke 2005, ACE, doi 10.1145/1178477.1178573 **[C]**.
- Zohaib 2018, *DDA in Computer Games: A Review*, Adv. HCI, doi 10.1155/2018/5681652 **[C]**; Paraschos & Koulouriotis 2022/23 IJHCI review; *Closing the Loop* systematic review arXiv 2505.01351 **[U]**.
- **EA patent US9919217B2** (filed 2016, granted 2018) https://patents.google.com/patent/US20170259177A1/en — per-user ML churn/retention prediction drives "knobs" **explicitly including seed values**, "may be undetectable to the user." Related: EOMM (Chen et al., WWW 2017, arXiv 1702.06820). FIFA DDA class action withdrawn 2021 **[C]**. Sony 2023 adaptive-difficulty patent **[U]**.
- Near-miss: Larche, Musielak & Dixon 2017, *The Candy Crush Sweet Tooth*, J. Gambling Studies 33(2):599–615 **[C via secondary]**. Steinhoff (Wooga) GDC 2014 "FUUU factor" https://www.pocketgamer.biz/gdc-2014-wooga-on-using-the-fuuu-factor-to-hit-the-top-of-the-app-store **[U]**. Deconstructor of Fun https://www.deconstructoroffun.com/blog/2025/2/3/hybridcasual-puzzles-expanding-the-puzzle-market; AppMagic "fail offers" (20–33% of IAP revenue) https://appmagic.rocks/blog/fail-offers **[C]**. Zendle & Cairns 2018 PLOS ONE loot boxes **[U]**.

## 5. Writing exemplars

- Simon Laroche, *The History of Tetris Randomizers* https://simon.lc/the-history-of-tetris-randomizers — one randomizer per era, each a story about a problem (floods, droughts) and its fix.
- Red Blob Games, *Probability: Damage Rolls* https://www.redblobgames.com/articles/probability/damage-rolls.html — live histograms, "try changing X" prompts **[C]**.
- 3Blue1Brown, *Solving Wordle using information theory* **[U]**; Xan Gregg, *Deep Wordle* **[U]**.
- Nicky Case explorables; Ciechanowski (ciechanow.ski).
- Common thread: concrete artifact first, one mechanism per section, interactive counterfactual, scrupulous "what we did not find."

## Key uncertainties
1. Canonical piece set and scoring constants (19 per bench repo; ayoships IDs to at least 13; unsupo 43).
2. Whether the default generator guarantees placeability.
3. Independent replication of ayoships — none public as of Nov 2026.
