/**
 * A playable Block Blast board with a visibly fair (uniform) dealer. Click a tray piece, then a
 * board cell to drop it with its top-left there; a hover preview shows legality (green/red). Score,
 * hands and a "pieces that fit" readout update live. This is the §2 demo: the real rules, fair deal.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  BOARD_SIZE,
  countLegalMoves,
  createGame,
  DEFAULT_SCORING,
  dealHand,
  getShape,
  isLegalPlacement,
  needsDeal,
  placePiece,
  remainingHand,
  seedRng,
  TEN_TEN_POOL,
  UniformGenerator,
  type GameState,
  type Rng,
  type ShapeId,
} from '@blockblast/engine';
import { BoardView } from './BoardView.tsx';
import { PieceView } from './PieceView.tsx';

const POOL = TEN_TEN_POOL; // the familiar 19-piece set, friendlier for a hands-on demo

function freshGame(seed: number): { state: GameState; rng: Rng; gen: UniformGenerator } {
  const gen = new UniformGenerator(POOL);
  const rng = seedRng(seed);
  const state = createGame({ generator: gen, scoring: DEFAULT_SCORING }, rng);
  return { state, rng, gen };
}

export function MiniBoard() {
  const seedRef = useRef(1);
  const game = useRef(freshGame(seedRef.current));
  const [state, setState] = useState<GameState>(game.current.state);
  const [sel, setSel] = useState<number>(0);
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

  const hand = state.hand;
  const distinctRemaining = useMemo(() => new Set(remainingHand(state)), [state]);
  const fitCount = useMemo(() => {
    let n = 0;
    for (const id of distinctRemaining) if (countLegalMoves(state.board, [id]) > 0) n++;
    return n;
  }, [state.board, distinctRemaining]);

  const selectedId: ShapeId | null = (hand[sel] as ShapeId | null) ?? null;

  const preview = useMemo(() => {
    if (selectedId === null || hover === null) return { set: new Set<number>(), legal: false };
    const set = new Set<number>();
    let inBounds = true;
    for (const [dr, dc] of getShape(selectedId).cells) {
      const r = hover.row + dr;
      const c = hover.col + dc;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) inBounds = false;
      else set.add(r * BOARD_SIZE + c);
    }
    const legal = inBounds && isLegalPlacement(state.board, { shapeId: selectedId, row: hover.row, col: hover.col });
    return { set, legal };
  }, [selectedId, hover, state.board]);

  const place = useCallback(
    (row: number, col: number) => {
      if (selectedId === null || state.gameOver) return;
      if (!isLegalPlacement(state.board, { shapeId: selectedId, row, col })) return;
      const outcome = placePiece(state, { shapeId: selectedId, row, col }, DEFAULT_SCORING);
      let next = outcome.state;
      if (!next.gameOver && needsDeal(next)) next = dealHand(next, game.current.gen, game.current.rng);
      setHover(null);
      // move selection to the next non-empty slot
      const nextSel = [0, 1, 2].find((s) => next.hand[s] !== null) ?? 0;
      setSel(nextSel);
      setState(next);
    },
    [sel, selectedId, state],
  );

  const reset = useCallback(() => {
    seedRef.current += 1;
    game.current = freshGame(seedRef.current);
    setState(game.current.state);
    setSel([0, 1, 2].find((s) => game.current.state.hand[s] !== null) ?? 0);
    setHover(null);
  }, []);

  return (
    <div className="miniboard">
      <div className="mb-stats">
        <span><strong>{state.score}</strong> score</span>
        <span><strong>{state.turn + 1}</strong> hands</span>
        <span className={fitCount === 0 ? 'danger' : ''}>
          <strong>{fitCount}</strong>/{distinctRemaining.size} pieces fit
        </span>
      </div>
      <BoardView
        board={state.board}
        size={320}
        highlight={preview.set}
        highlightColor={preview.legal ? 'var(--ok)' : 'var(--danger)'}
        onCell={place}
        onHoverCell={setHover}
      />
      <div className="mb-tray">
        {[0, 1, 2].map((slot) => {
          const id = hand[slot] as ShapeId | null;
          return (
            <div key={slot} className={`mb-slot ${sel === slot && id !== null ? 'active' : ''}`}>
              {id !== null ? (
                <PieceView shapeId={id} colorIdx={slot + 1} selected={sel === slot} onClick={() => setSel(slot)} />
              ) : (
                <span className="mb-placed">✓</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mb-controls">
        {state.gameOver ? (
          <span className="mb-over">No move left. Dealt out after {state.turn + 1} hands, {state.score} points.</span>
        ) : (
          <span className="mb-hint">Pick a piece, then click the board. Its top-left lands where you click.</span>
        )}
        <button onClick={reset}>New game</button>
      </div>
    </div>
  );
}
