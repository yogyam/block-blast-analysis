/**
 * §7 figure: the thirty-year line from academic DDA to ad-value-tuned difficulty. Each entry is
 * sourced in docs/research/04-dda-and-psychology.md. The novelty at the end is not adaptivity — it
 * is tying adaptivity to predicted ad value per player.
 */
interface Milestone { readonly year: string; readonly title: string; readonly detail: string; readonly here?: boolean; }

const MILESTONES: readonly Milestone[] = [
  { year: '2004', title: 'Hamlet (Hunicke & Chapman)', detail: 'DDA’s canonical system watches the player, predicts an "undesirable but avoidable state", and intervenes "just enough" — with a policy to help and a policy to hinder, preferring changes the player cannot see.' },
  { year: '2014', title: 'Wooga, "FUUU factor" (GDC)', detail: 'A published recipe for manufacturing near-misses: "blocking levels" with lose rates up to 95%, a first one in the first session, because "players need to lose, and lose early".' },
  { year: '2016', title: 'EA patent US 9,919,217 B2', detail: 'Predict a player’s churn, then "select a seed value" for the game’s random number generator based on it — with "undetectable by the user" stated as a design goal.' },
  { year: '2017', title: 'EOMM (Chen et al., EA)', detail: 'A paper argues that creating fair games "is not optimal for engagement", and proposes optimizing matchmaking for predicted engagement instead.' },
  { year: '2025', title: 'Pape et al., personalized difficulty', detail: 'A peer-reviewed economics paper estimates that personalizing difficulty per player raises revenue by about 71% over an already revenue-maximized baseline.' },
  { year: '2026', title: 'Block Blast', detail: 'The three pieces, chosen by a hundred named strategies, gated by a server that also runs an ad-value model and a churn model. Measured here. The novelty is not that it adapts — it is what it adapts for.', here: true },
];

export function Timeline() {
  return (
    <ol className="timeline">
      {MILESTONES.map((m) => (
        <li key={m.year} className={m.here ? 'here' : ''}>
          <div className="tl-year">{m.year}</div>
          <div className="tl-node" />
          <div className="tl-body">
            <div className="tl-title">{m.title}</div>
            <div className="tl-detail">{m.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
