/**
 * §4 "Catching a rigged dealer without seeing the deck." Two hidden dealers — one fair, one rigged
 * with the mechanism the reader picks. Deal hands; the martingale-Z evidence meter fills; the
 * rigged dealer crosses the line and the fair one never does. Trajectories are real detector Z
 * runs (scripts/gen-detector.mjs); the round assigns them to A/B at random and hides which is which.
 */
import { useCallback, useMemo, useState } from 'react';
import det from '../data/detector.json';

type Kind = 'rescue' | 'kill' | 'lethal';
type Point = { h: number; z: number };
const KINDS: { key: Kind; label: string; blurb: string }[] = [
  { key: 'rescue', label: 'Rescue', blurb: 'slips you fitting pieces when the board gets full' },
  { key: 'kill', label: 'Choke', blurb: 'feeds you hard pieces as you near your record' },
  { key: 'lethal', label: 'Lethal', blurb: 'deals hands with nowhere to go more often than chance' },
];
const THRESH = det.thresholdZ;

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor((Math.sin(seed * 999.73) * 0.5 + 0.5) * arr.length) % arr.length] as T;
}

interface Round { a: Point[]; b: Point[]; riggedSide: 'a' | 'b'; }

function newRound(kind: Kind, seed: number): Round {
  const ind = (det.indicators as Record<string, { rigged: Point[][]; fair: Point[][] }>)[kind]!;
  const rigged = pick(ind.rigged, seed);
  const fair = pick(ind.fair, seed + 7);
  const riggedSide: 'a' | 'b' = Math.sin(seed * 13.37) > 0 ? 'a' : 'b';
  return riggedSide === 'a' ? { a: rigged, b: fair, riggedSide } : { a: fair, b: rigged, riggedSide };
}

function Meter({ z, label, caught, revealed, rigged }: { z: number; label: string; caught: boolean; revealed: boolean; rigged: boolean }) {
  const frac = Math.min(1, Math.abs(z) / (THRESH * 1.4));
  const threshFrac = 1 / 1.4;
  const color = caught ? 'var(--danger)' : 'var(--series-1)';
  return (
    <div className={`meter ${caught ? 'caught' : ''}`}>
      <div className="meter-head">
        <span>{label}</span>
        {revealed && <span className={rigged ? 'tag-rig' : 'tag-fair'}>{rigged ? 'rigged' : 'fair'}</span>}
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${frac * 100}%`, background: color }} />
        <div className="meter-thresh" style={{ left: `${threshFrac * 100}%` }} title="evidence threshold (α = 0.01)" />
      </div>
      <div className="meter-foot">
        <span>evidence Z = <strong>{z.toFixed(2)}</strong></span>
        {caught && <span className="danger">caught</span>}
      </div>
    </div>
  );
}

export function DealerDetector() {
  const [kind, setKind] = useState<Kind>('lethal');
  const [seed, setSeed] = useState(1);
  const [step, setStep] = useState(2); // checkpoint index (each = 20 hands)
  const [revealed, setRevealed] = useState(false);
  const round = useMemo(() => newRound(kind, seed), [kind, seed]);

  const maxStep = Math.min(round.a.length, round.b.length) - 1;
  const idx = Math.min(step, maxStep);
  const za = round.a[idx]?.z ?? 0;
  const zb = round.b[idx]?.z ?? 0;
  const hands = round.a[idx]?.h ?? 0;
  const caughtA = Math.abs(za) >= THRESH;
  const caughtB = Math.abs(zb) >= THRESH;

  const caughtAt = (run: Point[]) => run.find((p) => Math.abs(p.z) >= THRESH)?.h ?? null;

  const reset = useCallback((k: Kind) => { setKind(k); setSeed((s) => s + 1); setStep(2); setRevealed(false); }, []);

  return (
    <div className="detector">
      <div className="viz-controls">
        <div className="seg">
          {KINDS.map((k) => (
            <button key={k.key} className={kind === k.key ? 'on' : ''} onClick={() => reset(k.key)}>{k.label}</button>
          ))}
        </div>
        <span className="detector-blurb">rigged dealer {KINDS.find((k) => k.key === kind)!.blurb}</span>
      </div>

      <div className="meters">
        <Meter z={za} label="Dealer A" caught={caughtA} revealed={revealed} rigged={round.riggedSide === 'a'} />
        <Meter z={zb} label="Dealer B" caught={caughtB} revealed={revealed} rigged={round.riggedSide === 'b'} />
      </div>

      <div className="detector-controls">
        <span className="hands-read"><strong>{hands}</strong> hands dealt to each</span>
        <input type="range" min={0} max={maxStep} value={idx} onChange={(e) => setStep(Number(e.target.value))} aria-label="hands dealt" />
        <div className="detector-buttons">
          <button onClick={() => setStep((s) => Math.min(maxStep, s + 1))} disabled={idx >= maxStep}>Deal 20 more</button>
          <button className="ghost" onClick={() => setRevealed(true)} disabled={revealed}>Reveal</button>
          <button className="ghost" onClick={() => { setSeed((s) => s + 1); setStep(2); setRevealed(false); }}>New round</button>
        </div>
      </div>

      {revealed && (
        <p className="detector-verdict">
          Dealer {round.riggedSide.toUpperCase()} was rigged.{' '}
          {(() => {
            const at = caughtAt(round.riggedSide === 'a' ? round.a : round.b);
            return at ? `The detector flagged it after ${at} hands.` : `In this run it stayed under the line — a weak effect needs more hands (see the power curve).`;
          })()}{' '}
          The fair dealer never crossed.
        </p>
      )}
    </div>
  );
}
