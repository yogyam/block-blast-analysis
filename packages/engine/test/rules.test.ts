import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, FULL_BOARD, fromRows, setCell, toRows } from '../src/board.ts';
import { seedRng } from '../src/rng.ts';
import {
  CellsOnlyScoring,
  KittimzheScoring,
  UnsupoScoring,
  countLegalMoves,
  createGame,
  dealHand,
  isLegalPlacement,
  isTerminal,
  legalMoves,
  legalPlacements,
  needsDeal,
  placePiece,
  remainingHand,
  step,
  type ScoringInput,
} from '../src/rules.ts';
import { UniformGenerator } from '../src/generators/uniform.ts';
import { TEN_TEN_POOL } from '../src/shapes.ts';
import { CHECKERBOARD, ScriptedGenerator } from './helpers.ts';

const input = (cellsPlaced: number, linesCleared: number, comboBefore: number, boardEmptyAfter = false): ScoringInput => ({
  cellsPlaced,
  linesCleared,
  rowsCleared: linesCleared,
  colsCleared: 0,
  comboBefore,
  boardEmptyAfter,
  fillAfter: boardEmptyAfter ? 0 : 10,
});

describe('scoring candidates', () => {
  it('UnsupoScoring reproduces the worked table: 10, 120, 1280', () => {
    expect(UnsupoScoring.score(input(0, 1, 0))).toEqual({ points: 10, comboAfter: 1 });
    expect(UnsupoScoring.score(input(0, 2, 2))).toEqual({ points: 120, comboAfter: 3 });
    expect(UnsupoScoring.score(input(0, 4, 7))).toEqual({ points: 1280, comboAfter: 8 });
    expect(UnsupoScoring.score(input(4, 0, 5))).toEqual({ points: 4, comboAfter: 0 });
    expect(UnsupoScoring.score(input(3, 1, 0))).toEqual({ points: 13, comboAfter: 1 });
  });

  it('KittimzheScoring: progressive lines, capped multiplier, perfect clear', () => {
    expect(KittimzheScoring.score(input(0, 1, 0)).points).toBe(10);
    expect(KittimzheScoring.score(input(0, 2, 0)).points).toBe(30);
    expect(KittimzheScoring.score(input(0, 3, 0)).points).toBe(60);
    expect(KittimzheScoring.score(input(0, 1, 1)).points).toBe(15); // n=2 → ×1.5
    expect(KittimzheScoring.score(input(0, 1, 6)).points).toBe(40); // n=7 → ×4 (uncapped 4)
    expect(KittimzheScoring.score(input(0, 1, 20)).points).toBe(40); // capped at ×4
    expect(KittimzheScoring.score(input(1, 1, 0, true)).points).toBe(1 + 10 + 300);
    expect(KittimzheScoring.score(input(5, 0, 3))).toEqual({ points: 5, comboAfter: 0 });
  });

  it('CellsOnlyScoring tracks the streak without scoring it', () => {
    expect(CellsOnlyScoring.score(input(4, 2, 1))).toEqual({ points: 4, comboAfter: 2 });
    expect(CellsOnlyScoring.score(input(4, 0, 1))).toEqual({ points: 4, comboAfter: 0 });
  });
});

describe('turn loop', () => {
  const twoNearlyFullRows = fromRows(['#######.', '#######.', '........', '........', '........', '........', '........', '........']);

  it('builds a combo on consecutive clears and resets on a non-clearing placement', () => {
    const gen = new ScriptedGenerator([[1, 1, 1]]);
    let s = createGame({ generator: gen, scoring: UnsupoScoring, initialBoard: twoNearlyFullRows }, seedRng(0));
    expect(s.combo).toBe(0);
    expect(s.gameOver).toBe(false);

    let o = placePiece(s, { shapeId: 1, row: 0, col: 7 }, UnsupoScoring);
    expect(o.linesCleared).toBe(1);
    expect(o.rowMask).toBe(1);
    s = o.state;
    expect(s.combo).toBe(1);
    expect(s.score).toBe(11);
    expect(s.hand).toEqual([null, 1, 1]);
    expect(s.placedInTurn).toBe(1);

    o = placePiece(s, { shapeId: 1, row: 1, col: 7 }, UnsupoScoring);
    s = o.state;
    expect(s.combo).toBe(2);
    expect(s.score).toBe(11 + 1 + 10 * 1 * 1 * 2);
    expect(s.linesClearedInTurn).toBe(2);

    o = placePiece(s, { shapeId: 1, row: 5, col: 5 }, UnsupoScoring);
    s = o.state;
    expect(o.linesCleared).toBe(0);
    expect(s.combo).toBe(0);
    expect(s.score).toBe(33);
    expect(s.hand).toEqual([null, null, null]);
    expect(needsDeal(s)).toBe(true);
    expect(s.totalLinesCleared).toBe(2);
    expect(s.piecesPlaced).toBe(3);

    const dealt = dealHand(s, gen, seedRng(0));
    expect(dealt.turn).toBe(1);
    expect(dealt.hand).toEqual([1, 1, 1]);
    expect(dealt.combo).toBe(0);
    expect(dealt.placedInTurn).toBe(0);
    expect(dealt.linesClearedInTurn).toBe(0);
    expect(toRows(dealt.board)[5]).toBe('.....#..');
  });

  it('step() deals automatically when the tray empties', () => {
    const gen = new ScriptedGenerator([[1, 1, 1], [9, 9, 9]]);
    const config = { generator: gen, scoring: CellsOnlyScoring };
    const rng = seedRng(1);
    let s = createGame(config, rng);
    s = step(s, { shapeId: 1, row: 0, col: 0 }, config, rng).state;
    s = step(s, { shapeId: 1, row: 0, col: 2 }, config, rng).state;
    expect(s.turn).toBe(0);
    s = step(s, { shapeId: 1, row: 0, col: 4 }, config, rng).state;
    expect(s.turn).toBe(1);
    expect(s.hand).toEqual([9, 9, 9]);
    expect(s.score).toBe(3);
  });

  it('rejects illegal placements and pieces not in the tray', () => {
    const gen = new ScriptedGenerator([[13, 3, 5]]);
    const s = createGame({ generator: gen, scoring: UnsupoScoring }, seedRng(0));
    expect(() => placePiece(s, { shapeId: 13, row: 6, col: 0 }, UnsupoScoring)).toThrow(RangeError);
    expect(() => placePiece(s, { shapeId: 9, row: 0, col: 0 }, UnsupoScoring)).toThrow(/not in the tray/);
    const blocked = { ...s, board: setCell(EMPTY_BOARD, 1, 1, true) };
    expect(() => placePiece(blocked, { shapeId: 13, row: 0, col: 0 }, UnsupoScoring)).toThrow(/illegal/);
    expect(isLegalPlacement(blocked.board, { shapeId: 13, row: 0, col: 0 })).toBe(false);
    expect(isLegalPlacement(blocked.board, { shapeId: 13, row: 2, col: 2 })).toBe(true);
    expect(isLegalPlacement(blocked.board, { shapeId: 13, row: 6, col: 6 })).toBe(false);
  });

  it('is terminal at deal time when nothing fits, and mid-hand when the remainder does not fit', () => {
    const oneHole = setCell(FULL_BOARD, 4, 4, false);
    expect(isTerminal(oneHole, [1, 3, 13])).toBe(false);
    expect(isTerminal(oneHole, [3, 13, 9])).toBe(true);
    expect(isTerminal(EMPTY_BOARD, [])).toBe(true);

    const gen = new ScriptedGenerator([[3, 13, 9]]);
    const dead = createGame({ generator: gen, scoring: UnsupoScoring, initialBoard: oneHole }, seedRng(0));
    expect(dead.gameOver).toBe(true);
    expect(() => placePiece(dead, { shapeId: 3, row: 0, col: 0 }, UnsupoScoring)).toThrow(/over/);

    // Checkerboard: a 1x1 fits, the two dominoes never will; placing the 1x1 ends the game mid-hand.
    const gen2 = new ScriptedGenerator([[1, 3, 3]]);
    const s = createGame({ generator: gen2, scoring: UnsupoScoring, initialBoard: CHECKERBOARD }, seedRng(0));
    expect(s.gameOver).toBe(false);
    const after = placePiece(s, { shapeId: 1, row: 0, col: 1 }, UnsupoScoring).state;
    expect(after.gameOver).toBe(true);
    expect(after.placedInTurn).toBe(1);
    expect(remainingHand(after)).toEqual([3, 3]);
    expect(needsDeal(after)).toBe(false);
  });

  it('enumerates legal placements at the edges', () => {
    expect(legalPlacements(EMPTY_BOARD, 11)).toHaveLength(4 * 8); // H bar 5
    expect(legalPlacements(EMPTY_BOARD, 22)).toHaveLength(8 * 4); // V bar 5
    expect(legalPlacements(EMPTY_BOARD, 13)).toHaveLength(36);
    expect(legalPlacements(FULL_BOARD, 1)).toHaveLength(0);
    const edge = legalPlacements(EMPTY_BOARD, 11).map((p) => p.col);
    expect(Math.max(...edge)).toBe(3);
    expect(countLegalMoves(EMPTY_BOARD, [1, 1, 1])).toBe(64);
    expect(countLegalMoves(EMPTY_BOARD, [1, 9])).toBe(64 + 49);
    expect(legalMoves(EMPTY_BOARD, [3, 3])).toHaveLength(56);
  });

  it('createGame uses the generator and records the dealt hand', () => {
    const gen = new UniformGenerator(TEN_TEN_POOL);
    const s = createGame({ generator: gen, scoring: UnsupoScoring, personalBest: 1234 }, seedRng(3));
    expect(s.dealtHand).toEqual(s.hand);
    for (const id of s.dealtHand) expect(TEN_TEN_POOL).toContain(id);
    expect(s.personalBest).toBe(1234);
    expect(s.turn).toBe(0);
    expect(s.board).toEqual(EMPTY_BOARD);
  });
});
