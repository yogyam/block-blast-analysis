/**
 * Agent factory for the validation and power runners: the four agents of `06-methods.md` §7
 * (Random, ε-Greedy, Greedy, BeamSearch), by name. `epsilon` and `beam` accept a parameter via
 * `name:param`, e.g. `epsilon:0.3` or `beam:20`.
 */

import { BeamSearchAgent, EpsilonGreedyAgent, GreedyAgent, RandomAgent, type Agent } from '@blockblast/engine';

/** The agent names the runners accept (bare forms use sensible defaults). */
export const AGENT_NAMES: readonly string[] = ['random', 'greedy', 'epsilon', 'beam'];

/** Build an agent from a name, optionally `name:param`. */
export function makeAgent(spec: string): Agent {
  const [name, param] = spec.split(':');
  switch (name) {
    case 'random':
      return new RandomAgent();
    case 'greedy':
      return new GreedyAgent();
    case 'epsilon':
      return new EpsilonGreedyAgent(param === undefined ? 0.25 : Number(param));
    case 'beam':
      return new BeamSearchAgent(param === undefined ? 20 : Number(param));
    default:
      throw new Error(`unknown agent "${spec}"; known: ${AGENT_NAMES.join(', ')} (epsilon:ε, beam:width)`);
  }
}
