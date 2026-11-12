import { MiniBoard } from './components/MiniBoard.tsx';

export function App() {
  return (
    <main className="essay">
      <header className="hero">
        <p className="kicker">An independent, reproducible teardown</p>
        <h1>You aren't playing Block Blast.<br />Block Blast is playing you.</h1>
        <p className="lede">
          The three pieces you are handed each turn are not a fair shuffle. They are chosen — by a
          native algorithm with a hundred named strategies, tuned by a server that is also deciding
          when you are about to quit and how much your next ad is worth. Here is how we know,
          measured from the game's own code and reproduced with our own simulator.
        </p>
      </header>

      <section className="chapter">
        <p className="num">1</p>
        <h2>The piece that never comes</h2>
        <p>
          You know the moment. The board has one obvious gap, you are three pieces from a clear, and
          the game hands you three shapes, none of which fit. Millions of people share the suspicion
          that this is not bad luck. The company has never addressed it. In October 2026 a developer
          opened the app up and found an algorithm literally named for dealing a lethal hand.
        </p>
        <p>
          This essay replicates that finding from scratch and then does what the teardown did not:
          it measures how adaptive the dealer really is, with a method you could rerun yourself. We
          start where the suspicion lives — with the pieces.
        </p>
      </section>

      <section className="chapter">
        <p className="num">2</p>
        <h2>How the game actually works</h2>
        <p>
          The rules take sixty seconds. An 8×8 grid. Each turn you are dealt three shapes. Place all
          three — no rotating — anywhere they fit. Fill a row or a column and it clears. You keep
          going until none of your three pieces can be placed anywhere. That last part is the whole
          game: you never lose by running out of time, only by being handed a hand with nowhere to go.
        </p>
        <p>
          Here is the real thing, with a dealer we can <em>prove</em> is fair: three independent,
          uniform draws from the piece set, every turn. Play a few hands. Watch the "pieces that fit"
          count — a fair dealer lets it fall to zero only when the board genuinely leaves no room.
        </p>
        <div className="figure">
          <MiniBoard />
          <p className="caption">
            A fair (uniform) dealer, the real rules, running in your browser from{' '}
            <code>@blockblast/engine</code>. Every later demo is the same engine with a different dealer.
          </p>
        </div>
      </section>

      <section className="chapter">
        <p className="num">3</p>
        <h2>What fair would look like</h2>
        <p>
          Before we can call a dealer rigged we need to know the shape of fair: under uniform
          dealing, how long do games last, and what kills you? That distribution is coming next — ten
          thousand simulated games, three levels of skill — so that Block Blast has something honest
          to be compared against.
        </p>
        <p className="caption">More sections are under construction; this page is built incrementally.</p>
      </section>
    </main>
  );
}
