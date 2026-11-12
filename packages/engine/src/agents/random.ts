/**
 * Uniformly random over all legal moves. The weakest baseline; it spends many turns on
 * near-full boards, which is exactly where the detector has power (`06-methods.md` §6).
 */

import type { Board } from '../board.ts';
import { legalMoves } from '../rules.ts';
import type { ShapeId } from '../shapes.ts';
import type { Agent, AgentContext, Placement } from '../types.ts';

/** Picks a uniformly random legal (piece, anchor) pair. */
export class RandomAgent implements Agent {
  readonly name = 'random';

  choose(board: Board, remainingHand: readonly ShapeId[], context: AgentContext): Placement | null {
    const moves = legalMoves(board, remainingHand);
    if (moves.length === 0) return null;
    return moves[context.rng.nextInt(moves.length)] as Placement;
  }
}
