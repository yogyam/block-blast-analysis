import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // These tests run whole simulated games through the detector; several files are individually
    // CPU-heavy. Run files sequentially so each gets the full machine (otherwise they starve each
    // other and blow the per-test timeout under `pnpm -r test`), with a generous timeout.
    fileParallelism: false,
    testTimeout: 300_000,
    // Note: long CPU-bound tests can block the worker's heartbeat and print a benign
    // "[vitest-worker]: Timeout calling onTaskUpdate" after the run; it does not fail the run
    // (exit 0, all tests pass). Shard the heaviest tests if a stricter CI rejects it.
  },
});
