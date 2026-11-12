# @blockblast/agents

Not a build target. The four agents of `06-methods.md` §7 — Random, Greedy, ε-Greedy and
BeamSearch — live in `@blockblast/engine` (`src/agents/`), because the agent is part of the game
model and the engine already owns the board evaluation they share. Import them from
`@blockblast/engine`:

```ts
import { RandomAgent, GreedyAgent, EpsilonGreedyAgent, BeamSearchAgent } from '@blockblast/engine';
```

The agent factory used by the detector's validation and power runners is `agents.ts` in
`@blockblast/analysis` (`makeAgent('epsilon:0.3')`, `makeAgent('beam:20')`, …).

This directory is kept only so the Phase-1 monorepo layout stays recognisable; it ships no code.
