/**
 * Overlaid density histograms: one 2px step-line per series (identity by colour + legend), the
 * y-axis the fraction of games per bin so differently-sized runs compare. A hover crosshair reads
 * every series at the hovered bin; mean markers sit on the baseline. Recessive axes/grid.
 */
import { useId, useMemo, useState } from 'react';

export interface Series {
  readonly name: string;
  readonly color: string;
  readonly values: readonly number[];
  readonly mean?: number;
}

export interface HistogramProps {
  readonly series: readonly Series[];
  readonly xLabel: string;
  readonly bins?: number;
  readonly width?: number;
  readonly height?: number;
}

function binize(values: readonly number[], edges: readonly number[]): number[] {
  const counts = new Array<number>(edges.length - 1).fill(0);
  for (const v of values) {
    let k = 0;
    while (k < edges.length - 2 && v >= (edges[k + 1] as number)) k++;
    counts[k] = (counts[k] as number) + 1;
  }
  return counts.map((c) => c / values.length);
}

export function Histogram({ series, xLabel, bins = 28, width = 640, height = 280 }: HistogramProps) {
  const id = useId();
  const [hoverBin, setHoverBin] = useState<number | null>(null);
  const pad = { l: 44, r: 12, t: 12, b: 40 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const { edges, densities, yMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of series) for (const v of s.values) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
    hi = Math.max(hi, lo + 1);
    const edges = Array.from({ length: bins + 1 }, (_, i) => lo + ((hi - lo) * i) / bins);
    const densities = series.map((s) => binize(s.values, edges));
    const yMax = Math.max(1e-6, ...densities.flat());
    return { edges, densities, yMax };
  }, [series, bins]);

  const x = (v: number) => pad.l + ((v - (edges[0] as number)) / ((edges[edges.length - 1] as number) - (edges[0] as number))) * iw;
  const y = (d: number) => pad.t + ih - (d / yMax) * ih;
  const binCenter = (k: number) => ((edges[k] as number) + (edges[k + 1] as number)) / 2;

  // Step path for a density series.
  const stepPath = (dens: number[]) => {
    let p = `M ${pad.l} ${y(0)}`;
    for (let k = 0; k < dens.length; k++) {
      const x0 = x(edges[k] as number);
      const x1 = x(edges[k + 1] as number);
      const yy = y(dens[k] as number);
      p += ` L ${x0} ${yy} L ${x1} ${yy}`;
    }
    p += ` L ${pad.l + iw} ${y(0)}`;
    return p;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  return (
    <div className="viz-root" style={{ position: 'relative' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Distribution of ${xLabel}`}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          const frac = (px - pad.l) / iw;
          const k = Math.floor(frac * bins);
          setHoverBin(k >= 0 && k < bins ? k : null);
        }}
        onMouseLeave={() => setHoverBin(null)}
      >
        {/* y grid */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-secondary)">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {/* hovered bin crosshair */}
        {hoverBin !== null && (
          <rect x={x(edges[hoverBin] as number)} y={pad.t} width={Math.max(1, x(edges[hoverBin + 1] as number) - x(edges[hoverBin] as number))} height={ih} fill="var(--text-primary)" opacity={0.06} />
        )}
        {/* series step lines */}
        {series.map((s, si) => (
          <path key={s.name} d={stepPath(densities[si] as number[])} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" opacity={0.95} />
        ))}
        {/* mean markers on baseline */}
        {series.map((s, si) =>
          s.mean !== undefined ? (
            <g key={`m-${si}`}>
              <line x1={x(s.mean)} x2={x(s.mean)} y1={y(0)} y2={y(0) + 7} stroke={s.color} strokeWidth={2} />
              <circle cx={x(s.mean)} cy={y(0) + 7} r={3} fill={s.color} />
            </g>
          ) : null,
        )}
        {/* x axis */}
        <line x1={pad.l} x2={pad.l + iw} y1={y(0)} y2={y(0)} stroke="var(--axis)" strokeWidth={1} />
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const v = (edges[0] as number) + f * ((edges[edges.length - 1] as number) - (edges[0] as number));
          return <text key={i} x={x(v)} y={height - 14} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">{Math.round(v)}</text>;
        })}
        <text x={pad.l + iw / 2} y={height - 1} textAnchor="middle" fontSize={12} fill="var(--text-secondary)">{xLabel}</text>
        <title>{id}</title>
      </svg>
      {hoverBin !== null && (
        <div className="viz-tip" style={{ left: `${(x(binCenter(hoverBin)) / width) * 100}%` }}>
          <div className="viz-tip-head">{xLabel} ≈ {Math.round(binCenter(hoverBin))}</div>
          {series.map((s, si) => (
            <div key={s.name} className="viz-tip-row">
              <span className="viz-dot" style={{ background: s.color }} />
              {s.name}: {((densities[si] as number[])[hoverBin] as number * 100).toFixed(1)}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
