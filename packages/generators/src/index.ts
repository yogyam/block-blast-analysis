/**
 * @blockblast/generators: the generator zoo of `docs/research/06-methods.md` §7, plus a documented
 * approximation of the live game's dealer. Every generator implements the engine's `Generator`
 * interface, is deterministic given the engine `Rng`, and serialises JSON-able state.
 *
 * @packageDocumentation
 */

export * from './pools.ts';
export * from './common.ts';
export * from './uniform.ts';
export * from './bag.ts';
export * from './guarantee.ts';
export * from './rescue.ts';
export * from './kill.ts';
export * from './lethal.ts';
export * from './perGame.ts';
export * from './slotBiased.ts';
export * from './mixture.ts';
export * from './replay.ts';
export * from './blockBlastLike.ts';
export * from './registry.ts';
