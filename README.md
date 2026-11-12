# Block Blast Analysis

> **You aren't playing Block Blast. Block Blast is playing you.**

An independent reverse-engineering and data-analysis project on the mobile game *Block Blast!*
(Hungry Studio). The goal is a long-form interactive essay that a general reader can follow,
backed by a reproducible TypeScript codebase: a game engine, pluggable piece generators,
agents, a statistical detector for adaptive dealing, a data-capture pipeline, and the
in-page demos.

## Status

**Phase 1: deep research.** See `docs/research/`. Nothing here is a finding yet.

## Layout

```
docs/research/     sourced research documents (Phase 1 output)
docs/research/scouting/  raw scouting notes from the planning session (provenance, not polished)
docs/findings/     white-box and black-box results, once they exist
packages/engine    pure game rules, zero deps, runs in Node and the browser
packages/generators  uniform / weighted / bag / adaptive / replay generators
packages/agents    random, greedy, beam-search agents behind one interface
packages/analysis  exact null expectations, tests, power analysis
packages/capture   emulator driver, board reader, Frida scripts, log normalizer
apps/sim-cli       mass simulation runner
apps/essay         the interactive essay
data/              raw logs (gitignored); small derived summaries committed
```

## Principles

- The method is validated on synthetic data from known generators before it touches real data.
- Hypotheses are pre-registered and frozen in a tagged commit before any real log exists.
- We publish methods, aggregate statistics, and short identifiers for commentary.
  We never publish decryption keys, decrypted bundles, the APK, or repack instructions.
- Prior work is credited. The October 2026 teardown by Ayo Omolewa is treated as a set of
  hypotheses to replicate independently, not as ground truth.
