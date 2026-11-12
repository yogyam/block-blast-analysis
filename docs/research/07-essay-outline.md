# 07 — Essay outline

Status: draft for review, 2026-11-09.

## Shape

One long scroll-driven page. Target 6,000–8,000 words of prose, eight sections, each with one inline interactive and one or two static figures. Every figure links to the script that regenerates it. A methods appendix carries the math. A "what we did not find" section is mandatory.

Models: Simon Laroche's *History of Tetris Randomizers* (one mechanism per section, each a story about a problem and its fix), Red Blob Games' *Damage Rolls* (live histograms, "try changing this" prompts), Bartosz Ciechanowski (every claim has a toy you can poke).

Voice: curious, concrete, unhurried, never sneering. The reader is the person on the train. The company is described by what its code and its own statements say, not by adjectives.

## Sections

### 1. The piece that never comes
- **Hook.** A real board from our logs, three pieces, none of which fit the obvious gap. "You know this moment."
- **Claim.** Millions of people share the suspicion. The company has never addressed it. Someone recently opened the app up and found something.
- **Demo.** Replay of one real logged game at reading speed; the reader can scrub. At the fatal hand, a toggle shows every piece in the set that *would* have fit.
- **Needs.** One logged real game (Phase 3). Piece set (Phase 2).

### 2. How the game actually works
- **Claim.** Rules in sixty seconds: 8x8, three pieces, no rotation, place all three, lines clear, dead when nothing fits.
- **Demo.** Playable mini board with a visibly fair dealer (uniform draws). Score and a "pieces that fit" counter update live.
- **Figure.** The full piece set as a grid, with sizes.
- **Needs.** Engine (Phase 4), canonical piece set (Phase 2).

### 3. What fair would look like
- **Claim.** Under a fair dealer, how long do games last, and what kills you? Fairness has a shape, and we can draw it.
- **Demo.** Slider over 10,000 simulated games with a uniform generator and a mid-skill agent: histogram of game length and of score; a "you would have died here" marker on the reader's own game from section 2.
- **Figure.** Game-length distributions for three agents (random, greedy, search) under the uniform dealer.
- **Needs.** Simulator and agents (Phase 4).

### 4. Catching a rigged dealer without seeing the deck
- **Claim.** You can prove a card dealer is cheating from the cards alone, if you know what the deck is and what the dealer could see. The board is what the dealer sees.
- **Explanation ladder.** (a) Picture: a dealer, a table, a face-up board. (b) Sentence: "For every hand, we know exactly how likely a fair dealer was to give you something playable. Add up the surprises." (c) Appendix: the martingale Z, the conditional logit, the hazard.
- **Demo.** Two hidden dealers, one fair and one rigged (rescue, kill, or lethal; the reader picks). Deal hands; a meter accumulates evidence; the reader sees how many hands it takes to be sure, and that the fair dealer never trips it.
- **Figure.** Power curves: hands needed vs effect size. Calibration plot: the detector on 1,000 fair games.
- **Needs.** Detector and synthetic validation (Phase 4).

### 5. Opening the box
- **Claim.** What the app contains: the engine, the encrypted scripts, the hundreds of server-assigned traits, the named algorithms, the models with telling feature names.
- **Demo.** Step through one real logged turn with the generator's internal state visible: which algorithm fired, what it looked at, what it chose. Counterfactual button: same random state, different board, different pieces.
- **Figure.** A map of the trait system (names grouped by what they act on). The feature list of the difficulty model, annotated.
- **Needs.** White-box results (Phase 2). Nothing here reveals keys or enables circumvention.

### 6. The retention machine
- **Claim.** The pieces are one lever among several. Rescues after losses, chokes near records, revive offers timed to ad value, a churn model that hands you a free revive when it thinks you are about to leave, and an experiment platform choosing among all of these per player.
- **Demo.** A "difficulty dial" driven by our fitted model: drag your score toward your personal best and watch the predicted hard-piece probability move; toggle "just watched three rewarded ads".
- **Figure.** Effect sizes from real data for H2, H3, H4, H8, with confidence intervals. Online vs airplane mode side by side.
- **Needs.** Black-box results (Phase 3), analysis (Phase 4).

### 7. Playing back
- **Claim.** Knowing the dealer changes the strategy. Keep the board flat and the big shapes placeable; expect the squeeze near your record and bank space before it; understand what the revive is for.
- **Demo.** The reader plays against the *real* (reimplemented) dealer, with an agent's suggested move shown on request. Score comparison: you, the greedy agent, the search agent, under fair vs real dealing.
- **Figure.** Agent scores under uniform vs reimplemented generator.
- **Needs.** Reimplemented generator (Phase 2 + 4), agents (Phase 4).

### 8. It is not just Block Blast
- **Claim.** Dynamic difficulty is a thirty-year-old idea; the novelty is tying it to ad value per player. The literature, the patents, the incentives, the lawsuits. What a reader can take with them: the shape of fairness, and the question to ask of any free game.
- **Figure.** Timeline: Hamlet (2004) → EA patent (2016) → EOMM (2017) → Pape et al. (2025) → this.
- **Needs.** Literature (Phase 1).

### What we did not find
Mandatory. Every hypothesis that did not reject, every claim from the prior teardown we could not reproduce, every limitation (emulator population, Android only, Classic only, our trait arms).

### Methods appendix
The content of `06-methods.md`, tightened. Links to the frozen commit and to every script.

### Credits and right of reply
Ayoships teardown, open-source projects we borrowed from, the literature. Hungry Studio's response or the date we asked and heard nothing.

## Dependency map

| Section | Needs from Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|
| 1 | piece set | one logged game | replay widget |
| 2 | piece set, scoring | | engine, mini board |
| 3 | | | simulator, agents |
| 4 | | | detector, power, calibration |
| 5 | generator, traits, models | logged turn with internals | counterfactual harness |
| 6 | trigger constants | thousands of hands, ad events | fitted models, effect sizes |
| 7 | reimplemented generator | | agents |
| 8 | | | |

## Interactive components to build (apps/essay)

`ReplayViewer`, `MiniBoard` (playable), `DistributionExplorer` (histograms with sliders), `DealerDetector` (two hidden dealers, evidence meter), `TurnInspector` (real turn with internals and counterfactual), `DifficultyDial`, `PlayAgainstDealer`, `Timeline`. All import `@blockblast/engine` directly; none fetch anything at runtime beyond static JSON produced by `apps/sim-cli`.
