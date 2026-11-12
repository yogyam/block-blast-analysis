# @blockblast/generators

The generator zoo of `docs/research/06-methods.md` §7, plus a documented approximation of the
live game's dealer. Every generator is a small class implementing the engine's `Generator`
interface (`{ next(state, rng): Hand; reset(); serializeState(); name; pool? }`), is
deterministic given the engine's seeded `Rng`, and returns JSON-able state from
`serializeState()`. Zero runtime dependencies beyond `@blockblast/engine`.

```sh
pnpm --filter @blockblast/generators test        # vitest (60 tests)
pnpm --filter @blockblast/generators typecheck
pnpm --filter @blockblast/generators build       # dist/ (ESM + .d.ts); the engine must be built first
```

```ts
import { seedRng, TEN_TEN_POOL, UniformGenerator, playGame, GreedyAgent } from '@blockblast/engine';
import { RescueGenerator, buildGenerator, describeGenerator, GENERATOR_ZOO } from '@blockblast/generators';

const rescue = new RescueGenerator(new UniformGenerator(TEN_TEN_POOL), { fillThreshold: 0.5, strength: 0.8 });
const same = buildGenerator({ name: 'rescue', opts: { fillThreshold: 0.5, strength: 0.8 } }, TEN_TEN_POOL);
playGame(same, new GreedyAgent(), seedRng(1), { oracle: true });
describeGenerator(same); // { kind: 'rescue', name: 'rescue(uniform)', summary, knobs, control, pool, state }
```

## Conventions

- **Wrappers** take a `base` generator. They use it to deal (`GuaranteeOneFits`, `GuaranteeSolvable`,
  `Rescue`, `Lethal`, `SlotBiased`) or, for the i.i.d. re-weighting generators (`Kill`,
  `PerGameDifficulty`), as the source of the marginal: the base's own `weights` map when it has
  one (`UniformGenerator`, `WeightedGenerator`), else uniform over `base.pool`. Instance names
  nest: `rescue(kill(bag))`.
- **Score thresholds** (`ScoreThreshold`) are a bare number (absolute score), `{ absolute }`,
  `{ fractionOfBest }` or `{ offsetFromBest }`; relative forms use `GameState.personalBest`, the
  pre-game best, which is 0 on a fresh install (so relative thresholds are met from the first
  deal, as in the observed session).
- **Placeability guarantee** (`findSolvableHand` in `common.ts`): rejection-sample i.i.d. hands
  (pieces that fit the board now up-weighted by `fitBias`) until the exact oracle says the hand
  is fully placeable in some order; after `maxAttempts`, construct one by depth-first search over
  (fitting piece, legal placement, clears) and shuffle its slot order. Returns null only when no
  pool piece fits at all (or the node budget is exhausted), in which case the caller deals its
  unsolvable draw and the game ends.
- **State** is per game: `reset()` zeroes counters; `playGame` calls `reset()` at every start.
  The simulator snapshots `serializeState()` after each deal into `generator_state_json`.
- **Constants read from the live game** (`pools.ts`): `LIVE_POOL` (ids 2–31, the random
  strategy's pool), `EARLY_FILTER_IDS` ([11,12,13,21,22,23,24,39,40,41]), `LIVE_EARLY_POOL`,
  `LETHAL_SEARCH_POOL` (2–42 minus 41), `GAME_HARD_PIECE_IDS` (the library's 18-id list
  [29,24,23,17,9,21,36,42,35,8,16,10,7,14,22,12,11,13]), `GAME_SAFE_POOL`
  ([1,2,3,4,5,6,9,15,27,28]), `GAME_SCORE_TIERS` (300 … 8400) with `scoreTier(score)`, and the
  `POOLS` registry (`default`, `ten-ten`, `live`, `live-early`, `lethal-search`, `safe`). The
  detector's narrower hard class (3x3, 5-bars, big Ls) is the engine's `HARD_SHAPE_IDS`.

## The zoo

Hypothesis ids are those of `docs/research/00-brief.md`: H1 board-aware dealing, H2 rescue, H3
kill near the record, H4 lethal hands, H5 within-hand dependence, H6 lifecycle adaptivity
(per-game overdispersion companion), H7 remote arms, H8 ad-value triggers. "+" means the
generator is a synthetic positive control (the test must reject), "−" a negative control (the
test must not reject).

| Name | Class | Knobs (default) | Control for |
|---|---|---|---|
| `uniform` | `UniformGenerator(pool)` (the engine's) | — | H0: − everything |
| `weighted` | `WeightedGenerator(weights)` | `weights: Map<id, number>`; pool = positively weighted ids | − H1–H4 (fixed, board-independent marginal), − H5 |
| `bag` | `BagGenerator(pool)` | — (shuffle, deal sequentially, reshuffle when exhausted; hands span bags) | − H1–H4; + H5 (no repeats within a bag, lag-k dependence) |
| `guarantee-one-fits` | `GuaranteeOneFitsGenerator(base, opts)` | `maxAttempts` (50); then one random slot becomes the smallest fitting pool piece | + H1 (fits), + H2 (Z > 0 on "some piece fits"); not H3 |
| `guarantee-solvable` | `GuaranteeSolvableGenerator(base, opts)` | `maxAttempts` (200), `maxNodes` (20000); state records `lastAttempts` | + H1, + H2 (Z > 0 on "solvable"), + H4 with Λ > 1; not H3 |
| `rescue` | `RescueGenerator(base, opts)` | `fillThreshold` (fraction of 64 cells), `strength` (probability), `fitBias` (8), `maxAttempts`, `maxNodes` | + H2 in the near-full stratum (Z > 0), + H4 (Λ > 1), + H1; must not light H3 |
| `kill` | `KillGenerator(base, opts)` | `scoreThreshold` (absolute or relative to best), `hardBias` (multiplier), `hardIds` (game's 18-id list) | + H3 (hard-piece OR > 1 past the threshold), + H4 (Z < 0); − H1 board features, − H5 |
| `lethal` | `LethalGenerator(base, opts)` | `probability`, `scoreThreshold?`, `pool` (search pool; default the base pool), `maxTriples` (2000), `timeBudgetMs?` (non-deterministic), `shuffleSlots` (false: the game's `[a, b, u]`) | + H4 (Z < 0, Λ < 1, two-fit-one-not signature), + H1; not H2/H3 |
| `per-game-difficulty` | `PerGameDifficultyGenerator(base, opts)` | `levels` (hard multipliers, numbers or `{multiplier, weight}`), `hardIds`; level drawn on the first deal after `reset()` | + H6 companion (per-game overdispersion); − per-turn H1–H4 |
| `slot-biased` | `SlotBiasedGenerator(base, opts)` | `strength` (1): sort the hand so the left slot holds the smallest piece | + H5 slot-position test; − everything else |
| `mixture` | `MixtureGenerator([{ generator, weight }])` | per hand choose one component by weight | whatever its components are; weak/strong settings |
| `replay` | `ReplayGenerator(hands, opts)` | `hands: [id,id,id][]`, `loop` (false: throws when exhausted) | none; replays captured games through the engine |
| `blockblast-like` | `BlockBlastLikeGenerator(opts)` | see below | mirror of the live dealer |

### `lethal`: the game's search, mirrored

`findLethalHand(board, pool, rng, { maxTriples, timeBudgetMs })` shuffles the pool, splits it into
pieces that fit the board and pieces that do not, and iterates over (placeable a, placeable b,
unplaceable u), returning `[a, b, u]` for the first triple that `solvabilityDetail` reports as
exactly-two-fit and unsolvable in every order (the game's `func_death_blcok`,
`docs/findings/whitebox.md` §4d). `hasLethalSignature(board, hand)` tests a hand for that
signature. The game bounds the search by wall-clock time (100 ms); the default here is an
attempt count so runs reproduce, and a time budget is opt-in.

### `blockblast-like`: a model of the observed dealer, not the game's code

`BlockBlastLikeGenerator` reproduces the regimes seen in one install's logs
(`docs/findings/whitebox.md` §4c–4e, `docs/findings/phase2-log.md`) with cheap stand-ins for the
native strategies. The one property of those strategies that the detector sees, "always return a
fully placeable hand", is reproduced exactly; the strategies themselves (gap-fill, entropy
increase, multi-clear, "extremely difficult problem", ...) are not.

| Knob | Default | Observation it encodes |
|---|---|---|
| `pool` | `LIVE_POOL` (2–31) | the pool the random strategy drew from |
| `filterIds` | `EARLY_FILTER_IDS` | `filterBlocks` in the early-game native request |
| `earlyUntil` | 600 | filter in place at 280–601; removed from 609–635 on |
| `fitBias` | 4 (not observed) | stand-in for the gap-fill / entropy strategies' preference for pieces that fit |
| `lethalFrom` | 800 | lethal search requested once at 635, then on every deal from 814 |
| `lethalProbability` | 1.0 | "24001 on every deal" |
| `lethalPool` | `LETHAL_SEARCH_POOL` (2–42) | the lethal search's own pool |
| `dealLethal` | 0 | lethal candidates found at 1163/1207/1293/1354, never dealt |
| `hardBias`, `hardIds` | 3 (not observed), game's 18-id list | the "hard problem" strategies dealt instead of the lethal hand |
| `maxAttempts`, `maxNodes`, `lethalMaxTriples`, `shuffleLethalSlots` | 200, 20000, 2000, false | engineering knobs |

Regimes: **early** (score below `earlyUntil`): filtered pool, placeability guaranteed, fit bias.
**mid**: unfiltered pool, placeability guaranteed. **late** (at or past `lethalFrom`): with
probability `lethalProbability` run the lethal search; if it finds a hand, deal it with
probability `dealLethal`, otherwise deal a hard-biased placeable hand; if it finds none, deal a
plain placeable hand. `regimeAt(state)` and `poolFor(regime)` expose the regime logic;
`serializeState()` reports per-regime deal counts and `lethal: { requested, found, dealt, withheld }`.
With the defaults the model is a positive control for H1, H2 and H4-as-rescue (Λ > 1: it never
deals an unsolvable hand while one exists) and for H3 (hard bias late); with `dealLethal > 0` it
also lights H4 in the kill direction (Z < 0). The JavaScript-side quirks seen live (triples of one
piece when the native side returns nothing, single-piece substitutions) are not modelled.

### Registry

`GENERATOR_ZOO` maps name → `factory(opts, pool)`; `buildGenerator(spec, pool)` takes a bare name
or `{ name, opts }`, with wrappers accepting a nested `base` spec (default `uniform` over the run
pool); `describeGenerator(nameOrInstance)` returns the summary, knobs, control role and, for an
instance, its pool and serialised state; `listGenerators()` lists the names. Unknown names and
unknown option keys throw.

## Tests (`test/`)

Determinism under a fixed seed for every zoo entry (hands and states on 40 boards and in played
games, plus JSON-ability of state); `GuaranteeSolvable` never returns an unsolvable hand on 500
random boards unless exact enumeration shows none exists; `Lethal` hands always satisfy the
two-fit-one-not signature and otherwise fall back to the base; `Bag` deals every pool id exactly
once per bag; `Kill` raises the hard-piece share past the threshold in simulated games (0.53 →
0.82 with `hardBias` 4 on the 19-piece pool); `Replay` reproduces its input; `BlockBlastLike`
never deals an unsolvable hand when a solvable one exists with `dealLethal` 0, and with
`dealLethal` 1 deals the signature exactly when the search finds one, at the configured request
rate.

Indicative numbers (`apps/sim-cli`, greedy agent, live pool, 1,000 games, seed 2026): uniform
11.5 hands and 314 points per game, 94.2% of hands solvable, 2.5% with the lethal signature;
`blockblast-like` 27.1 hands and 812 points, 100% solvable, 0% lethal signature.
