/**
 * ε-greedy: with probability ε take a uniformly random legal move, otherwise the greedy move.
 * `06-methods.md` §6 wants a deliberately weak agent: it lingers on near-full boards, which is
 * exactly where the rescue/lethal detectors (H2, H4) have power, while remaining a valid policy
 * (the board at turn t is still independent of the hand at turn t under H0; §2).
 */

import type { Board } from '../board.ts';
import { legalMoves } from '../rules.ts';
import type { ShapeId } from '../shapes.ts';
import type { Agent, AgentContext, Placement } from '../types.ts';
import { DEFAULT_GREEDY_WEIGHTS, GreedyAgent, type GreedyWeights } from './greedy.ts';

/** Greedy except that a fraction ε of moves are uniformly random. */
export class EpsilonGreedyAgent implements Agent {
  readonly name: string;
  private readonly epsilon: number;
  private readonly greedy: GreedyAgent;

  constructor(epsilon = 0.25, weights: GreedyWeights = DEFAULT_GREEDY_WEIGHTS) {
    if (!(epsilon >= 0 && epsilon <= 1)) throw new RangeError('epsilon must be in [0, 1]');
    this.epsilon = epsilon;
    this.greedy = new GreedyAgent(weights);
    this.name = `epsilon-greedy(${epsilon})`;
  }

  choose(board: Board, remainingHand: readonly ShapeId[], context: AgentContext): Placement | null {
    if (context.rng.next() < this.epsilon) {
      const moves = legalMoves(board, remainingHand);
      if (moves.length === 0) return null;
      return moves[context.rng.nextInt(moves.length)] as Placement;
    }
    return this.greedy.choose(board, remainingHand, context);
  }
}
