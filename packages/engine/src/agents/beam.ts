/**
 * Beam search over the orderings and placements of the current hand. `choose` returns one
 * placement at a time (the engine clears between placements and calls again), so each call
 * re-plans the remaining pieces and returns the first move of the best plan found. A plan is
 * ranked by (pieces placed, total lines cleared, board evaluation), so it prefers to empty the
 * whole hand, then to clear lines, then to leave a healthy board. Deterministic: ties resolve
 * to scan order.
 *
 * This is the strong baseline of `06-methods.md` §6/§7: against a fair dealer it survives far
 * longer than greedy, which sets the ceiling the real dealer is measured against.
 */

import { placeUnchecked, type Board } from '../board.ts';
import { getShape, type ShapeId } from '../shapes.ts';
import type { Agent, AgentContext, Placement } from '../types.ts';
import { DEFAULT_GREEDY_WEIGHTS, evaluateBoard, type GreedyWeights } from './greedy.ts';

interface Plan {
  readonly board: Board;
  /** Remaining pieces still to place, sorted for canonical duplicate handling. */
  readonly remaining: readonly ShapeId[];
  readonly first: Placement | null;
  readonly placed: number;
  readonly lines: number;
  /** Evaluation of the current board (recomputed as the plan grows). */
  readonly value: number;
}

/** Beam search over a hand's placements. */
export class BeamSearchAgent implements Agent {
  readonly name: string;
  private readonly width: number;
  private readonly weights: GreedyWeights;

  constructor(width = 20, weights: GreedyWeights = DEFAULT_GREEDY_WEIGHTS) {
    if (!Number.isInteger(width) || width < 1) throw new RangeError('width must be a positive integer');
    this.width = width;
    this.weights = weights;
    this.name = `beam(${width})`;
  }

  choose(board: Board, remainingHand: readonly ShapeId[], context: AgentContext): Placement | null {
    const pool = context.pool;
    const start: Plan = {
      board,
      remaining: [...remainingHand].sort((a, b) => a - b),
      first: null,
      placed: 0,
      lines: 0,
      value: 0,
    };
    let frontier: Plan[] = [start];
    let best: Plan | null = null;

    while (frontier.length > 0) {
      const next: Plan[] = [];
      for (const plan of frontier) {
        if (plan.remaining.length === 0) {
          best = better(best, plan);
          continue;
        }
        let expanded = false;
        for (let i = 0; i < plan.remaining.length; i++) {
          const id = plan.remaining[i] as ShapeId;
          if (i > 0 && plan.remaining[i - 1] === id) continue; // duplicate piece: same subtree
          const shape = getShape(id);
          const rest = plan.remaining.filter((_, j) => j !== i);
          for (const p of shape.placements) {
            if (((plan.board.lo & p.lo) | (plan.board.hi & p.hi)) !== 0) continue;
            const after = placeUnchecked(plan.board, p);
            const move: Placement = { shapeId: id, row: p.row, col: p.col };
            expanded = true;
            next.push({
              board: after.board,
              remaining: rest,
              first: plan.first ?? move,
              placed: plan.placed + 1,
              lines: plan.lines + after.linesCleared,
              value: evaluateBoard(after.board, pool, after.linesCleared, this.weights),
            });
          }
        }
        // A plan that can place nothing more is a candidate ending here (dead board).
        if (!expanded) best = better(best, plan);
      }
      next.sort((a, b) => b.value - a.value);
      frontier = next.slice(0, this.width);
    }

    return best?.first ?? null;
  }
}

/** Prefer more pieces placed, then more lines cleared, then a better board; keep the incumbent on ties. */
function better(incumbent: Plan | null, candidate: Plan): Plan {
  if (incumbent === null) return candidate;
  if (candidate.placed !== incumbent.placed) return candidate.placed > incumbent.placed ? candidate : incumbent;
  if (candidate.lines !== incumbent.lines) return candidate.lines > incumbent.lines ? candidate : incumbent;
  return candidate.value > incumbent.value ? candidate : incumbent;
}
