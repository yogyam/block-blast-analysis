/**
 * Grouped bar chart (a few groups, 2-3 bars each), to the dataviz spec: 4px rounded data-ends on
 * the baseline, a 2px gap between adjacent bars, direct value labels, a legend, recessive axis.
 */
export interface BarGroup { readonly label: string; readonly values: readonly number[]; }
export interface BarChartProps {
  readonly groups: readonly BarGroup[];
  readonly seriesNames: readonly string[];
  readonly colors: readonly string[];
  readonly yLabel?: string;
  readonly width?: number;
  readonly height?: number;
}

export function BarChart({ groups, seriesNames, colors, yLabel, width = 640, height = 300 }: BarChartProps) {
  const pad = { l: 48, r: 14, t: 16, b: 46 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const yMax = Math.max(1, ...groups.flatMap((g) => g.values)) * 1.12;
  const Y = (v: number) => pad.t + ih - (v / yMax) * ih;
  const gw = iw / groups.length;
  const nSeries = seriesNames.length;
  const barGap = 2;
  const bw = (gw * 0.64 - barGap * (nSeries - 1)) / nSeries;
  const yTicks = [0, 0.5, 1].map((f) => f * yMax);

  return (
    <div className="viz-root">
      <div className="legend" style={{ marginBottom: 8 }}>
        {seriesNames.map((n, i) => <span key={n} className="legend-item"><span className="viz-dot" style={{ background: colors[i] }} />{n}</span>)}
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={yLabel ?? 'bar chart'}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + iw} y1={Y(t)} y2={Y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.l - 8} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-secondary)">{Math.round(t)}</text>
          </g>
        ))}
        {groups.map((g, gi) => {
          const gx = pad.l + gi * gw + gw * 0.18;
          return (
            <g key={g.label}>
              {g.values.map((v, si) => {
                const x = gx + si * (bw + barGap);
                const h = Math.max(0, Y(0) - Y(v));
                return (
                  <g key={si}>
                    <rect x={x} y={Y(v)} width={bw} height={h} rx={4} fill={colors[si]} />
                    <text x={x + bw / 2} y={Y(v) - 6} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text-primary)">{v}</text>
                  </g>
                );
              })}
              <text x={pad.l + gi * gw + gw / 2} y={height - 16} textAnchor="middle" fontSize={13} fill="var(--text-secondary)">{g.label}</text>
            </g>
          );
        })}
        <line x1={pad.l} x2={pad.l + iw} y1={Y(0)} y2={Y(0)} stroke="var(--axis)" strokeWidth={1} />
        {yLabel && <text x={pad.l} y={11} fontSize={11} fill="var(--text-secondary)">{yLabel}</text>}
      </svg>
    </div>
  );
}
