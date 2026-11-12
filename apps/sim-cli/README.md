# @blockblast/sim-cli

Simulate Block Blast! games for a (generator, agent) pair with `@blockblast/engine`'s `playGame`
and write one JSONL row per dealt hand in the `docs/research/06-methods.md` §10 schema;
summarise such files. Build the workspace first (`pnpm -r build`): the CLI runs from source but
resolves the engine and the generator zoo through their `dist`.

```sh
pnpm --filter @blockblast/sim-cli sim run --generator blockblast-like --agent greedy --games 1000 --seed 2026 --pool live --out data/sim/bblike.jsonl
pnpm --filter @blockblast/sim-cli sim run --generator kill --opts '{"scoreThreshold":{"fractionOfBest":0.93},"hardBias":4}' --agent random --games 200 --seed 1 --pool ten-ten --out data/sim/kill.jsonl
pnpm --filter @blockblast/sim-cli sim summary data/sim/bblike.jsonl [--json]
pnpm --filter @blockblast/sim-cli sim list [name]        # the zoo, or one generator's knobs
```

`run` options: `--generator <name>` (default `uniform`; see `sim list`), `--agent random|greedy`
(default `greedy`), `--games N` (100), `--seed S` (1; a number or a string), `--out file.jsonl`
(required), `--pool ten-ten|live|live-early|default|safe|lethal-search` (default `live`, ids 2–31),
`--opts '<json>'` (generator options; wrappers take a nested `base` spec), `--scoring
unsupo|kittimzhe|cells-only` (unsupo), `--personal-best N` (0), `--max-turns N` (10000), `--quiet`,
`--json`. Games use independent forks of the seed, so a run is reproducible and game `i` does not
depend on `--games`. The summary is printed after the run.

Row fields: `game_id`, `turn_idx`, `board_lo`, `board_hi`, `hand`, `is_terminal`,
`pieces_placed`, `score`, `personal_best`, `combo_streak`, `legal_moves_count`,
`chosen_placements`, `lines_cleared`, `generator`, `generator_state_json` (the generator's
`serializeState()` right after the deal, as a JSON string), `hand_solvable` (the oracle), plus
`agent` and `score_after` (score once the hand was played; a game's final score is its last row's
`score_after`, which §10 has no field for).

`summary` prints games, hands, mean game length (hands per game, terminal hand included), mean
and max final score, the fraction of hands the oracle calls solvable, the fraction with the
lethal signature (exactly two pieces fit individually and no order places all three), the
terminal-at-deal and ended-mid-hand shares, the hard-piece share under both the detector's 7-id
class and the game's 18-id list, and mean legal moves at deal.

`src/run.ts` exports `runSim(opts, onGame)` and `rowsOf(log, states, gameId, agent)`;
`src/summary.ts` exports `summarizeRows`, `parseJsonl`, `formatSummary`. Output files are
`*.jsonl`, which the repository `.gitignore` excludes.
