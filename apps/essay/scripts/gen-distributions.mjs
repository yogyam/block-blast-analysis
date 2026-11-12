// Precompute fair-dealer (uniform) outcome distributions for the essay §3 figure.
// Raw per-game length and score for three agents; binned in the browser so the reader can poke.
import { playGames, seedRng, RandomAgent, GreedyAgent, BeamSearchAgent, UniformGenerator } from '@blockblast/engine';
import { resolvePool } from '@blockblast/generators';
import { writeFileSync } from 'node:fs';

const POOL = resolvePool('live'); // the real game's piece set (ids 2-31)
const N = 2000;
const agents = { random: () => new RandomAgent(), greedy: () => new GreedyAgent(), beam: () => new BeamSearchAgent(16) };
const out = { pool: 'live', poolSize: POOL.length, games: N, generator: 'uniform', agents: {} };
for (const [name, make] of Object.entries(agents)) {
  const t0 = Date.now();
  const logs = playGames(N, new UniformGenerator(POOL), make(), seedRng(`dist-${name}`), { pool: POOL, maxTurns: 4000 });
  const lengths = logs.map((l) => l.turnCount);
  const scores = logs.map((l) => l.finalScore);
  const mean = (a) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
  const sorted = (a) => [...a].sort((x, y) => x - y);
  const q = (a, p) => sorted(a)[Math.floor(p * (a.length - 1))];
  out.agents[name] = { lengths, scores, meanLength: mean(lengths), meanScore: mean(scores),
    medLength: q(lengths, 0.5), medScore: q(scores, 0.5), maxLength: Math.max(...lengths), maxScore: Math.max(...scores) };
  console.error(`${name}: ${N} games in ${((Date.now() - t0) / 1000).toFixed(1)}s  meanLen=${out.agents[name].meanLength} meanScore=${out.agents[name].meanScore}`);
}
writeFileSync('src/data/distributions.json', JSON.stringify(out));
console.error('wrote src/data/distributions.json', (JSON.stringify(out).length / 1024).toFixed(0) + 'KB');
