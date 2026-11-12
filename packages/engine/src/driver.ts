/**
 * The simulator's {@link GameDriver}: the engine behind the same `observe()` / `act()` surface
 * that the capture package's emulator and Frida drivers expose, so an agent loop can be
 * written once.
 */

import type { Rng } from './rng.ts';
import { createGame, step, type GameConfig } from './rules.ts';
import type { GameDriver, GameState, Observation, Placement } from './types.ts';

/** In-process driver over the pure rules. */
export class SimDriver implements GameDriver {
  readonly name = 'sim';
  private readonly config: GameConfig;
  private readonly rng: Rng;
  private state: GameState;

  constructor(config: GameConfig, rng: Rng) {
    this.config = config;
    this.rng = rng;
    this.state = createGame(config, rng);
  }

  /** The full state (simulator-only; real drivers expose only {@link Observation}). */
  get gameState(): GameState {
    return this.state;
  }

  observe(): Observation {
    const s = this.state;
    return { board: s.board, hand: s.hand, score: s.score, combo: s.combo, turn: s.turn, personalBest: s.personalBest, gameOver: s.gameOver };
  }

  act(placement: Placement): Promise<void> {
    this.state = step(this.state, placement, this.config, this.rng).state;
    return Promise.resolve();
  }

  /** Start a fresh game with the same configuration. */
  reset(): void {
    this.config.generator.reset();
    this.state = createGame(this.config, this.rng);
  }
}
