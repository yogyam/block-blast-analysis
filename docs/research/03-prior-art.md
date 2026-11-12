# 03 — Prior art: clones, solvers, bots, board readers, and earlier "is the RNG rigged?" analyses

Written 2026-11-09 from `scouting/02-prior-art-scout.md`, re-verified against primary sources: every README and piece-definition file below was fetched from `raw.githubusercontent.com`, repository metadata (language, licence, stars, default branch, last push) from the GitHub API on 2026-11-09, and the Ayoships evidence bundle (`evidence.zip`, 116 KB, 64 files) was downloaded and read but not executed. Tags follow `README.md`: **[C]** confirmed from a primary source or two independent sources, **[R]** one credible secondary source, **[S]** forum/SEO/inference.

We are writing TypeScript. Nothing below is imported; we port ideas, constants and test cases, and we cite.

## 1. Block Blast clones, simulators, solvers and agents

### 1.1 Survey

Stars and dates are GitHub API values on 2026-11-09 [C]. "Placeable?" asks whether the generator guarantees that the dealt hand can be played.

| Repo | Lang / licence / stars | Piece set | Scoring implemented | Placeable? | Agents and reported scores | Reuse |
|---|---|---|---|---|---|---|
| [kittimzhe/blockblast-bench](https://github.com/kittimzhe/blockblast-bench) | Python stdlib / MIT / 0 (pushed 2026-10-28) | 19 shapes in `blockblast/pieces.py`: 1×1, H and V bars 2–5, 2×2, 3×3, small L ×4, big L ×4; uniform weights by default, `piece_weights=` override [C] | `ScoringConfig`: +1 per cell; lines progressive 10/30/60 (10·k(k+1)/2); combo multiplier 1+0.5(n−1) capped at 4; perfect clear +300. Module says "official scoring constants are not public" [C] | No; game ends when no legal move [C] | 50 seeds: random 68.3, greedy 148.9, heuristic 484.9, beam-10 1,469.6, beam-20 1,901.4, beam-40 2,329.3, beam-80 2,565.3; 10 seeds beam-80 3,953; LLM (qwen) 416.8. 107 tests [C] | Catalogue order for deterministic sampling; invariant/fuzz and regression-band test design; a baseline ladder to calibrate our agents |
| [EmirUsta/block-blast-jax-rl](https://github.com/EmirUsta/block-blast-jax-rl) | Python/JAX / MIT / 0 (created 2026-10-11) | 31 shapes in `block_blast_jax/data/pieces.yaml` labelled "standard": the 19 above plus T ×4, S/Z ×4, diagonal 2- and 3-cell ×4. README: "matched to the original game by playing and observing it" [C] | `env.py`+`constants.py`: +cells placed; `LINE_BONUS_TABLE [0,10,20,60,120,200,300…]` by lines cleared; `CASCADE_TABLE [1,1.5,2.5,4,5]` by min(rows, cols); combo 1+0.5(combo−1) on clearing moves; combo resets after `COMBO_BREAK_STREAK=3` non-clearing moves; `BOARD_CLEAR_BONUS=360` [C] | No. Gumbel-top-3 sampling = uniform **without replacement**, so a hand never contains duplicates (the real game does deal duplicates) [C] | Random 11.6 moves / 50 pts (1,000 games); PPO 28.4 / 250 (1,024 games); AlphaZero-style MCTS 200 sims 124 / 2,031 (3 seeds). 3.5M env steps/s at 16k batch [C] | Bitmask board; a second, independent guess at the real scoring tables; `tests/test_scoring.py`, `test_bitmask_correctness.py`, `test_logic_parity.py` as port targets |
| [NathanDuboisset/RL_project](https://github.com/NathanDuboisset/RL_project) | Jupyter/Python ≥3.11 / none / 3 | 7 base shapes (dot, 2×2, 3×3, line-3, line-4, L-small, L-large) with a random quarter-turn; no 2- or 5-bars [C] | Shaped RL reward, not game score: survival +5, +10 per line, emptiness term, −20 if no empty 3×3, −100 invalid [C] | No [C] | 3-piece game: greedy d2 44 placements; afterstate DVN d2 209; PPO 27; PPO + exhaustive round planner 687 placements (return 451,371) [C] | Afterstate value net + exhaustive 3-piece round planner; report medians (returns heavy-tailed) |
| [RisticDjordje/BlockBlast-Game-AI-Agent](https://github.com/RisticDjordje/BlockBlast-Game-AI-Agent) | Python/Pygame/Gym/SB3 / README says MIT, API reports no licence file / 39 | 13 shapes, 40 orientation variants (2×2, 3×2, 3×3, 3-cell L, 2×3 L, Z, T, S, bars 2–5, 2×2 L); 1×1 only as fallback [C] | No per-cell points; bonus = lines·10·(combos+1), ×(lines−1) if >2 lines, +300 all-clear; combo = running line total, reset after 3 non-clearing placements [C] | **Weaker than README claims.** `generate_valid_shapes()` greedily fits each piece on a simulated grid, falls back to 1×1, then "if even that fails, just append it anyway" [C] | DQN, PPO, masked PPO, 192 actions; no numeric scores published [C] | Sequential-fit generator is a ready-made *helping* mechanism for our synthetic library; action masking |
| [jason66l/blockblast_vision](https://github.com/jason66l/blockblast_vision) | Python FastAPI/OpenCV + React/TS / none / 0 | None fixed: pieces read from pixels, sanity limits 5×5 and ≤9 cells [C] | Evaluation, not score: W_CLEAR 220, W_MULTI 60, W_EMPTY 1, W_HOLES 14, W_FRAG 10, W_MOB 0.9, W_NOFIT 120, W_COMBO_BREAK 150, W_UNPLACED 1e6 [C] | n/a | Solver only: 64-bit bitboard, bit-parallel legal anchors, memoised DFS over all orders; <50 ms typical, 1.5 s worst (~180k positions) [C] | The CV recipe in §2; eval weights as a starting heuristic; anchor-mask trick |
| [buzdarama/block-blast-solver](https://github.com/buzdarama/block-blast-solver) | Next.js 14/TS + FastAPI / none / 0 (created 2026-10-24) | Not stated [C] | Heuristic only (clears, combos, rough surface, holes, clutter), no formulas [C] | n/a | Client-side exhaustive 3-piece search with pruning [C] | Relative-colour classification; "~99% on 71 real screenshots" is the accuracy bar to beat (dev.to post, [R]) |
| [dffge552/block-blast](https://github.com/dffge552/block-blast) | Single-file JS in `index.html` (386 KB) / MIT / 3 | 74 entries in `allShapes`: bars 1–5, squares, 3×2/2×3, L/J, T, S/Z, plus, cross, U, and diagonals [C] | Combo bonus plus streak multiplier 1+0.05·(streak−1) [C] | **Yes, by construction**: every generator path runs `findCompleteSolution()` (DFS over all 6 orderings with simulated clears) or falls back to `generateAnyPlaceablePiece()` [C] | None; it is a trainer with a solver | Five density-keyed generators (§1.3), BFEN notation, perspective-transform OCR |
| [git-papaya/BlastIt](https://github.com/git-papaya/BlastIt) | Swift/SwiftUI iOS 16+ / none / 0 (created 2026-11-06) | 36 `PieceShape` cases: bars, squares, small/big corners, L/J/T/S/Z tetrominoes, plus [C] | `ScoreManager.swift` exists; no constants in README or `PieceGenerator.swift` [C] | **Weaker than README's "solvability-guaranteed"**: per-piece `canPlaceAnywhere` on a simulated board with raster-first placement; final check only that one piece fits the original board [C] | None | Vacancy-biased size filter (<0.25 vacancy: ≤3-cell shapes; 0.25–0.45: 50% chance ≤4-cell) as a second helping mechanism |
| [tokaa1/blockerino](https://github.com/tokaa1/blockerino) | TypeScript (Expo) / MIT / 23 (last push 2025-02-16) | 24 entries, 11 types, in `constants/Piece.tsx` with `distributionPoints` (total 51): 2×2 6, 3×3 3, L ×8 at 2, T ×4 at 1.5, S/Z ×4 at 1, 3-bars 4, 4-bars 2, 2-bars 2. No 1×1, 5-bar or big L [C] | `Game.tsx`: +blocks placed; on clear combo += lines, score += lines·boardLength·(combo/2)·blocks; combo resets after `handSize` non-clearing placements [C] | No; `createRandomHand` has no board check [C] | None | Only TS clone; its weights are an author's guess, not a measured marginal |
| [dffge552/awesome-block-puzzle](https://github.com/dffge552/awesome-block-puzzle) | Index / CC0 / 3 | — | — | — | Lists clones, polyomino/DLX solvers, RL agents, CV readers; **no datasets** [C] | Pointer list; adds tommyothen/BlockBlastML |

Three READMEs overstate their generators (RisticDjordje, BlastIt, and dffge552's "4 algorithms" where the dispatch has five methods). Read the code, not the README.

### 1.2 Sibling-game projects

| Repo | Lang / licence / stars | What it is | Reuse |
|---|---|---|---|
| [CarlosMartinezCuenca/1010RL](https://github.com/CarlosMartinezCuenca/1010RL) | Python 3.10+ / MIT / 0 | 10×10, the same 19-piece catalogue (`src/tenten/game/pieces.py`, "all rotations included"). 50 eval games, 5,000-piece cap: n-tuple TD + search 40,020 (lower bound, 74% hit the cap), n-tuple 3,856, heuristic 1,109, greedy 120, DQN 98, random 79. 400 tuples, TD(0), γ 0.95, 1M steps, weights shared across the 8 board symmetries, `top_k` 10 [C] | A CPU-only, strong, deterministic fixed-policy agent; symmetry sharing transfers to 8×8 |
| [LonamiWebs/Klooni1010](https://github.com/LonamiWebs/Klooni1010) | Java/libGDX / **GPL-3.0** / 243 (2017–2026) | Ad-free 1010! clone; README does not describe generation [C] | GPL: ideas only, no code port |
| [gary-z/blokie](https://github.com/gary-z/blokie) | C++ → WASM / none / 24 | Woodoku 9×9; bitboard of three 32-bit ints; enumerates every ordering and placement per hand; eval prioritises fewest occupied squares, then perimeter/jaggedness, single gaps, keeping 3×3 regions open, preserving completions; "about 110,000 sets of three pieces per game on average" [C] | Eval term list; "hands survived" as the longevity metric |
| [helpingstar/gym-woodoku](https://github.com/helpingstar/gym-woodoku) | Python/Gymnasium / MIT / 10 | `Dict` obs: 9×9 board + three 5×5 blocks centred at (2,2); `Discrete(243)` = 3 blocks × 81 cells [C] | Observation/action encoding conventions |
| [CosmicSubspace/WoodokuAI](https://github.com/CosmicSubspace/WoodokuAI) | C++ AI + Python ADB driver / none / 2 (2023) | AI is a socket client, phone driver is the server; tap/grid coordinates are "magic numbers" for 1080×2400; "most games end at around 100 turns or less"; deterministic mode survives tens of thousands [C] | Driver/agent separation matches our `GameDriver` design; hard-coded coordinates are the failure mode to avoid |

### 1.3 The piece-set problem, and the decompiled shape table

Nine projects, nine piece sets. The 19-piece 1010! catalogue is the shared core (kittimzhe, 1010RL); EmirUsta adds T, S/Z and diagonals (31); BlastIt has 36; RisticDjordje 13 shapes/40 variants; blockerino 24 entries; dffge552 74. None cites a source for its set [C].

The Ayoships bundle settles more of this than the scout realised. `source/shape-table.js` (4,986 bytes) is the game's own `e._shapes` constructor table, extracted from the decoded Block Blast Android 10.8.2 main script, and `proof/verify_unsolvable.py` parses exactly this file [C]. It defines 66 entries: ids 1–51 (regular shapes), 101–111 (solid rectangles 5×2 up to 5×5, presumably special modes) and 200–203 (disconnected 3-cell shapes). Each entry is `new e(rowMasks, colMasks, w, h, cells, a6, a7, a8, a9, a10, a11, a12, a13)`. Rows are bitmasks (bit c = column c). Ids 1–51 decoded:

| id | shape | cells | id | shape | cells |
|---|---|---|---|---|---|
| 1 | `#` | 1 | 27 | `#.`/`##` | 3 |
| 2 | `#`/`#` | 2 | 28 | `.#`/`##` | 3 |
| 3 | `##` | 2 | 29 | `.#`/`.#`/`##` (J) | 4 |
| 4 | V bar 3 | 3 | 30 | `###`/`..#` | 4 |
| 5 | H bar 3 | 3 | 31 | `##`/`#.`/`#.` | 4 |
| 6 | `##`/`#.` | 3 | 32 | `##`/`.#`/`.#` | 4 |
| 7 | V bar 4 | 4 | 33 | `..#`/`###` | 4 |
| 8 | `#..`/`###` (L) | 4 | 34 | `###`/`#..` | 4 |
| 9 | 2×2 | 4 | 35 | 3×2 | 6 |
| 10 | `.#.`/`###` (T) | 4 | 36 | 2×3 | 6 |
| 11 | H bar 5 | 5 | 37 | `#.`/`.#` diag | 2 |
| 12 | `###`/`..#`/`..#` (big L) | 5 | 38 | `.#`/`#.` diag | 2 |
| 13 | 3×3 | 9 | 39 | 3-cell diag `\` | 3 |
| 14 | `.##`/`##.` (S) | 4 | 40 | 3-cell diag `/` | 3 |
| 15 | `##`/`.#` | 3 | 41 | duplicate of 40 | 3 |
| 16 | `#.`/`##`/`.#` (S vert) | 4 | 42 | `#.`/`#.`/`##` (L) | 4 |
| 17 | H bar 4 | 4 | 43 | `..#`/`###`/`..#` | 5 |
| 18 | `##.`/`.##` (Z) | 4 | 44 | `#.#`/`###` (U) | 5 |
| 19 | `.#`/`##`/`#.` (Z vert) | 4 | 45 | `##`/`#.`/`##` (U) | 5 |
| 20 | `#.`/`##`/`#.` (T) | 4 | 46 | `###`/`#.#` (U) | 5 |
| 21 | `###`/`#..`/`#..` (big L) | 5 | 47 | `##`/`.#`/`##` (U) | 5 |
| 22 | V bar 5 | 5 | 48 | `.#.`/`.#.`/`###` (big T) | 5 |
| 23 | `#..`/`#..`/`###` (big L) | 5 | 49 | `#..`/`###`/`#..` (big T) | 5 |
| 24 | `..#`/`..#`/`###` (big L) | 5 | 50 | `###`/`.#.`/`.#.` (big T) | 5 |
| 25 | `.#`/`##`/`.#` (T) | 4 | 51 | plus | 5 |
| 26 | `###`/`.#.` (T) | 4 | | | |

Two consistency checks pass: the witness JSON's pieces [2, 3, 13] decode to vertical domino, horizontal domino and 3×3, and the game's own generator `algorithm-rC-iC.js` skips index 41 (`if (41 != d)`), matching the duplicate [C]. The trailing constructor arguments are not explained anywhere in the bundle. `a5` is the cell count; `a6` rises with size (4 for 1×1, 12 for 3×3 and 5-bars, 20 for 5×5); `a7 ∈ {4,6,8,12}` and `a9 ∈ {0, .4, .6, .8, 1.2, 1.3}` look like per-shape difficulty or weight parameters, and `a10–a13` look like edge-row/edge-column widths; this is inference [S]. **The table defines which shapes exist, not which are dealt in Classic mode or with what weights**; the bundle's README says the default generator is not described [C]. This moves the scout's key uncertainty 1 from "19? 43?" to "which subset of these 51 does the Classic pool use, and with what marginals", which is exactly what our logs must estimate (see `06-methods.md`).

### 1.4 The Ayoships verification scripts

Reachable from [ayoships.com/breakdowns/block-blast](https://ayoships.com/breakdowns/block-blast): `evidence.zip` (Android, 113 KB), `evidence-ios.zip` (2.7 MB), `evidence-ios-live.zip` (270 KB) [C]. The Android bundle contains `proof/verify_unsolvable.py`, `proof/verify_reward_harvest.js`, `proof/verify_packaged_algorithm.js`, decoded trait source, native decompilation (`native/death-annotated.c`), provenance manifests with SHA-256 hashes, and notes. The decryption key and decoding scripts are withheld [C].

`verify_unsolvable.py` (2.9 KB, stdlib only) is a clean reference for our solvability oracle: the board is a 64-bit int; row masks are `255 << 8r`, column masks `sum(1 << (8r+c))`; a placement is legal iff `board & mask == 0`; `place()` ORs the mask then clears every full row and column **simultaneously**; `verify()` runs DFS over `itertools.permutations(pieces)` counting complete solutions. The shipped witness (seed 24001, 62% random fill, pieces [2, 3, 13]) has 8 legal placements each for the two dominoes and 0 for the 3×3, 171 search nodes, 19 branches with row clears, 12 with column clears, and 0 solutions in all six orders [C]. The docstring is explicit that this is a "synthetic witness only: not a board observed during a user's game" [C].

`algorithm-rC-iC.js` is the game's TypeScript death generator: it partitions candidates into currently placeable (`o`) and unplaceable (`i`) shapes, and for each pair of placeable shapes plus one unplaceable shape calls `iC()` on the four orderings in which the unplaceable piece is not first, simulating clears after each placement, accepting the triple only if no ordering completes; it has a time guard, shuffles the output, and an optional `zst_down_level` swap [C]. `verify_reward_harvest.js` runs the decoded `RewardHighValueAdHarvestTrait` in a Node `vm` with synthetic globals and checks 28 boundary conditions (three consecutive completed rewarded ads, loaded eCPM ≥ 3.5× the stored last value, score ≥ starting high score + 1000·(triggerCount+1), the 420-second getter never read) [C]. `notes/harvest-gameplay-chain.md` names the other traits in the bottom-offer pipeline (`ClassNewDeathOptimizeTrait`, `DifferentStrategyDieTrait`, `ContinueSameMoreRoundLimitTrait`, `PlaceHabitAdaptPathTrait`, `DeadlyToHardTrait`, among others) and is careful that qualifying "doesn't guarantee that the next deal is unplaceable" [C]. The teardown is assessed in `02-rigged-discourse.md`; here it matters as reusable code and as the only primary source for the piece table.

## 2. Computer-vision board readers: a recipe to port

The best-documented pipeline is jason66l's `backend/vision.py` (v2, screenshots) and `v1/v1blockblast.py` (v1, live iPhone mirror at `SCAN_FPS = 20` via `mss`) [C]. Combined with buzdarama and dffge552, the recipe is:

1. **Find the grid without templates.** Downscale so the long side ≤ 700 px. Greyscale, take column-mean and row-mean intensity profiles, and high-pass each as absolute deviation from a sliding median of width `k = max(5, min(h, w)/40)`, so thin grid lines stand out whether lighter or darker than cells. Sweep a cell step from `0.35·min(h,w)/8` to `0.99·min(h,w)/8` in 0.25 px increments and score each start position by how well **9 evenly spaced lines** align on both axes: `score = median(line strengths) + 0.5·min(first, last) − median(cell-centre gaps)`, max-pooled ±1 px. Accept the best `col + row` score if `score / noise_floor > 6.0`, else fall back to a fixed layout. The tray is assumed under the board: `tray_y = board.y + board.h + 0.04·board.w`, height `min(0.42·board.w, remaining)` [C].
2. **Classify cells by brightness, not colour.** HSV value channel only; crop each cell's inner 40% (`CELL_INNER_PAD_FRAC = 0.30` per side); filled iff more than `BRIGHT_FRAC = 0.05` of core pixels have `V > V_THRESH = 165` [C]. Themes change hue, not the fact that blocks are bright on a dark board; buzdarama's independent fix for themes was "comparing relative color differences instead" of fixed RGB [R]. dffge552 uses a user-marked empty reference cell and marks a cell filled iff Euclidean RGB distance to the reference > 30 [C]. For our logger, sample N points per cell against a per-frame background estimate and threshold on relative distance; keep brightness as a second vote.
3. **Read the tray with Otsu on saturation.** Split the tray into 3 slots padded by 5% of tray width. Blur S and V with a 3×3 Gaussian; Otsu-threshold S (colourful blocks vs dark tray) AND `V > 40`; morphological open then close with a 3×3 kernel; keep the largest 8-connected component. Reject blobs under `0.6·cell²` (phantom 1×1s) or covering >60% of the slot (background). Snap to a grid: tray cell = `0.47 ×` board cell (`TRAY_CELL_RATIO`), `rows = round(h/cell)`, `cols = round(w/cell)`, resize to 16 px per cell, filled iff fill fraction ≥ 0.40, trim empty rows/columns; reject if >5×5 or >9 cells [C]. Shapes are therefore inferred, not matched to a catalogue; we should match to the decoded table in §1.3 and flag non-members.
4. **Debounce and timing.** v1 waits for board and tray to be stable (`STABLE_TIMEOUT_SEC = 0.25`) before accepting a frame [C]. For our purposes the important event is *hand appearance*: methodology note 4 in `scouting/04-methodology-review.md` requires capturing the hand at the moment it is dealt, including the terminal hand under the game-over overlay.
5. **Reported accuracy.** jason66l reports none (tests use frames from one recording) [C]. buzdarama reports "around 99%" cell accuracy on 71 screenshots, tray accuracy unreported [R]. dffge552's index claims 99.5% for its OCR; no test set is described [R]. Methodology note 9(f) asks for CV noise injection at the measured error rate, so we must measure ours on a labelled set rather than borrow these numbers.
6. **Autoplay.** WoodokuAI drives Android through ADB with hard-coded tap coordinates and a socket between AI and driver [C]; we keep that separation but derive coordinates from the detected grid.

## 3. Prior "is the RNG rigged?" analyses in other games

| Case | Data source and size | Test | Conclusion | Borrow |
|---|---|---|---|---|
| Hearthstone pity timer | Community pack-opening logs posted to r/hearthstone by briel_hs and Pi143, 3–6 Jan 2016; sample size not stated in the sources we could read [R] [PCGamesN](https://www.pcgamesn.com/hearthstone-heroes-of-warcraft/hearthstone-pack-legendary-opening-chances-are-rigged-in-your-favour), [wiki](https://hearthstone.wiki.gg/wiki/Pity_Timer) | Histogram of packs-since-last-legendary against a geometric null; a commenter fit `0.01127 + 1.1735/(41 − counter)` [R] | Legendary hazard rises after ~20–30 packs, guaranteed by 40; epics by 10. Blizzard confirmed exact values on 2023-03-14 [C via wiki citing Blizzard] | The hazard-vs-counter plot is our H6/H3 picture; aggregate logs from many players beat one player's logs |
| Genshin soft pity | genshin-wishes.com database, "25 million pulls as of June 2021", analysis by Cgg ([HoYoLAB 497840](https://www.hoyolab.com/article/497840)); independent tallies at paimon.moe cited by [KQM](https://library.keqingmains.com/evidence/general-mechanics/gacha) [C] | Fit per-pull probability as a function of pity counter; "numerical analysis and simulation" | 5★ base 0.6%, rate jumps at pull 74 (63 on weapons), +6% per pull, hard pity 90; consolidated rate 1.605% [C] | Two independent datasets agreeing on a breakpoint is the credibility standard; publish the per-counter curve, not just a p-value |
| Tetris randomizers | Disassembly of TGM/TAP/Ti ROMs ([tetris.wiki](https://tetris.wiki/TGM_randomizer)); theory thread modelling memoryless, history, bag and NES randomizers as state machines ([tetrisconcept](https://tetrisconcept.net/goto/post?id=57271)) [C] | Exact predictability and base-7 entropy per piece: memoryless 14.29%/1.0, TGM 28.96%/0.759, 7-bag 37.04%/0.626 [C] | Randomizers are designed to be non-i.i.d. (anti-flood, anti-drought); TGM3's hidden bag state "can't be observed directly" | Entropy and lag-k serial statistics for H5; the reminder that non-uniformity is not malice |
| Candy Crush (2013) | One author's memory of a target score dropping, plus a commenter's seven logged starting scores ([Overthinking It](https://www.overthinkingit.com/2013/09/05/candy-crush/)) [C] | None | Anecdote; the author declined to collect data | A cautionary example of what not to publish |
| Candy Crush (King F-1) | King Digital Entertainment F-1, filed 2014-02-18, read on [EDGAR](https://www.sec.gov/Archives/edgar/data/1580732/000119312514056089/d564433df1.htm) [C] | — | "We keep the rules of the game economy identical throughout the game: the progression funnel is not narrowed through artificial blockers to force excessive social outreach or pay for progress." Context is pricing transparency, not a statement about per-player RNG [C]; Lovell's argument that lying in an F-1 would be criminal is at [gamesbrief](https://www.gamesbrief.com/2014/02/if-king-fixes-candy-crush-saga-to-make-you-pay-more-based-on-your-behaviour-they-are-going-to-prison) [C] | A public, legally exposed statement is the strongest denial a developer can make; Hungry Studio has made none of this kind |
| Candy Crush (deceptive.design) | UXP2 Lab catalogue entry, 2016-11-09, [link](https://deceptive.design/articles/candy-crush-saga-impossible-levels) [C] | None; site disclaims that examples "have not been independently verified" | Claims impossible levels and later easing; cites no data [C] | Nothing methodological |
| Royal Match | *Schudde v. Dream Games*, No. 2:24-cv-01215 (W.D. Wash., filed 2024-08-08), 23-page complaint read in full [C] | None; ¶¶59–62 allege "on information and belief" that odds are set so some levels are "nearly impossible to pass initially" and eased "after users fail to pass certain levels after repeated attempts" | Legal theory is Washington gambling law (RCW 9.46, 4.24.070) and the CPA, following *Kater v. Churchill Downs*; no expert analysis, data or code is cited [C]; listed as pending by TINA.org [R] | The two alleged mechanisms are our H3 (kill) and H2 (rescue) in match-3 clothing; the complaint shows what evidence a court has *not* yet seen |
| Toon Blast | One Medium analysis reports levels "often become somewhat easier" after 3–4 fails ([Medium](https://medium.com/@ekinmelissezer/game-analysis-of-toon-blast-mechanics-level-design-difficulty-patterns-and-monetization-signals-022748ae51b4)) [S] | None | Impression, not measurement | Downgraded from the scout's [U] to [S] |
| Wordscapes | [Level Metrics Dataset v1.0](https://www.solvingwordscapes.com/wordscapes-level-dataset/), CC BY 4.0, 6,366 rows [C] | Descriptive difficulty score (word rarity 0.35, word count 0.25, length 0.15, non-advancing swipes 0.25) | Static level metrics; says nothing about adaptive difficulty | Not a manipulation dataset; useful only as an example of a published level-difficulty table |
| Woodoku | App-store complaints and a developer reply that pieces are random [S, not re-verified] | None | — | — |

Common to every entry: the data are **marginal** (packs until legendary, pulls until 5★, piece frequencies, pass rates). None conditions on the player's game state at the moment of the draw, which is what an adaptive block generator would key on. The nearest design is OpenBlock's won-vs-lost comparison of spawn-difficulty distributions (arXiv 2609.22177, see `04-dda-and-psychology.md`), which found them "statistically indistinguishable" [C]. Our contribution is the conditional test, P(hand | board), with board features fixed before the data exist.

## 4. Published datasets

None exist for Block Blast, 1010!, Woodoku or Blockudoku: no repository in §1 ships logged piece sequences, the awesome-block-puzzle index lists no datasets, and our searches found no Kaggle, HuggingFace or Zenodo entry [C, absence after search]. The only structured public game-RNG datasets we found are gacha logs (genshin-wishes.com, paimon.moe) and Hearthstone pack logs, all marginal. The Wordscapes dataset is level metadata. The Ayoships bundle contains a shape table and synthetic witnesses, not gameplay logs [C]. Whatever we log will be the first dataset of its kind, which is a reason to freeze the schema and publish it.

## Confidence and gaps

- **Confirmed [C]:** every repository's language, licence, stars and dates; piece sets and scoring for kittimzhe, EmirUsta, RisticDjordje, blockerino, jason66l (eval), dffge552, BlastIt, 1010RL; the weaker-than-advertised generators in RisticDjordje and BlastIt; the full jason66l CV constant set; the 66-entry decoded shape table and the death-generator logic in the Ayoships bundle; the King F-1 wording from EDGAR; the Royal Match complaint text; the Genshin model and its 25M-pull source; Tetris randomizer metrics.
- **Reported [R]:** buzdarama's 71-screenshot/99% figure (dev.to post, not reproduced); the Hearthstone 2016 analysis details (Reddit threads unreachable; PCGamesN and the wiki summarise them); dffge552's 99.5% OCR claim; Royal Match case status.
- **Downgraded:** Toon Blast easing after failures (one Medium impression) → [S]; "Woodoku developer said pieces are random" → [S], not re-verified; simon.lc *History of Tetris Randomizers* could not be fetched (client-rendered page, archive blocked) and is cited from the scout only.
- **New since the scout:** the game's own shape table (51 regular ids including T/S/Z/U/plus/diagonals, and a duplicated id 41 the generator skips); EmirUsta's 31-piece "matched by playing" set and scoring tables; blockerino's weights; dffge552's full-hand DFS check and five-way density dispatch.
- **Gaps:** which subset of ids 1–51 the Classic pool uses and with what weights; what `a6–a13` mean; whether real duplicate-piece frequency matches with-replacement sampling; no CV accuracy from a labelled set we can audit; iOS bundles not opened.

## Sources

https://github.com/kittimzhe/blockblast-bench
https://raw.githubusercontent.com/kittimzhe/blockblast-bench/HEAD/README.md
https://raw.githubusercontent.com/kittimzhe/blockblast-bench/HEAD/blockblast/pieces.py
https://raw.githubusercontent.com/kittimzhe/blockblast-bench/HEAD/blockblast/scoring.py
https://github.com/EmirUsta/block-blast-jax-rl
https://raw.githubusercontent.com/EmirUsta/block-blast-jax-rl/HEAD/README.md
https://raw.githubusercontent.com/EmirUsta/block-blast-jax-rl/main/block_blast_jax/data/pieces.yaml
https://raw.githubusercontent.com/EmirUsta/block-blast-jax-rl/HEAD/block_blast_jax/env.py
https://raw.githubusercontent.com/EmirUsta/block-blast-jax-rl/main/block_blast_jax/constants.py
https://github.com/NathanDuboisset/RL_project
https://raw.githubusercontent.com/NathanDuboisset/RL_project/HEAD/README.md
https://raw.githubusercontent.com/NathanDuboisset/RL_project/HEAD/src/blockblast/block_blast_env.py
https://github.com/RisticDjordje/BlockBlast-Game-AI-Agent
https://raw.githubusercontent.com/RisticDjordje/BlockBlast-Game-AI-Agent/HEAD/README.md
https://raw.githubusercontent.com/RisticDjordje/BlockBlast-Game-AI-Agent/HEAD/blockblast_game/game_state.py
https://github.com/jason66l/blockblast_vision
https://raw.githubusercontent.com/jason66l/blockblast_vision/HEAD/README.md
https://raw.githubusercontent.com/jason66l/blockblast_vision/HEAD/backend/vision.py
https://raw.githubusercontent.com/jason66l/blockblast_vision/HEAD/backend/solver.py
https://raw.githubusercontent.com/jason66l/blockblast_vision/HEAD/v1/v1blockblast.py
https://github.com/buzdarama/block-blast-solver
https://raw.githubusercontent.com/buzdarama/block-blast-solver/HEAD/README.md
https://dev.to/michal15/i-built-a-solver-that-reads-block-blast-screenshots-and-plans-the-best-moves-3cj4
https://github.com/dffge552/block-blast
https://raw.githubusercontent.com/dffge552/block-blast/HEAD/README.md
https://raw.githubusercontent.com/dffge552/block-blast/main/index.html
https://github.com/git-papaya/BlastIt
https://raw.githubusercontent.com/git-papaya/BlastIt/HEAD/README.md
https://raw.githubusercontent.com/git-papaya/BlastIt/HEAD/Sources/Engine/PieceGenerator.swift
https://raw.githubusercontent.com/git-papaya/BlastIt/HEAD/Sources/Engine/Piece.swift
https://github.com/tokaa1/blockerino
https://raw.githubusercontent.com/tokaa1/blockerino/HEAD/README.md
https://raw.githubusercontent.com/tokaa1/blockerino/master/constants/Piece.tsx
https://raw.githubusercontent.com/tokaa1/blockerino/master/constants/Hand.tsx
https://raw.githubusercontent.com/tokaa1/blockerino/master/components/game/Game.tsx
https://github.com/dffge552/awesome-block-puzzle
https://raw.githubusercontent.com/dffge552/awesome-block-puzzle/HEAD/README.md
https://github.com/CarlosMartinezCuenca/1010RL
https://raw.githubusercontent.com/CarlosMartinezCuenca/1010RL/HEAD/README.md
https://raw.githubusercontent.com/CarlosMartinezCuenca/1010RL/HEAD/src/tenten/game/pieces.py
https://github.com/LonamiWebs/Klooni1010
https://raw.githubusercontent.com/LonamiWebs/Klooni1010/HEAD/README.md
https://github.com/gary-z/blokie
https://raw.githubusercontent.com/gary-z/blokie/HEAD/README.md
https://github.com/helpingstar/gym-woodoku
https://raw.githubusercontent.com/helpingstar/gym-woodoku/HEAD/README.md
https://github.com/CosmicSubspace/WoodokuAI
https://raw.githubusercontent.com/CosmicSubspace/WoodokuAI/HEAD/README.md
https://api.github.com/repos/kittimzhe/blockblast-bench
https://ayoships.com/breakdowns/block-blast
https://ayoships.com/breakdowns/block-blast/evidence.zip
https://ayoships.com/breakdowns/block-blast/evidence-ios.zip
https://ayoships.com/breakdowns/block-blast/evidence-ios-live.zip
https://hearthstone.wiki.gg/wiki/Pity_Timer
https://www.pcgamesn.com/hearthstone-heroes-of-warcraft/hearthstone-pack-legendary-opening-chances-are-rigged-in-your-favour
https://www.hoyolab.com/article/497840
https://library.keqingmains.com/evidence/general-mechanics/gacha
https://tetris.wiki/TGM_randomizer
https://tetrisconcept.net/goto/post?id=57271
https://simon.lc/the-history-of-tetris-randomizers
https://www.overthinkingit.com/2013/09/05/candy-crush/
https://www.sec.gov/Archives/edgar/data/1580732/000119312514056089/d564433df1.htm
https://www.gamesbrief.com/2014/02/if-king-fixes-candy-crush-saga-to-make-you-pay-more-based-on-your-behaviour-they-are-going-to-prison
https://deceptive.design/articles/candy-crush-saga-impossible-levels
https://truthinadvertising.org/wp-content/uploads/2024/09/Schudde-v-Dream-Games-complaint.pdf
https://truthinadvertising.org/class-action/royal-match/
https://medium.com/@ekinmelissezer/game-analysis-of-toon-blast-mechanics-level-design-difficulty-patterns-and-monetization-signals-022748ae51b4
https://www.solvingwordscapes.com/wordscapes-level-dataset/
https://arxiv.org/abs/2609.22177
