/**
 * One-step lookahead: evaluate the board after each legal move and take the best.
 * Features follow `scouting/04-methodology-review.md` §F (lines cleared, holes, how many
 * pool shapes remain placeable) plus board fill. Weights are a reasonable default, not tuned.
 */

import { countHoles, fillCount, placeUnchecked, type Board } from '../board.ts';
import { getShape, type ShapeId } from '../shapes.ts';
import { canPlaceAny } from '../solvability.ts';
import type { Agent, AgentContext, Placement } from '../types.ts';

/** Linear weights of the greedy evaluation. */
export interface GreedyWeights {
  /** Per line cleared by the move. */
  readonly lines: number;
  /** Per pool shape that still has a legal placement afterwards. */
  readonly placeable: number;
  /** Per hole (empty cell with no empty neighbour) afterwards; should be negative. */
  readonly holes: number;
  /** Per filled cell afterwards; should be negative. */
  readonly fill: number;
}

/** Default weights. */
export const DEFAULT_GREEDY_WEIGHTS: GreedyWeights = { lines: 30, placeable: 3, holes: -5, fill: -1 };

/** Evaluate a board for the greedy agent. Higher is better. */
export function evaluateBoard(board: Board, pool: readonly ShapeId[], linesCleared: number, w: GreedyWeights): number {
  let placeable = 0;
  for (const id of pool) if (canPlaceAny(board, id)) placeable++;
  return w.lines * linesCleared + w.placeable * placeable + w.holes * countHoles(board) + w.fill * fillCount(board);
}

/** Greedy one-step lookahead agent. Deterministic: ties go to the first move in scan order. */
export class GreedyAgent implements Agent {
  readonly name = 'greedy';
  private readonly weights: GreedyWeights;

  constructor(weights: GreedyWeights = DEFAULT_GREEDY_WEIGHTS) {
    this.weights = weights;
  }

  choose(board: Board, remainingHand: readonly ShapeId[], context: AgentContext): Placement | null {
    let best: Placement | null = null;
    let bestValue = -Infinity;
    const seen = new Set<ShapeId>();
    for (const id of remainingHand) {
      if (seen.has(id)) continue;
      seen.add(id);
      const shape = getShape(id);
      for (const p of shape.placements) {
        if (((board.lo & p.lo) | (board.hi & p.hi)) !== 0) continue;
        const after = placeUnchecked(board, p);
        const value = evaluateBoard(after.board, context.pool, after.linesCleared, this.weights);
        if (value > bestValue) {
          bestValue = value;
          best = { shapeId: id, row: p.row, col: p.col };
        }
      }
    }
    return best;
  }
}
