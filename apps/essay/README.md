# @blockblast/essay

The interactive essay — a scroll-driven page whose demos import `@blockblast/engine`,
`@blockblast/generators` and `@blockblast/analysis` directly and run entirely in the browser
(no runtime fetches beyond static JSON produced by `apps/sim-cli`).

Vite + React + TypeScript.

```
pnpm --filter @blockblast/essay dev        # dev server
pnpm --filter @blockblast/essay build      # static build -> dist/
pnpm --filter @blockblast/essay typecheck
```

Status (incremental): scaffold + §1–§2 (hero, the rules, the playable fair-dealer `MiniBoard`).
Planned components (see `docs/research/07-essay-outline.md`): `ReplayViewer`, `DistributionExplorer`,
`DealerDetector`, `TurnInspector`, `DifficultyDial`, `PlayAgainstDealer`, `Timeline`. Real-data
sections (§6) wait on the scaled capture (`docs/findings/capture-status.md`).
