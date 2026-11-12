# @blockblast/analysis

The **detector**: the eight pre-registered statistical tests of
[`docs/research/06-methods.md`](../../docs/research/06-methods.md), the Holm/BH multiplicity
control, the synthetic validation protocol (§7), and simulation-based power curves (§6). Pure
functions over the per-hand log schema; depends only on `@blockblast/engine` and
`@blockblast/generators`. The same detector runs on simulated games and on captured real data,
because a simulator `SimRow` and a parsed real-data JSONL row both satisfy `HandRecord`.

## The tests

| Hypothesis | Primary statistic | Module |
|---|---|---|
| H1 board-aware generation | conditional logit with piece fixed effects, LR test of β = 0 | `clogit.ts` |
| H2 rescue / easing | martingale Z on "some piece fits", near-full stratum | `martingale.ts` |
| H3 kill / choke | martingale Z on "hand has a hard piece", near-record stratum (clogit `hardXscoreRelBest` companion) | `martingale.ts` |
| H4 lethal / solvability | martingale Z on the solvability oracle verdict; mean cumulative hazard Λ as the effect size | `martingale.ts`, `hazard.ts` |
| H5 within-hand dependence | studentized permutation omnibus over duplicate-rate + slot-position bias | `permutation.ts` |
| H6 per-game overdispersion | permutation Pearson statistic on per-game piece frequencies | `overdispersion.ts` |
| H7 remote tuning | stratified comparison across arms — runs only when an arm covariate is present | `detector.ts` |
| H8 ad-value timing | event test — runs only when ad covariates are present | `detector.ts` |

`runDetector(games, opts)` runs every supported hypothesis and applies Holm at family-wise
α = 0.01 across the ones that ran (H7/H8 are left out when the data lacks their covariates, as
simulated data does).

## Notes on the statistics

- **Marginal F** is the plug-in estimate (pooled dealt-piece frequencies, the frozen
  marginal-estimation rule). The conditional logit needs no F — its alternative-specific
  constants absorb it.
- **Mean Λ is not 1 in general.** The §3.3 identity E[Σ h] = E[Σ D] holds for any agent, but
  Σ D (observed unsolvable hands per game) equals 1 only for a player that never dies on a
  solvable hand. `cumulativeHazard` reports Λ against `meanObservedDeaths`, not against 1.
- **Studentized permutation p-values.** The permutation nulls are asymptotically normal, so the
  detector uses z = (obs − mean)/sd rather than the empirical (1 + geq)/(B + 1), which has a
  1/(B+1) floor that cannot clear Holm at α = 0.01. Both are reported.
- **H5 is trend-robust.** A score-dependent (non-stationary) dealer makes the three pieces of a
  late hand share one state, which inflates the size-variance and lag-1 statistics even though
  slots are conditionally independent. Those two statistics are reported as exploratory; the H5
  primary omnibus uses only duplicate-rate and slot-position, so a kill dealer is attributed to
  H3, not H5 (§7 criterion 3).

## Use

```ts
import { playGames, seedRng, GreedyAgent } from '@blockblast/engine';
import { buildGenerator, resolvePool } from '@blockblast/generators';
import { recordsFromGameLogs, groupByGame, runDetector } from '@blockblast/analysis';

const pool = resolvePool('live');
const logs = playGames(200, buildGenerator('uniform', pool), new GreedyAgent(), seedRng(1), { oracle: true, pool });
const report = runDetector(groupByGame(recordsFromGameLogs(logs)));
console.log(report.rejected); // hypotheses rejected at Holm α
```

From the CLI (`@blockblast/sim-cli`): `sim analyze <log.jsonl>`, `sim validate`, `sim power
--generator lethal --target H4`.

The synthetic validation (`validateDetector`, §7) and power curves (`powerCurve`, §6) compose
the engine simulator with the detector; `defaultZoo()` is the §7 generator table as conditions.

## The agents package

`@blockblast/agents` is unused: the four §7 agents (Random, Greedy, ε-Greedy, BeamSearch) live in
`@blockblast/engine` (`src/agents/`) because they are part of the game model, and the agent
factory for the runners is `agents.ts` here.
