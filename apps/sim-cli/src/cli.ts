#!/usr/bin/env node
/**
 * Simulation CLI.
 *
 *   sim run --generator <name> --agent <random|greedy> --games N --seed S --out file.jsonl
 *           [--pool ten-ten|live|live-early|default|safe] [--opts '{"...": ...}']
 *           [--scoring unsupo|kittimzhe|cells-only] [--personal-best N] [--max-turns N]
 *   sim summary file.jsonl [--json]
 *   sim list [name]            # the zoo, or one generator's knobs
 *
 * From the repo root: `pnpm --filter @blockblast/sim-cli sim run --generator uniform ...` (a `--`
 * before `run` is accepted too). Build the workspace first (`pnpm -r build`): the CLI runs from
 * source but resolves `@blockblast/engine` and `@blockblast/generators` through their `dist`.
 * Writes one JSONL row per dealt hand.
 */

import { closeSync, openSync, readFileSync, writeSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { POOLS, describeGenerator, listGenerators } from '@blockblast/generators';
import { defaultZoo, groupByGame, powerCurve, runDetector, validateDetector, type HandRecord } from '@blockblast/analysis';
import { runSim, type RunOptions } from './run.ts';
import { formatSummary, parseJsonl, summarizeRows } from './summary.ts';
import { formatDetector, formatValidation, formatPower } from './report.ts';

function usage(): never {
  console.error(
    [
      'usage:',
      '  sim run --generator <name> --agent <random|greedy> --games N --seed S --out file.jsonl [--pool live] [--opts json] [--scoring unsupo] [--personal-best 0] [--max-turns 10000]',
      '  sim summary file.jsonl [--json]',
      '  sim analyze file.jsonl [--permutations 2000] [--samples 8000] [--json]      # run the 8-test detector on a log',
      '  sim validate [--agent epsilon:0.3] [--replicates 40] [--games 60] [--permutations 2000] [--json]   # synthetic §7 protocol',
      '  sim power --generator <name> --target H4 [--agent epsilon:0.3] [--games-list 20,40,80,160] [--replicates 40]',
      '  sim list [name]',
      `generators: ${listGenerators().join(', ')}`,
      `agents: random, greedy, epsilon:<ε>, beam:<width>`,
      `pools: ${Object.keys(POOLS).join(', ')}`,
    ].join('\n'),
  );
  process.exit(2);
}

function int(name: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} must be a non-negative integer, got "${value}"`);
  return n;
}

function main(): void {
  // `pnpm run sim -- run ...` forwards the `--` literally; parseArgs would then treat every later token as positional.
  const args = process.argv.slice(2);
  if (args[0] === '--') args.shift();
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      generator: { type: 'string', default: 'uniform' },
      agent: { type: 'string', default: 'greedy' },
      games: { type: 'string', default: '100' },
      seed: { type: 'string', default: '1' },
      out: { type: 'string' },
      pool: { type: 'string', default: 'live' },
      opts: { type: 'string' },
      scoring: { type: 'string', default: 'unsupo' },
      'personal-best': { type: 'string', default: '0' },
      'max-turns': { type: 'string', default: '10000' },
      replicates: { type: 'string', default: '40' },
      target: { type: 'string' },
      'games-list': { type: 'string', default: '20,40,80,160' },
      permutations: { type: 'string', default: '2000' },
      samples: { type: 'string', default: '8000' },
      json: { type: 'boolean', default: false },
      quiet: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) usage();
  const cmd = positionals[0];

  if (cmd === 'list') {
    const name = positionals[1];
    const names = name === undefined ? listGenerators() : [name];
    for (const n of names) {
      const d = describeGenerator(n);
      console.log(`${n}: ${d.summary}`);
      console.log(`  control: ${d.control}`);
      for (const [k, v] of Object.entries(d.knobs)) console.log(`  --opts ${k}: ${v}`);
    }
    return;
  }

  if (cmd === 'summary') {
    const file = positionals[1];
    if (file === undefined) usage();
    const summary = summarizeRows(parseJsonl(readFileSync(file, 'utf8')));
    console.log(values.json ? JSON.stringify(summary, null, 2) : formatSummary(summary));
    return;
  }

  const detectorOpts = {
    permutations: int('permutations', values.permutations as string),
    samples: int('samples', values.samples as string),
    alpha: 0.01,
  };

  if (cmd === 'analyze') {
    const file = positionals[1];
    if (file === undefined) usage();
    const records = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as HandRecord);
    const report = runDetector(groupByGame(records), detectorOpts);
    console.log(values.json ? JSON.stringify(report, null, 2) : formatDetector(report));
    return;
  }

  if (cmd === 'validate') {
    const report = validateDetector({
      conditions: defaultZoo(values.agent as string),
      replicates: int('replicates', values.replicates as string),
      games: int('games', values.games as string),
      pool: values.pool as string,
      seed: values.seed as string,
      detector: detectorOpts,
    });
    console.log(values.json ? JSON.stringify(report, null, 2) : formatValidation(report));
    return;
  }

  if (cmd === 'power') {
    const target = values.target;
    if (target === undefined) usage();
    const gamesList = (values['games-list'] as string).split(',').map((s) => int('games-list', s.trim()));
    const curve = powerCurve({
      generator: { name: values.generator as string, ...(values.opts === undefined ? {} : { opts: JSON.parse(values.opts) as Record<string, unknown> }) },
      agent: values.agent as string,
      gamesList,
      replicates: int('replicates', values.replicates as string),
      target,
      pool: values.pool as string,
      seed: values.seed as string,
      detector: detectorOpts,
    });
    console.log(values.json ? JSON.stringify(curve, null, 2) : formatPower(curve, values.generator as string, target));
    return;
  }

  if (cmd !== 'run') usage();
  const out = values.out;
  if (out === undefined) usage();
  const seedRaw = values.seed as string;
  const seed = /^\d+$/.test(seedRaw) ? Number(seedRaw) : seedRaw;
  const opts: RunOptions = {
    generator: { name: values.generator as string, ...(values.opts === undefined ? {} : { opts: JSON.parse(values.opts) as Record<string, unknown> }) },
    agent: values.agent as string,
    games: int('games', values.games as string),
    seed,
    pool: values.pool as string,
    scoring: values.scoring as string,
    personalBest: int('personal-best', values['personal-best'] as string),
    maxTurns: int('max-turns', values['max-turns'] as string),
  };

  const fd = openSync(out, 'w');
  const started = Date.now();
  const collected: ReturnType<typeof parseJsonl> = [];
  try {
    const result = runSim(opts, (rows, _log, index) => {
      writeSync(fd, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
      for (const r of rows) collected.push(r);
      if (!values.quiet && (index + 1) % 100 === 0) console.error(`  ${index + 1}/${opts.games} games, ${collected.length} hands, ${((Date.now() - started) / 1000).toFixed(1)}s`);
    });
    if (!values.quiet) {
      console.error(`wrote ${result.hands} hands from ${result.games} games (${result.truncated} truncated at --max-turns) to ${out} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
      console.error(`generator ${result.generator}, agent ${result.agent}, scoring ${result.scoring}, pool of ${result.pool.length} shapes, seed ${String(seed)}`);
    }
  } finally {
    closeSync(fd);
  }
  console.log(values.json ? JSON.stringify(summarizeRows(collected), null, 2) : formatSummary(summarizeRows(collected)));
}

main();
