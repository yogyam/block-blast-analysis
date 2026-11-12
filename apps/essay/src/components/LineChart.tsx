/**
 * A small multi-series line chart (x numeric). Markers, recessive axes, a hover crosshair reading
 * every series at the nearest x. Used for the lethal-availability curve (§5) and power curves.
 */
import { useMemo, useState } from 'react';

export interface LinePoint { readonly x: number; readonly y: number; }
export interface LineSeries { readonly name: string; readonly color: string; readonly points: readonly LinePoint[]; }

export interface LineChartProps {
  readonly series: readonly LineSeries[];
  readonly xLabel: string;
  readonly yLabel?: string;
  /** Format a y value for ticks/tooltip (default: round). */
  readonly fmtY?: (y: number) => string;
  readonly yMax?: number;
  readonly width?: number;
  readonly height?: number;
}

export function LineChart({ series, xLabel, yLabel, fmtY = (y) => String(Math.round(y)), yMax, width = 640, height = 280 }: LineChartProps) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const pad = { l: 48, r: 14, t: 14, b: 42 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const { xs, xMin, xMax, yHi } = useMemo(() => {
    const xs = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
    let xMin = Infinity, xMax = -Infinity, yHi = 0;
    for (const s of series) for (const p of s.points) { xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x); yHi = Math.max(yHi, p.y); }
    return { xs, xMin, xMax: Math.max(xMax, xMin + 1), yHi: yMax ?? yHi * 1.08 };
  }, [series, yMax]);

  const X = (x: number) => pad.l + ((x - xMin) / (xMax - xMin)) * iw;
  const Y = (y: number) => pad.t + ih - (y / (yHi || 1)) * ih;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yHi);

  const nearest = (hx: number) => xs.reduce((best, x) => (Math.abs(X(x) - hx) < Math.abs(X(best) - hx) ? x : best), xs[0] ?? 0);
  const hx = hoverX === null ? null : nearest(hoverX);

  return (
    <div className="viz-root" style={{ position: 'relative' }}>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${yLabel ?? 'value'} vs ${xLabel}`}
        onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); setHoverX(((e.clientX - r.left) / r.width) * width); }}
        onMouseLeave={() => setHoverX(null)}
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + iw} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-secondary)">{fmtY(t)}</text>
          </g>
        ))}
        {hx !== null && <line x1={X(hx)} x2={X(hx)} y1={pad.t} y2={pad.t + ih} stroke="var(--text-primary)" strokeWidth={1} opacity={0.25} />}
        {series.map((s) => (
          <g key={s.name}>
            <polyline points={s.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
            {s.points.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={hx === p.x ? 5 : 3} fill={s.color} />)}
          </g>
        ))}
        <line x1={pad.l} x2={pad.l + iw} y1={Y(0)} y2={Y(0)} stroke="var(--axis)" strokeWidth={1} />
        {[xMin, (xMin + xMax) / 2, xMax].map((v, i) => <text key={i} x={X(v)} y={height - 14} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">{Math.round(v)}</text>)}
        <text x={pad.l + iw / 2} y={height - 1} textAnchor="middle" fontSize={12} fill="var(--text-secondary)">{xLabel}</text>
      </svg>
      {hx !== null && (
        <div className="viz-tip" style={{ left: `${(X(hx) / width) * 100}%` }}>
          <div className="viz-tip-head">{xLabel} = {hx}</div>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === hx);
            return p ? <div key={s.name} className="viz-tip-row"><span className="viz-dot" style={{ background: s.color }} />{s.name}: {fmtY(p.y)}</div> : null;
          })}
        </div>
      )}
    </div>
  );
}
