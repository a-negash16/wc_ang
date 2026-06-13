export function renderLeagueLayout(config) {
  document.title = `${config.groupName} · ${config.tournamentName}`;
  document.body.className = `theme-${config.theme}`;

  const description = document.querySelector('meta[name="description"]');
  if (description) {
    description.setAttribute("content", `${config.groupName} - World Cup 2026 prediction league.`);
  }

  const root = document.getElementById("app");
  if (!root) {
    throw new Error("Missing required element: #app");
  }

  root.innerHTML = `
    <nav class="nav" aria-label="Primary">
      <div class="container nav-inner">
        <a href="#top" class="nav-brand">
          <span class="brand-mark" aria-hidden="true">WC</span>
          <span class="brand-word"></span>
        </a>
        <ul class="nav-links">
          <li><a href="#leaderboard">Standings</a></li>
          <li><a href="#wc-results">Results</a></li>
          <li><a href="#rules">Rules</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
      </div>
    </nav>

    <header class="hero" id="top">
      <div class="hero-pattern" aria-hidden="true"></div>
      <div class="container hero-inner">
        <p class="hero-eyebrow">Private league · World Cup 2026</p>
        <h1 class="hero-title"><span class="accent"></span></h1>
        <p class="hero-tagline">
          Predict every match. Draft your squad. Lock in your futures.
          One commissioner, one source of truth, zero excuses.
        </p>
        <div class="hero-meta">
          <span class="status-dot" aria-hidden="true"></span>
          <span id="hero-status">Loading leaderboard...</span>
        </div>
        <div class="hero-cta">
          <a href="#leaderboard" class="btn btn-primary">View standings</a>
          <a href="#rules" class="btn btn-ghost">How it works</a>
        </div>
      </div>
    </header>

    <section class="section section-light" id="leaderboard">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">Live now</p>
          <h2 class="section-title">Standings</h2>
          <p class="section-sub">
            Total combines every source of points: group-stage picks, knockout
            predictions, locked futures, and the manager's drafted teams + players.
          </p>
        </div>

        <div class="board-status" id="board-status" role="status">Loading standings...</div>

        <div class="table-wrap" id="table-wrap" hidden>
          <table class="board-table">
            <thead>
              <tr>
                <th scope="col" class="col-rank">#</th>
                <th scope="col" class="col-name">Manager</th>
                <th scope="col" class="col-total">Total</th>
                <th scope="col" class="col-sub">Group</th>
                <th scope="col" class="col-sub">Knockout</th>
                <th scope="col" class="col-sub">Futures</th>
                <th scope="col" class="col-sub">Teams</th>
                <th scope="col" class="col-sub">Players</th>
              </tr>
            </thead>
            <tbody id="board-body"></tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="section section-dark" id="wc-results">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow eyebrow-light">Live from the tournament</p>
          <h2 class="section-title section-title-light">World Cup Match Center</h2>
          <p class="section-sub section-sub-light">
            Today&apos;s fixtures, live updates, prediction pulse, and latest finals.
          </p>
        </div>

        <div class="wc-strip" id="wc-strip"></div>
      </div>
    </section>

    <section class="section section-light" id="rules">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">How it works</p>
          <h2 class="section-title">The rules</h2>
          <p class="section-sub">
            Five scoring lanes. One total.
          </p>
        </div>

        <div class="rules-grid">
          <article class="rule-card">
            <h3 class="rule-title"><span class="rule-tag rule-tag-number">1</span> Group picks</h3>
            <p>Pick winner or draw for each group match.</p>
            <table class="rule-table">
              <tr><th>Winner</th><td>+3</td></tr>
              <tr><th>Draw</th><td>+5</td></tr>
              <tr><th>Incorrect</th><td>0</td></tr>
            </table>
          </article>

          <article class="rule-card">
            <h3 class="rule-title"><span class="rule-tag rule-tag-number">2</span> Knockouts</h3>
            <p>Predict the winner, two scorers, and match finish.</p>
            <table class="rule-table">
              <tr><th>Winner</th><td>+5</td></tr>
              <tr><th>Scorer 1</th><td>+3</td></tr>
              <tr><th>Scorer 2</th><td>+3</td></tr>
              <tr><th>90/ET/Pens</th><td>+2</td></tr>
            </table>
            <p class="rule-foot"><strong>13 max</strong> per match.</p>
          </article>

          <article class="rule-card">
            <h3 class="rule-title"><span class="rule-tag rule-tag-number">3</span> Futures</h3>
            <p>Submitted right after group stage ends. Locked after the draft.</p>
            <table class="rule-table">
              <tr><th>Winner</th><td>100</td></tr>
              <tr><th>Finalist</th><td>50</td></tr>
              <tr><th>Golden Boot</th><td>150</td></tr>
              <tr><th>Player of Tournament</th><td>150</td></tr>
            </table>
          </article>

          <article class="rule-card">
            <h3 class="rule-title"><span class="rule-tag rule-tag-draft">Draft</span> Teams</h3>
            <p>Draft 4 teams right after group stage ends. Points stack by round reached.</p>
            <table class="rule-table">
              <tr><th>R16</th><td>+10</td></tr>
              <tr><th>QF</th><td>+20</td></tr>
              <tr><th>SF</th><td>+30</td></tr>
              <tr><th>Final</th><td>+40</td></tr>
              <tr><th>Champion</th><td>+50</td></tr>
            </table>
          </article>

          <article class="rule-card">
            <h3 class="rule-title"><span class="rule-tag rule-tag-draft">Draft</span> Players</h3>
            <p>Draft 4 players right after group stage ends. Every stat counts.</p>
            <table class="rule-table">
              <tr><th>Goal</th><td>+5</td></tr>
              <tr><th>Assist</th><td>+3</td></tr>
              <tr><th>MOTM</th><td>+7</td></tr>
              <tr><th>Clean sheet</th><td>+3</td></tr>
              <tr><th>Penalty save</th><td>+10</td></tr>
            </table>
            <p class="rule-foot">Clean sheets: <strong>GK/CB</strong>. Penalty saves: <strong>GK</strong>.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section-light section-narrow" id="faq">
      <div class="container">
        <div class="section-head">
          <p class="eyebrow">Questions</p>
          <h2 class="section-title">FAQ</h2>
        </div>

        <div class="faq">
          <details class="faq-item">
            <summary>How are tiebreakers decided?</summary>
            <p>Commissioner's discretion, documented at the start of the tournament. Group-stage and final standings, draft order - all tiebreakers go through the commish.</p>
          </details>
          <details class="faq-item">
            <summary>Can I change my picks after submitting?</summary>
            <p>Group-stage picks: allowed until kickoff. Futures: locked at draft, no edits. Knockout predictions: allowed until the match starts.</p>
          </details>
          <details class="faq-item">
            <summary>Why does a correct Draw pay more than a correct winner pick?</summary>
            <p>Draws are statistically harder to call. Rewarding them keeps the bold picks worth taking instead of everyone just picking the favorite.</p>
          </details>
          <details class="faq-item">
            <summary>Who is eligible for clean sheet points?</summary>
            <p>Goalkeepers and center-backs only. Penalty saves are goalkeeper-only.</p>
          </details>
          <details class="faq-item">
            <summary>What if a tournament rule changes mid-event?</summary>
            <p>Scoring locks at kickoff. Mid-tournament changes only happen if FIFA changes a fixture, such as abandonment or replay, and the commissioner adjudicates.</p>
          </details>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="container footer-inner">
        <p><span id="footer-group"></span> · Built for friends, run on Google Sheets.</p>
        <p class="footer-updated" id="footer-updated">-</p>
      </div>
    </footer>
  `;

  root.querySelector(".brand-word").textContent = config.groupName;
  root.querySelector(".hero-title .accent").textContent = config.groupName;
  root.querySelector("#footer-group").textContent = config.groupName;
}
