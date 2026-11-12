/**
 * Render an 8x8 Block Blast board as inline SVG. Reused by every demo. Filled cells can carry a
 * colour (from a parallel colour grid) or fall back to a single accent. Supports a highlight set
 * (a candidate placement) tinted by legality, and per-cell hover/click. Pure and theme-aware.
 */
import { BOARD_SIZE, getCell, type Board } from '@blockblast/engine';

export interface BoardViewProps {
  readonly board: Board;
  /** Optional 64-length colour index per cell (0 = none); maps to the piece palette. */
  readonly colors?: readonly number[];
  readonly size?: number;
  /** Cells to outline (e.g. a hovered placement), as `row*8+col`. */
  readonly highlight?: ReadonlySet<number>;
  /** Colour of the highlight outline (e.g. green when legal, red when not). */
  readonly highlightColor?: string;
  readonly onCell?: (row: number, col: number) => void;
  readonly onHoverCell?: (cell: { row: number; col: number } | null) => void;
}

/** The game's cell palette (brand-neutral, accessible in both themes). */
export const CELL_PALETTE = ['#3b5394', '#e8534e', '#f2b134', '#43b57f', '#8a63d2', '#2ba6c6', '#e07b39', '#d45d9c'] as const;

export function BoardView({ board, colors, size = 320, highlight, highlightColor = 'var(--accent)', onCell, onHoverCell }: BoardViewProps) {
  const gap = size * 0.012;
  const cell = (size - gap * (BOARD_SIZE + 1)) / BOARD_SIZE;
  const rects = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const idx = r * BOARD_SIZE + c;
      const filled = getCell(board, r, c);
      const colorIdx = colors ? colors[idx] ?? 0 : 0;
      const hl = highlight?.has(idx) ?? false;
      const fill = filled ? (colorIdx > 0 ? CELL_PALETTE[(colorIdx - 1) % CELL_PALETTE.length] : 'var(--cell-filled)') : 'var(--cell-empty)';
      rects.push(
        <rect
          key={idx}
          x={gap + c * (cell + gap)}
          y={gap + r * (cell + gap)}
          width={cell}
          height={cell}
          rx={cell * 0.16}
          fill={hl ? highlightColor : fill}
          opacity={hl && !filled ? 0.75 : 1}
          onClick={onCell ? () => onCell(r, c) : undefined}
          onMouseEnter={onHoverCell ? () => onHoverCell({ row: r, col: c }) : undefined}
          style={onCell ? { cursor: 'pointer' } : undefined}
        />,
      );
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Block Blast board"
      onMouseLeave={onHoverCell ? () => onHoverCell(null) : undefined}
    >
      <rect x={0} y={0} width={size} height={size} rx={size * 0.03} fill="var(--board-bg)" />
      {rects}
    </svg>
  );
}
