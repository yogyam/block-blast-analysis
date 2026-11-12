/**
 * Render a single shape (from the game's table) as a small SVG, for the tray and the piece-set
 * figure. Colour comes from the shared palette.
 */
import { getShape, type ShapeId } from '@blockblast/engine';
import { CELL_PALETTE } from './BoardView.tsx';

export interface PieceViewProps {
  readonly shapeId: ShapeId;
  readonly cell?: number;
  readonly colorIdx?: number;
  readonly selected?: boolean;
  readonly dim?: boolean;
  readonly onClick?: () => void;
}

export function PieceView({ shapeId, cell = 22, colorIdx = 1, selected, dim, onClick }: PieceViewProps) {
  const shape = getShape(shapeId);
  const gap = cell * 0.08;
  const w = shape.width * (cell + gap) + gap;
  const h = shape.height * (cell + gap) + gap;
  const fill = CELL_PALETTE[(colorIdx - 1) % CELL_PALETTE.length];
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`piece ${shape.name}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        opacity: dim ? 0.35 : 1,
        filter: selected ? 'drop-shadow(0 0 0.5px var(--accent))' : undefined,
        outline: selected ? '2px solid var(--accent)' : 'none',
        outlineOffset: 3,
        borderRadius: 6,
      }}
    >
      {shape.cells.map(([r, c], i) => (
        <rect key={i} x={gap + c * (cell + gap)} y={gap + r * (cell + gap)} width={cell} height={cell} rx={cell * 0.18} fill={fill} />
      ))}
    </svg>
  );
}
