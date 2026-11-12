/**
 * Plain-text formatters for the detector, synthetic-validation and power-curve reports.
 */

import type { DetectorReport, PowerPoint, ValidationReport } from '@blockblast/analysis';

/** The detector report over one dataset. */
export function formatDetector(r: DetectorReport): string {
  const lines: string[] = [];
  lines.push(`Detector — ${r.games} games, ${r.hands} hands, pool of ${r.pool.length} shapes, Holm α=${r.alpha}`);
  lines.push('');
  for (const h of r.hypotheses) {
    if (!h.ran) {
      lines.push(`  ${h.id}  ${h.name.padEnd(30)} not run  (${h.effect ?? ''})`);
      continue;
    }
    const mark = h.holm?.reject ? '✗ REJECT' : '· ok';
    const p = h.p === undefined ? '' : `p=${h.p.toExponential(2)}`;
    const adj = h.holm ? ` adj=${h.holm.adjusted.toExponential(2)}` : '';
    lines.push(`  ${h.id}  ${h.name.padEnd(30)} ${mark.padEnd(9)} ${p}${adj}`);
    if (h.effect) lines.push(`        ${h.effect}`);
  }
  lines.push('');
  lines.push(`rejected: ${r.rejected.length > 0 ? r.rejected.join(', ') : '(none)'}`);
  return lines.join('\n');
}

/** The synthetic-validation report (confusion matrix + calibration). */
export function formatValidation(r: ValidationReport): string {
  const ids = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
  const lines: string[] = [];
  lines.push(`Synthetic validation — ${r.replicates} replicates × ${r.games} games, Holm α=${r.alpha}`);
  lines.push('');
  lines.push(`${'condition'.padEnd(20)}${ids.map((i) => i.padStart(6)).join('')}   fam%   expect→any/all`);
  for (const c of r.conditions) {
    const row = ids
      .map((id) => {
        const h = c.hyps.find((x) => x.id === id);
        return (h ? (h.rejectRate * 100).toFixed(0) : '-').padStart(6);
      })
      .join('');
    const tag = c.isNull ? 'NULL' : c.expect.join('+');
    const power = c.expect.length > 0 ? `${(c.powerAny * 100).toFixed(0)}/${(c.powerAll * 100).toFixed(0)}%` : '';
    lines.push(`${c.label.padEnd(20)}${row}  ${(c.familyRejectRate * 100).toFixed(0).padStart(4)}%   ${tag}${power ? '→' + power : ''}`);
  }
  lines.push('');
  lines.push('KS-uniformity p of each null hypothesis (want > 0.01):');
  for (const c of r.conditions.filter((x) => x.isNull)) {
    const cells = ids.map((id) => {
      const h = c.hyps.find((x) => x.id === id);
      return `${id}=${h?.ksUniformP !== undefined ? h.ksUniformP.toFixed(2) : '—'}`;
    });
    lines.push(`  ${c.label.padEnd(14)}${cells.join('  ')}`);
  }
  lines.push('');
  lines.push(`PASS criterion 1 — null family-wise FPR ≤ α: ${r.nullFamilyWiseOk ? 'OK' : 'FAIL'}`);
  lines.push(`PASS criterion 1 — null p-value uniformity:   ${r.nullUniformityOk ? 'OK' : 'FAIL'}`);
  return lines.join('\n');
}

/** A power curve for one target hypothesis. */
export function formatPower(points: readonly PowerPoint[], generator: string, target: string): string {
  const lines: string[] = [];
  lines.push(`Power for ${target} under ${generator}:`);
  lines.push(`  ${'games'.padStart(6)}${'hands'.padStart(10)}${'power'.padStart(8)}`);
  for (const p of points) lines.push(`  ${String(p.games).padStart(6)}${p.meanHands.toFixed(0).padStart(10)}${(p.power * 100).toFixed(0).padStart(7)}%`);
  return lines.join('\n');
}
