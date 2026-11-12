/**
 * §3 "What fair would look like": the distribution of game length and score under a fair
 * (uniform) dealer, for three levels of skill. Precomputed offline (scripts/gen-distributions.mjs,
 * 2000 games each) so the reader gets thousands of fair games at once. Fairness has a shape.
 */
import { useState } from 'react';
import dist from '../data/distributions.json';
import { Histogram, type Series } from './Histogram.tsx';

type Metric = 'length' | 'score';
const AGENTS = [
  { key: 'random', label: 'Random', color: 'var(--series-1)' },
  { key: 'greedy', label: 'Greedy', color: 'var(--series-2)' },
  { key: 'beam', label: 'Beam search', color: 'var(--series-3)' },
] as const;

export function DistributionExplorer() {
  const [metric, setMetric] = useState<Metric>('length');
  const agents = dist.agents as Record<string, { lengths: number[]; scores: number[]; meanLength: number; meanScore: number; medLength: number; medScore: number }>;

  const series: Series[] = AGENTS.map((a) => {
    const d = agents[a.key]!;
    return {
      name: a.label,
      color: a.color,
      values: metric === 'length' ? d.lengths : d.scores,
      mean: metric === 'length' ? d.meanLength : d.meanScore,
    };
  });

  return (
    <div className="dist">
      <div className="viz-controls">
        <div className="seg">
          <button className={metric === 'length' ? 'on' : ''} onClick={() => setMetric('length')}>Game length</button>
          <button className={metric === 'score' ? 'on' : ''} onClick={() => setMetric('score')}>Score</button>
        </div>
        <div className="legend">
          {AGENTS.map((a) => (
            <span key={a.key} className="legend-item"><span className="viz-dot" style={{ background: a.color }} />{a.label}</span>
          ))}
        </div>
      </div>
      <Histogram series={series} xLabel={metric === 'length' ? 'hands survived' : 'final score'} />
      <table className="stat-table">
        <thead><tr><th></th><th>mean</th><th>median</th><th>best of {dist.games}</th></tr></thead>
        <tbody>
          {AGENTS.map((a) => {
            const d = agents[a.key]!;
            const mean = metric === 'length' ? d.meanLength : d.meanScore;
            const med = metric === 'length' ? d.medLength : d.medScore;
            const best = metric === 'length' ? Math.max(...d.lengths) : Math.max(...d.scores);
            return (
              <tr key={a.key}>
                <td><span className="viz-dot" style={{ background: a.color }} /> {a.label}</td>
                <td>{mean}</td><td>{med}</td><td>{best}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
