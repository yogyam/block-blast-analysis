/**
 * The zoo as data: name → factory, plus descriptions for reports. The simulator and the detector's
 * validation runs build generators from `{ name, opts }` specs; wrapper generators take a nested
 * `base` spec (default `uniform` over the run's pool).
 */

import { DEFAULT_POOL, isShapeId, type Generator, type ShapeId, type Weights } from '@blockblast/engine';
import { BagGenerator } from './bag.ts';
import { BlockBlastLikeGenerator, type BlockBlastLikeOptions } from './blockBlastLike.ts';
import type { ScoreThreshold } from './common.ts';
import { GuaranteeOneFitsGenerator, GuaranteeSolvableGenerator } from './guarantee.ts';
import { KillGenerator } from './kill.ts';
import { LethalGenerator } from './lethal.ts';
import { MixtureGenerator, type MixtureComponent } from './mixture.ts';
import { PerGameDifficultyGenerator, type DifficultyLevel } from './perGame.ts';
import { ReplayGenerator } from './replay.ts';
import { RescueGenerator } from './rescue.ts';
import { SlotBiasedGenerator } from './slotBiased.ts';
import { UniformGenerator, WeightedGenerator } from './uniform.ts';

/** Free-form options as they arrive from a CLI `--opts` JSON or a validation config. */
export type GeneratorOptions = Readonly<Record<string, unknown>>;

/** Builds a generator from options and the run's pool. */
export type GeneratorFactory = (opts: GeneratorOptions, pool: readonly ShapeId[]) => Generator;

/** A generator by name with options; a bare string means default options. */
export interface GeneratorSpec {
  readonly name: string;
  readonly opts?: GeneratorOptions;
}

/** Documentation of one zoo entry. */
export interface GeneratorInfo {
  readonly summary: string;
  /** Knob → meaning and default. */
  readonly knobs: Readonly<Record<string, string>>;
  /** Which hypotheses of `00-brief.md` it is a synthetic positive (+) or negative (−) control for. */
  readonly control: string;
}

/** What {@link describeGenerator} returns. */
export interface GeneratorDescription extends GeneratorInfo {
  /** The zoo entry name (`rescue` for a generator named `rescue(uniform)`); `unknown` if not in the zoo. */
  readonly kind: string;
  /** The full instance name when an instance was described. */
  readonly name: string;
  readonly pool?: readonly ShapeId[];
  readonly state?: unknown;
}

/** Typed reader over loose options; throws on unknown keys and wrong types. */
class Opts {
  private readonly raw: GeneratorOptions;
  private readonly used = new Set<string>();
  private readonly where: string;

  constructor(raw: GeneratorOptions, where: string) {
    this.raw = raw;
    this.where = where;
  }

  private get(key: string): unknown {
    this.used.add(key);
    return this.raw[key];
  }

  has(key: string): boolean {
    return this.raw[key] !== undefined;
  }

  num(key: string, fallback: number): number {
    const v = this.get(key);
    if (v === undefined) return fallback;
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${this.where}: ${key} must be a finite number`);
    return v;
  }

  optNum(key: string): number | undefined {
    return this.has(key) ? this.num(key, 0) : undefined;
  }

  bool(key: string, fallback: boolean): boolean {
    const v = this.get(key);
    if (v === undefined) return fallback;
    if (typeof v !== 'boolean') throw new TypeError(`${this.where}: ${key} must be a boolean`);
    return v;
  }

  ids(key: string): readonly ShapeId[] | undefined {
    const v = this.get(key);
    if (v === undefined) return undefined;
    if (!Array.isArray(v) || !v.every((x) => Number.isInteger(x) && isShapeId(x))) throw new TypeError(`${this.where}: ${key} must be an array of shape ids`);
    return v as ShapeId[];
  }

  threshold(key: string, fallback: ScoreThreshold): ScoreThreshold {
    return this.optThreshold(key) ?? fallback;
  }

  optThreshold(key: string): ScoreThreshold | undefined {
    const v = this.get(key);
    if (v === undefined) return undefined;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>;
      for (const k of ['absolute', 'fractionOfBest', 'offsetFromBest']) {
        const x = o[k];
        if (typeof x === 'number' && Number.isFinite(x) && Object.keys(o).length === 1) return { [k]: x } as ScoreThreshold;
      }
    }
    throw new TypeError(`${this.where}: ${key} must be a number or {absolute|fractionOfBest|offsetFromBest: number}`);
  }

  spec(key: string): GeneratorSpec | string | undefined {
    const v = this.get(key);
    if (v === undefined) return undefined;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v !== null && typeof (v as { name?: unknown }).name === 'string') return v as GeneratorSpec;
    throw new TypeError(`${this.where}: ${key} must be a generator name or {name, opts}`);
  }

  weights(key: string): Weights | undefined {
    const v = this.get(key);
    if (v === undefined) return undefined;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new TypeError(`${this.where}: ${key} must be an object {id: weight}`);
    const m = new Map<ShapeId, number>();
    for (const [k, w] of Object.entries(v as Record<string, unknown>)) {
      const id = Number(k);
      if (!Number.isInteger(id) || !isShapeId(id) || typeof w !== 'number') throw new TypeError(`${this.where}: ${key} has a bad entry ${k}: ${String(w)}`);
      m.set(id, w);
    }
    return m;
  }

  levels(key: string, fallback: ReadonlyArray<number | DifficultyLevel>): ReadonlyArray<number | DifficultyLevel> {
    const v = this.get(key);
    if (v === undefined) return fallback;
    if (!Array.isArray(v) || v.length === 0) throw new TypeError(`${this.where}: ${key} must be a non-empty array`);
    return v.map((l: unknown) => {
      if (typeof l === 'number') return l;
      if (typeof l === 'object' && l !== null && typeof (l as { multiplier?: unknown }).multiplier === 'number') return l as DifficultyLevel;
      throw new TypeError(`${this.where}: ${key} entries must be numbers or {multiplier, weight?}`);
    });
  }

  components(key: string): ReadonlyArray<{ readonly spec: GeneratorSpec | string; readonly weight: number }> {
    const v = this.get(key);
    if (!Array.isArray(v) || v.length === 0) throw new TypeError(`${this.where}: ${key} must be a non-empty array of {name, opts?, weight}`);
    return v.map((c: unknown) => {
      if (typeof c !== 'object' || c === null) throw new TypeError(`${this.where}: ${key} entries must be objects`);
      const o = c as Record<string, unknown>;
      const weight = typeof o['weight'] === 'number' ? o['weight'] : 1;
      if (typeof o['name'] !== 'string') throw new TypeError(`${this.where}: ${key} entries need a name`);
      const spec: GeneratorSpec = { name: o['name'], ...(o['opts'] === undefined ? {} : { opts: o['opts'] as GeneratorOptions }) };
      return { spec, weight };
    });
  }

  hands(key: string): ReadonlyArray<readonly [ShapeId, ShapeId, ShapeId]> {
    const v = this.get(key);
    if (!Array.isArray(v)) throw new TypeError(`${this.where}: ${key} must be an array of [id, id, id]`);
    return v as ReadonlyArray<readonly [ShapeId, ShapeId, ShapeId]>;
  }

  /** Throw if any option was neither read nor known. */
  done(): void {
    const unknown = Object.keys(this.raw).filter((k) => !this.used.has(k));
    if (unknown.length > 0) throw new Error(`${this.where}: unknown option(s) ${unknown.join(', ')}`);
  }
}

function base(o: Opts, pool: readonly ShapeId[]): Generator {
  return buildGenerator(o.spec('base') ?? 'uniform', pool);
}

const BASE_KNOB = 'nested {name, opts} spec of the wrapped dealer (default uniform over the run pool)';

interface Entry extends GeneratorInfo {
  readonly factory: GeneratorFactory;
}

const ENTRIES: Readonly<Record<string, Entry>> = {
  uniform: {
    summary: 'Three independent uniform draws from the pool (H0, the null).',
    knobs: {},
    control: 'null for everything; must not reject H1–H5',
    factory: (opts, pool) => {
      new Opts(opts, 'uniform').done();
      return new UniformGenerator(pool);
    },
  },
  weighted: {
    summary: 'Three independent draws from a fixed non-uniform marginal.',
    knobs: { weights: '{id: weight} (required); the pool is the positively weighted ids' },
    control: '− H1–H4 (board- and history-independent); − H5',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'weighted');
      const w = o.weights('weights');
      o.done();
      if (w === undefined) {
        const m = new Map<ShapeId, number>();
        pool.forEach((id, i) => m.set(id, 1 + (i % 3)));
        return new WeightedGenerator(m);
      }
      return new WeightedGenerator(w);
    },
  },
  bag: {
    summary: 'Shuffle the pool, deal sequentially, reshuffle when exhausted; hands span bags.',
    knobs: {},
    control: '− H1–H4; + H5 (no repeats within a bag, lag-k dependence)',
    factory: (opts, pool) => {
      new Opts(opts, 'bag').done();
      return new BagGenerator(pool);
    },
  },
  'guarantee-one-fits': {
    summary: 'Redraw from the base until some piece fits; cap attempts, then substitute a small fitting piece.',
    knobs: { base: BASE_KNOB, maxAttempts: 'redraws before the fallback (default 50)' },
    control: '+ H1 (fits), + H2 (Z > 0 on "some piece fits"); not H3',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'guarantee-one-fits');
      const b = base(o, pool);
      const maxAttempts = o.num('maxAttempts', 50);
      o.done();
      return new GuaranteeOneFitsGenerator(b, { maxAttempts });
    },
  },
  'guarantee-solvable': {
    summary: 'Redraw from the base until the oracle says the hand is fully placeable; cap attempts, then construct one.',
    knobs: { base: BASE_KNOB, maxAttempts: 'redraws before the constructive fallback (default 200)', maxNodes: 'fallback search budget (default 20000)' },
    control: '+ H1, + H2 (Z > 0 on "solvable"), + H4 (Λ > 1, Z > 0 on "fits"); not H3',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'guarantee-solvable');
      const b = base(o, pool);
      const maxAttempts = o.num('maxAttempts', 200);
      const maxNodes = o.num('maxNodes', 20_000);
      o.done();
      return new GuaranteeSolvableGenerator(b, { maxAttempts, maxNodes });
    },
  },
  rescue: {
    summary: 'Above a fill threshold, with probability strength, replace the hand with a solvable one biased toward pieces that fit.',
    knobs: {
      base: BASE_KNOB,
      fillThreshold: 'board fill fraction at or above which rescue may fire (default 0.5)',
      strength: 'probability of rescuing an eligible deal (default 1)',
      fitBias: 'weight multiplier on pieces that fit now (default 8)',
      maxAttempts: 'rejection attempts (default 200)',
      maxNodes: 'fallback search budget (default 20000)',
    },
    control: '+ H2 (near-full stratum, Z > 0), + H4 (Λ > 1), + H1; must not light H3',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'rescue');
      const b = base(o, pool);
      const r = new RescueGenerator(b, {
        fillThreshold: o.num('fillThreshold', 0.5),
        strength: o.num('strength', 1),
        fitBias: o.num('fitBias', 8),
        maxAttempts: o.num('maxAttempts', 200),
        maxNodes: o.num('maxNodes', 20_000),
      });
      o.done();
      return r;
    },
  },
  kill: {
    summary: 'Past a score threshold, multiply the odds of hard pieces by hardBias (still i.i.d. from the pool).',
    knobs: {
      base: BASE_KNOB,
      scoreThreshold: 'number (absolute) or {absolute|fractionOfBest|offsetFromBest} (default {fractionOfBest: 0.93})',
      hardBias: 'weight multiplier on hard pieces past the threshold (default 4)',
      hardIds: 'ids counted as hard (default the game\'s 18-id list)',
    },
    control: '+ H3 (hard-piece OR > 1 near the record), + H4 (Z < 0); − H1 board features, − H5',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'kill');
      const b = base(o, pool);
      const hardIds = o.ids('hardIds');
      const k = new KillGenerator(b, {
        scoreThreshold: o.threshold('scoreThreshold', { fractionOfBest: 0.93 }),
        hardBias: o.num('hardBias', 4),
        ...(hardIds === undefined ? {} : { hardIds }),
      });
      o.done();
      return k;
    },
  },
  lethal: {
    summary: 'With probability p (optionally past a score), deal a two-fit-one-not unsolvable hand if one exists, else the base.',
    knobs: {
      base: BASE_KNOB,
      probability: 'chance of running the lethal search per eligible deal (default 0.2)',
      scoreThreshold: 'optional eligibility threshold (default: always eligible)',
      pool: 'search pool (default the base pool; the game uses ids 2–42)',
      maxTriples: 'search budget per deal (default 2000)',
      timeBudgetMs: 'optional wall-clock budget (non-deterministic)',
      shuffleSlots: 'shuffle a found hand\'s slots instead of [a, b, u] (default false)',
    },
    control: '+ H4 (Z < 0, Λ < 1, two-fit-one-not signature), + H1; not H2/H3',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'lethal');
      const b = base(o, pool);
      const searchPool = o.ids('pool');
      const threshold = o.optThreshold('scoreThreshold');
      const timeBudgetMs = o.optNum('timeBudgetMs');
      const g = new LethalGenerator(b, {
        probability: o.num('probability', 0.2),
        maxTriples: o.num('maxTriples', 2000),
        shuffleSlots: o.bool('shuffleSlots', false),
        ...(searchPool === undefined ? {} : { pool: searchPool }),
        ...(threshold === undefined ? {} : { scoreThreshold: threshold }),
        ...(timeBudgetMs === undefined ? {} : { timeBudgetMs }),
      });
      o.done();
      return g;
    },
  },
  'per-game-difficulty': {
    summary: 'Pick a hard-piece weight multiplier once per game, then deal i.i.d.',
    knobs: {
      base: BASE_KNOB,
      levels: 'multipliers, numbers or {multiplier, weight} (default [0.5, 1, 2, 4])',
      hardIds: 'ids counted as hard (default the game\'s 18-id list)',
    },
    control: '+ H6 companion (per-game overdispersion); − per-turn H1–H4',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'per-game-difficulty');
      const b = base(o, pool);
      const hardIds = o.ids('hardIds');
      const g = new PerGameDifficultyGenerator(b, { levels: o.levels('levels', [0.5, 1, 2, 4]), ...(hardIds === undefined ? {} : { hardIds }) });
      o.done();
      return g;
    },
  },
  'slot-biased': {
    summary: 'Deal from the base, then sort the hand so the left slot holds the smallest piece.',
    knobs: { base: BASE_KNOB, strength: 'probability of sorting a hand (default 1)' },
    control: '+ H5 slot-position test; − everything else',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'slot-biased');
      const b = base(o, pool);
      const g = new SlotBiasedGenerator(b, { strength: o.num('strength', 1) });
      o.done();
      return g;
    },
  },
  mixture: {
    summary: 'Per hand, choose one component generator by weight.',
    knobs: { components: '[{name, opts?, weight}] (required)' },
    control: 'whatever its components are; used for weak/strong settings',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'mixture');
      const comps: MixtureComponent[] = o.components('components').map((c) => ({ generator: buildGenerator(c.spec, pool), weight: c.weight }));
      o.done();
      return new MixtureGenerator(comps);
    },
  },
  replay: {
    summary: 'Replay a logged sequence of hands; throws when exhausted unless loop is set.',
    knobs: { hands: '[[id, id, id], ...] (required)', loop: 'start over when exhausted (default false)' },
    control: 'none; replays captured games through the engine',
    factory: (opts) => {
      const o = new Opts(opts, 'replay');
      const g = new ReplayGenerator(o.hands('hands'), { loop: o.bool('loop', false) });
      o.done();
      return g;
    },
  },
  'blockblast-like': {
    summary: 'Approximation of the observed live dealer: filtered safe early game, lethal search requested every late deal, hard-but-solvable hands dealt instead (a model, not the game\'s code).',
    knobs: {
      pool: 'unfiltered pool (default the run pool, i.e. ids 2–31 when --pool live)',
      filterIds: 'early-game filter (default [11,12,13,21,22,23,24,39,40,41])',
      lethalPool: 'lethal search pool (default ids 2–42 minus 41)',
      earlyUntil: 'end of the filtered early game (default 600)',
      lethalFrom: 'lethal search requested from here (default 800)',
      lethalProbability: 'request probability per late deal (default 1.0)',
      dealLethal: 'probability of dealing a found lethal hand (default 0)',
      hardIds: 'hard ids for the hard-but-solvable hand (default the game\'s 18-id list)',
      hardBias: 'hard-piece weight multiplier (default 3, not observed)',
      fitBias: 'early-game fit bias (default 4, not observed)',
      maxAttempts: 'placeability-guarantee attempts (default 200)',
      maxNodes: 'constructive fallback budget (default 20000)',
      lethalMaxTriples: 'lethal search budget (default 2000)',
      shuffleLethalSlots: 'shuffle dealt lethal hands (default false)',
    },
    control: 'mirror of the live dealer: + H1, + H2/H4 (Λ > 1) while dealLethal = 0, + H3 (hard bias late), + H4 (Z < 0) when dealLethal > 0',
    factory: (opts, pool) => {
      const o = new Opts(opts, 'blockblast-like');
      const filterIds = o.ids('filterIds');
      const lethalPool = o.ids('lethalPool');
      const hardIds = o.ids('hardIds');
      const earlyUntil = o.optThreshold('earlyUntil');
      const lethalFrom = o.optThreshold('lethalFrom');
      const bb: BlockBlastLikeOptions = {
        pool: o.ids('pool') ?? pool,
        ...(filterIds === undefined ? {} : { filterIds }),
        ...(lethalPool === undefined ? {} : { lethalPool }),
        ...(hardIds === undefined ? {} : { hardIds }),
        ...(earlyUntil === undefined ? {} : { earlyUntil }),
        ...(lethalFrom === undefined ? {} : { lethalFrom }),
        ...(o.has('lethalProbability') ? { lethalProbability: o.num('lethalProbability', 1) } : {}),
        ...(o.has('dealLethal') ? { dealLethal: o.num('dealLethal', 0) } : {}),
        ...(o.has('hardBias') ? { hardBias: o.num('hardBias', 3) } : {}),
        ...(o.has('fitBias') ? { fitBias: o.num('fitBias', 4) } : {}),
        ...(o.has('maxAttempts') ? { maxAttempts: o.num('maxAttempts', 200) } : {}),
        ...(o.has('maxNodes') ? { maxNodes: o.num('maxNodes', 20_000) } : {}),
        ...(o.has('lethalMaxTriples') ? { lethalMaxTriples: o.num('lethalMaxTriples', 2000) } : {}),
        ...(o.has('shuffleLethalSlots') ? { shuffleLethalSlots: o.bool('shuffleLethalSlots', false) } : {}),
      };
      o.done();
      return new BlockBlastLikeGenerator(bb);
    },
  },
};

/** name → factory(opts, pool). */
export const GENERATOR_ZOO: Readonly<Record<string, GeneratorFactory>> = Object.fromEntries(Object.entries(ENTRIES).map(([k, e]) => [k, e.factory]));

/** name → documentation. */
export const GENERATOR_INFO: Readonly<Record<string, GeneratorInfo>> = Object.fromEntries(
  Object.entries(ENTRIES).map(([k, e]) => [k, { summary: e.summary, knobs: e.knobs, control: e.control }]),
);

/** Names in the zoo. */
export function listGenerators(): string[] {
  return Object.keys(ENTRIES);
}

/** Build a generator from a spec (or bare name) over a pool. Throws on unknown names or options. */
export function buildGenerator(spec: GeneratorSpec | string, pool: readonly ShapeId[] = DEFAULT_POOL): Generator {
  const s: GeneratorSpec = typeof spec === 'string' ? { name: spec } : spec;
  const factory = GENERATOR_ZOO[s.name];
  if (factory === undefined) throw new Error(`unknown generator "${s.name}"; known: ${listGenerators().join(', ')}`);
  return factory(s.opts ?? {}, pool);
}

/** The zoo entry an instance name refers to: `rescue(uniform)` → `rescue`. */
export function kindOf(name: string): string {
  const paren = name.indexOf('(');
  return paren < 0 ? name : name.slice(0, paren);
}

/** Describe a zoo entry by name, or an instance (adding its pool and serialised state). */
export function describeGenerator(target: string | Generator): GeneratorDescription {
  const name = typeof target === 'string' ? target : target.name;
  const kind = kindOf(name);
  const info = GENERATOR_INFO[kind] ?? { summary: 'not a zoo generator', knobs: {}, control: 'unknown' };
  const out: GeneratorDescription = { kind: GENERATOR_INFO[kind] === undefined ? 'unknown' : kind, name, ...info };
  if (typeof target === 'string') return out;
  return {
    ...out,
    ...(target.pool === undefined ? {} : { pool: target.pool }),
    state: target.serializeState(),
  };
}
