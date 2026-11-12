# @blockblast/engine

Pure Block Blast! game rules in TypeScript. Zero runtime dependencies; runs in Node and the
browser. Everything the detector (`06-methods.md`) needs to compute from a board and a hand
lives here: the bitboard, the game's own shape table, the exact solvability oracle, fair-dealer
null probabilities, and a simulation loop that logs in the §10 schema.

```
src/
  board.ts          8x8 board as two Uint32 words, notation, clears, hashing, popcount
  shapes.ts         shape table ids 1–51 (03-prior-art.md §1.3) with precomputed placement masks
  rng.ts            seeded xoshiro128** (next, nextInt, fork, serialisable state)
  types.ts          Hand, Placement, GameState, Generator, Agent, GameDriver, Observation
  rules.ts          turn loop + pluggable ScoringRule (Unsupo, Kittimzhe, CellsOnly)
  solvability.ts    canPlaceAny, fitsAnywhereSet, isHandSolvable, solvabilityDetail
  nullprobs.ts      pSomeFits, pHardPiece, pHandSolvable (exact or Monte Carlo with SE)
  simulate.ts       playGame / playGames / summarizeGames, TurnLog in the §10 schema
  driver.ts         SimDriver: the engine behind the GameDriver interface
  generators/uniform.ts   UniformGenerator(pool, weights?) — the H0 dealer
  agents/random.ts, agents/greedy.ts  baseline agents so games run end to end
test/               vitest suites (board, shapes, rng, rules, solvability, nullprobs, simulate)
bench/bench.ts      micro-benchmark (not a test): fit-checks/s, oracle calls/s, games/s
```

```sh
pnpm --filter @blockblast/engine test        # vitest
pnpm --filter @blockblast/engine typecheck   # tsc over src, test and bench
pnpm --filter @blockblast/engine build       # emits dist/ (ESM + .d.ts)
pnpm --filter @blockblast/engine bench       # node --experimental-strip-types bench/bench.ts
```

## Conventions

- **Board.** `{ lo, hi }`, both unsigned 32-bit. `lo` is rows 0–3, `hi` rows 4–7; within a word
  cell (row, col) is bit `(row & 3) * 8 + col`. These are the `board_lo` / `board_hi` log fields.
  Notation for tests and logs: a 64-char string (`#` filled, `.` empty, row 0 first; `/`, `|`
  and whitespace ignored) or eight 8-char rows.
- **Shapes.** `getShape(id)` → `{ id, name, width, height, cells, size, rows, hardness,
  duplicateOf?, placements }`. `placements` holds every legal anchor (top-left of the bounding
  box) with its `(lo, hi)` mask, row-major, so `placementAt(shape, row, col)` is an index.
  Fit test: `((board.lo & p.lo) | (board.hi & p.hi)) === 0`.
- **Hands** are ordered triples `[left, middle, right]`. Duplicates are allowed (the real game
  deals them). `HandSlots` is the tray mid-turn, with `null` for placed pieces.
- **Turn.** Place pieces one at a time in any order; rows and columns clear simultaneously
  after every placement (an intersection cell counts as two lines); the tray refills only when
  all three are placed; the game ends when no *remaining* piece fits anywhere, which can happen
  mid-hand. `GameState` is immutable; `placePiece`, `dealHand` and `step` return new states.
- **Combo** = consecutive clearing placements, reset by a non-clearing placement. Each
  `ScoringRule` returns both the points and the streak to carry forward, so a rule with other
  combo semantics (e.g. "reset after 3 misses") is a drop-in.

## API sketch

```ts
import {
  fromRows, toRows, place, canPlace, boardKey,
  getShape, DEFAULT_POOL, TEN_TEN_POOL, HARD_SHAPE_IDS,
  seedRng,
  createGame, placePiece, dealHand, step, isTerminal, legalPlacements, countLegalMoves,
  UnsupoScoring, KittimzheScoring, CellsOnlyScoring,
  canPlaceAny, fitsAnywhereSet, isHandSolvable, solvabilityDetail, createSolvabilityCache,
  uniformWeights, pSomeFits, pHardPiece, pHandSolvable,
  UniformGenerator, RandomAgent, GreedyAgent, playGame, playGames, summarizeGames, SimDriver,
} from '@blockblast/engine';

const gen = new UniformGenerator(TEN_TEN_POOL);           // pool choice is explicit
const log = playGame(gen, new GreedyAgent(), seedRng(1), { scoring: UnsupoScoring, oracle: true });
log.turns[0]; // { turn_idx, board_lo, board_hi, hand, is_terminal, score, personal_best,
              //   combo_streak, legal_moves_count, chosen_placements, lines_cleared,
              //   pieces_placed, hand_solvable? }

const b = fromRows(['..#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#']);
solvabilityDetail(b, [1, 3, 13]);
// → { fitsIndividually: [true, true, false], fitsCount: 2, solvable: false,
//     terminal: false, looksPlayableButLethal: true }

pSomeFits(b, uniformWeights(TEN_TEN_POOL));              // 1 − (1 − W(S(B)))³, exact
pHandSolvable(b, uniformWeights(TEN_TEN_POOL), { exactThreshold: 12, samples: 20000, rng });
// → { p, exact, se?, fitsCount, evaluations }
```

### Null probabilities

`pHandSolvable` enumerates all multisets of pool shapes with positive weight when the fits-set
S(B) has at most `exactThreshold` members (default 12), and samples `samples` hands (default
20,000) otherwise, reporting `se = sqrt(p(1−p)/n)`. Multisets with no fitting piece are skipped
in bulk; every other multiset is checked by the oracle. This deliberately does **not** make the
`06-methods.md` §4 shortcut "hands containing a piece outside S(B) are unplaceable": a piece
that does not fit now can fit after another piece's placement clears a line
(`test/solvability.test.ts` has a worked example, and `test/nullprobs.test.ts` shows the
probability it changes). The method doc should be amended to say "hands with *no* piece in
S(B) are unplaceable".

### Solvability oracle

Depth-first search over the remaining pieces (equivalent to all orderings; equal ids tried once)
with clears applied between placements, memoised on `(board, remaining multiset)`. Pass a shared
`SolvabilityCache` across hands on the same board. Cross-checked against an independent naive
grid implementation on random boards in the tests; the next cross-check is a port of the
teardown's `verify_unsolvable.py`.

## Open questions this package cannot settle

1. **Which pool does Classic mode deal, with what marginal?** The table (ids 1–51, id 41 a
   duplicate the generator skips) says which shapes exist, not which are dealt. `DEFAULT_POOL`
   is the 50 regular shapes; `TEN_TEN_POOL` is the 19-piece 1010!-style candidate. Experiments
   must pick one explicitly; Phase 2 logs decide (`06-methods.md` §9: the analysis set is the
   shapes observed at least once, with plug-in weights).
2. **Scoring.** No official formula. `UnsupoScoring` (1/cell + 10·lines²·combo) and
   `KittimzheScoring` (1/cell + progressive 10·k(k+1)/2 × min(1+0.5(n−1), 4) + 300 perfect clear)
   are third-party candidates; trait names suggest the live rule is itself A/B-tested
   (`01-game-facts.md` §6). `createGame` requires a `ScoringRule`; the simulator defaults to
   Unsupo. The detector does not depend on scoring; the strategy chapter does.
3. **Rectangle orientation.** Ids 35 ("3x2") and 36 ("2x3") are taken as 3 wide × 2 tall and
   2 wide × 3 tall respectively, following `01-game-facts.md` §5 which pairs 35 with `XXX/XXX`.
   Confirm from the re-extracted table's `w`/`h` arguments.
4. **Kittimzhe perfect-clear bonus** is added unmultiplied; the source does not say.
5. **Mid-hand game over.** `is_terminal` in the log is the §10 definition (nothing fits at deal
   time). A game can also end after placing one or two pieces; the log marks that with
   `pieces_placed < 3` on the last hand and `GameLog.endedMidHand`. For the hazard D_t use
   `hand_solvable` (the oracle), which is false for both kinds of death.
6. **Pre-filled start boards** exist in some A/B arms; `GameConfig.initialBoard` supports them,
   the simulator defaults to empty.
7. **`GameDriver.observe()` is synchronous** as specified; a real emulator driver will probably
   need an async variant, which can widen the interface without touching the engine.

## Baseline numbers (uniform generator, this engine's scoring default)

From `test/simulate.test.ts` and `bench/bench.ts`; indicative only, the generator and pool are
unconfirmed: random agent ≈ 4.7 hands (19-piece pool) / 4.1 hands (50-shape pool) per game;
greedy one-step lookahead ≈ 14 hands on the 19-piece pool. See the benchmark for throughput.
