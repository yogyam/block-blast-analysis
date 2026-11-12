import { EMPTY_BOARD, TEN_TEN_POOL, board, fromRows, type Board, type GameState, type Generator, type Hand, type Rng } from '@blockblast/engine';
import type { GeneratorSpec } from '../src/registry.ts';

/** A pre-deal state (tray empty) on a board with optional score context. */
export function preDealState(b: Board, extra: Partial<Pick<GameState, 'score' | 'personalBest' | 'turn' | 'combo'>> = {}): GameState {
  return {
    board: b,
    hand: [null, null, null],
    dealtHand: [0, 0, 0],
    score: extra.score ?? 0,
    combo: extra.combo ?? 0,
    turn: extra.turn ?? 0,
    personalBest: extra.personalBest ?? 0,
    placedInTurn: 0,
    linesClearedInTurn: 0,
    totalLinesCleared: 0,
    piecesPlaced: 0,
    gameOver: false,
  };
}

/** Random board with each cell filled independently with probability `fill`. */
export function randomBoard(rng: Rng, fill: number): Board {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 32; i++) if (rng.next() < fill) lo |= 1 << i;
  for (let i = 0; i < 32; i++) if (rng.next() < fill) hi |= 1 << i;
  return board(lo >>> 0, hi >>> 0);
}

/** `n` random boards with fill fractions spread over [lo, hi]. */
export function randomBoards(rng: Rng, n: number, lo = 0, hi = 0.75): Board[] {
  const out: Board[] = [];
  for (let i = 0; i < n; i++) out.push(randomBoard(rng, lo + ((hi - lo) * i) / Math.max(1, n - 1)));
  return out;
}

/** Reset, then deal once per board (score rising 20 per deal), returning hands and JSON-able states. */
export function dealSequence(gen: Generator, boards: readonly Board[], rng: Rng, personalBest = 0): { hands: Hand[]; states: unknown[] } {
  gen.reset();
  const hands: Hand[] = [];
  const states: unknown[] = [];
  boards.forEach((b, i) => {
    hands.push(gen.next(preDealState(b, { score: i * 20, turn: i, personalBest }), rng));
    states.push(JSON.parse(JSON.stringify(gen.serializeState())));
  });
  return { hands, states };
}

/** Checkerboard with (0,0)/(0,1) both open: a horizontal domino fits exactly once, a 1x1 anywhere. */
export const LETHAL_BOARD: Board = fromRows(['..#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#']);

/** One representative spec per zoo entry, with options that exercise its branches. */
export const SPECS: readonly GeneratorSpec[] = [
  { name: 'uniform' },
  { name: 'weighted', opts: { weights: { 1: 3, 3: 1, 9: 2, 13: 1 } } },
  { name: 'bag' },
  { name: 'guarantee-one-fits' },
  { name: 'guarantee-solvable' },
  { name: 'rescue', opts: { fillThreshold: 0.3, strength: 0.7 } },
  { name: 'kill', opts: { scoreThreshold: 40, hardBias: 4 } },
  { name: 'lethal', opts: { probability: 0.8 } },
  { name: 'per-game-difficulty' },
  { name: 'slot-biased', opts: { strength: 0.8 } },
  { name: 'mixture', opts: { components: [{ name: 'uniform', weight: 1 }, { name: 'lethal', opts: { probability: 1 }, weight: 1 }, { name: 'bag', weight: 2 }] } },
  { name: 'replay', opts: { hands: [[1, 2, 3], [4, 5, 6], [9, 9, 9]], loop: true } },
  { name: 'blockblast-like', opts: { earlyUntil: 100, lethalFrom: 200, dealLethal: 0.5 } },
];

export { EMPTY_BOARD, TEN_TEN_POOL };
