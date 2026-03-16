export default function HomePage() {
  return (
    <main className="page-shell home-grid">
      <section className="card hero">
        <h1>ProRefuel Replay Service</h1>
        <p>
          This service renders the interactive map replay layer for ProRefuel. The core app remains the
          source of truth for athlete profile, Strava ingestion, fueling intelligence, and nutrition logic.
          Replay only consumes a prepared payload and turns it into an analysis-first, visual experience.
        </p>
        <code>GET /r?source=&lt;url-encoded ProRefuel replay payload endpoint&gt;</code>
      </section>

      <section className="grid-two">
        <article className="card panel">
          <h2>Recommended production flow</h2>
          <ul>
            <li>ProRefuel generates a replay payload for an activity.</li>
            <li>The activity card adds an <span className="kbd">Open Replay</span> action.</li>
            <li>The action opens <span className="kbd">replay.prorefuel.app/r?source=...</span>.</li>
            <li>Replay fetches the payload server-side and renders the viewer.</li>
          </ul>
        </article>

        <article className="card panel">
          <h2>Included API routes</h2>
          <ul>
            <li><span className="kbd">POST /api/replays/normalize</span> validates and normalizes a payload.</li>
            <li><span className="kbd">GET /api/replays/example</span> returns a working example payload.</li>
          </ul>
          <p>
            The exact payload contract lives in <span className="kbd">src/lib/replay-payload.ts</span> and is documented in the included README.
          </p>
        </article>
      </section>
    </main>
  );
}
