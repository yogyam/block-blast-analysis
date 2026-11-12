// §7: how each player scores under a fair dealer vs our reimplementation of the observed live
// dealer (blockblast-like: early filter of hard shapes, hard bias late, lethal search dealt part
// of the time). The gap is "what the dealer costs you".
import { playGames, seedRng, RandomAgent, GreedyAgent, BeamSearchAgent, UniformGenerator } from '@blockblast/engine';
import { buildGenerator, resolvePool } from '@blockblast/generators';
import { writeFileSync } from 'node:fs';

const POOL = resolvePool('live');
const N = 1200;
const agents = { random: () => new RandomAgent(), greedy: () => new GreedyAgent(), beam: () => new BeamSearchAgent(16) };
const dealers = {
  fair: () => new UniformGenerator(POOL),
  real: () => buildGenerator({ name: 'blockblast-like', opts: { dealLethal: 0.5, hardBias: 3 } }, POOL),
};
const mean = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
const out = { games: N, agents: Object.keys(agents), dealers: Object.keys(dealers), data: {} };
for (const [an, ma] of Object.entries(agents)) {
  out.data[an] = {};
  for (const [dn, md] of Object.entries(dealers)) {
    const logs = playGames(N, md(), ma(), seedRng(`pb-${an}-${dn}`), { pool: POOL, personalBest: 0, maxTurns: 4000 });
    out.data[an][dn] = { meanScore: mean(logs.map((l) => l.finalScore)), meanLength: Math.round(10 * logs.reduce((s, l) => s + l.turnCount, 0) / N) / 10 };
  }
  console.error(an, 'fair', out.data[an].fair, 'real', out.data[an].real);
}
writeFileSync('src/data/playback.json', JSON.stringify(out));
console.error('wrote src/data/playback.json');
