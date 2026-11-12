/**
 * Shared types for the engine: hands, placements, game state and the three plug-in
 * interfaces (`Generator`, `Agent`, `GameDriver`) fixed by
 * `docs/research/scouting/04-methodology-review.md` §F.
 */

import type { Board } from './board.ts';
import type { Rng } from './rng.ts';
import type { ShapeId } from './shapes.ts';

/** The ordered triple shown in the tray, slot order left to right. */
export type Hand = readonly [ShapeId, ShapeId, ShapeId];

/** The tray mid-turn: a slot becomes `null` once its piece has been placed. */
export type HandSlots = readonly [ShapeId | null, ShapeId | null, ShapeId | null];

/** A piece placed with its bounding-box top-left at (row, col). */
export interface Placement {
  readonly shapeId: ShapeId;
  readonly row: number;
  readonly col: number;
}

/**
 * Full state of a game between actions. Immutable; the rules functions return new states.
 */
export interface GameState {
  /** Board right now (after the latest placement and clear). */
  readonly board: Board;
  /** Current tray; `null` slots are already placed. */
  readonly hand: HandSlots;
  /** Hand as dealt (for logging the ordered triple even after slots empty). */
  readonly dealtHand: Hand;
  readonly score: number;
  /** Consecutive clearing placements so far (0 after a non-clearing placement). */
  readonly combo: number;
  /** Index of the current hand within the game, 0-based; increments on each deal. */
  readonly turn: number;
  /** The personal best at game start (the real game shows the pre-game best). */
  readonly personalBest: number;
  /** Pieces placed from the current hand (0–3). */
  readonly placedInTurn: number;
  /** Lines cleared by the current hand so far. */
  readonly linesClearedInTurn: number;
  /** Lines cleared over the whole game. */
  readonly totalLinesCleared: number;
  /** Total pieces placed over the whole game. */
  readonly piecesPlaced: number;
  /** True once no remaining piece fits anywhere. */
  readonly gameOver: boolean;
}

/**
 * A piece dealer. Stateful (bag generators, adaptive generators) so it has `reset()` and
 * a serialisable state for logging and replay. `next` is called with the pre-deal state:
 * the board after the previous hand was completed, `hand` all `null`.
 */
export interface Generator {
  readonly name: string;
  /** The shapes this generator can deal, when known. Agents and null models use it. */
  readonly pool?: readonly ShapeId[];
  next(state: GameState, rng: Rng): Hand;
  reset(): void;
  serializeState(): unknown;
}

/** What an agent sees besides the board and remaining pieces. */
export interface AgentContext {
  readonly rng: Rng;
  readonly state: GameState;
  /** The pool the dealer draws from, for "how many shapes still fit" features. */
  readonly pool: readonly ShapeId[];
}

/**
 * A player. Chooses one placement at a time; the engine clears lines between placements
 * and calls again with the remaining pieces. Returning `null` means "no legal move".
 */
export interface Agent {
  readonly name: string;
  choose(board: Board, remainingHand: readonly ShapeId[], context: AgentContext): Placement | null;
}

/** What a driver exposes about the game it is attached to (simulator, emulator, Frida shim). */
export interface Observation {
  readonly board: Board;
  readonly hand: HandSlots;
  readonly score: number;
  readonly combo: number;
  readonly turn: number;
  readonly personalBest: number;
  readonly gameOver: boolean;
}

/**
 * Something that can be played: `SimDriver` here, `AdbDriver` / `FridaDriver` in the capture
 * package. The agent never touches adb; it talks to a driver.
 */
export interface GameDriver {
  readonly name: string;
  observe(): Observation;
  act(placement: Placement): Promise<void>;
}
