// WC ANG — Leaderboard + Recent Results client.
// Fetches two published CSVs from Google Sheets, parses, renders, degrades gracefully.

(function () {
  const cfg = window.WC_ANG_CONFIG || {};

  // ---- elements ----
  const heroStatusEl = document.getElementById("hero-status");
  const footerUpdatedEl = document.getElementById("footer-updated");

  // ---- apply per-group identity from config (safe fallback if HTML hasn't already) ----
  if (cfg.GROUP_NAME) {
    const brand = document.querySelector(".brand-word");
    const title = document.querySelector(".hero-title");
    if (brand) brand.textContent = cfg.GROUP_NAME;
    if (title) title.innerHTML = '<span class="accent">' + escapeText(cfg.GROUP_NAME) + '</span>';
    document.title = cfg.GROUP_NAME + (cfg.TOURNAMENT_NAME ? " · " + cfg.TOURNAMENT_NAME : "");
  }

  const boardStatusEl = document.getElementById("board-status");
  const tableWrapEl = document.getElementById("table-wrap");
  const boardBodyEl = document.getElementById("board-body");

  const resultsStatusEl = document.getElementById("results-status");
  const resultsGridEl = document.getElementById("results-grid");
  const resultsEmptyEl = document.getElementById("results-empty");

  // ---- kick off ----
  loadLeaderboard();
  loadResults();

  // ============================================================
  // Leaderboard
  // ============================================================
  function loadLeaderboard() {
    if (!cfg.LEADERBOARD_CSV_URL) {
      showBoardError(
        "LEADERBOARD_CSV_URL is not set. Open config.js and paste the " +
        "published Google Sheets CSV URL for the Landing_CSV tab."
      );
      return;
    }

    fetch(cfg.LEADERBOARD_CSV_URL, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then((text) => {
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error("CSV has no data rows.");
        renderLeaderboard(rows);
      })
      .catch((err) => {
        showBoardError("Could not load standings: " + err.message);
      });
  }

  function renderLeaderboard(rows) {
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = {
      rank: header.indexOf("rank"),
      name: header.indexOf("manager_name"),
      total: header.indexOf("total_points"),
      group: header.indexOf("group_stage_points"),
      knockout: header.indexOf("knockout_prediction_points"),
      futures: header.indexOf("futures_points"),
      teams: header.indexOf("drafted_teams_points"),
      players: header.indexOf("drafted_players_points"),
      updated: header.indexOf("last_updated"),
    };

    const required = ["rank", "name", "total"];
    for (const k of required) {
      if (idx[k] === -1) {
        showBoardError("Landing_CSV is missing column: " + k);
        return;
      }
    }

    const records = rows.slice(1)
      .map((r) => ({
        rank: parseInt(r[idx.rank], 10),
        name: r[idx.name] || "",
        total: numOrZero(r[idx.total]),
        group: numOrZero(r[idx.group]),
        knockout: numOrZero(r[idx.knockout]),
        futures: numOrZero(r[idx.futures]),
        teams: numOrZero(r[idx.teams]),
        players: numOrZero(r[idx.players]),
        updated: idx.updated >= 0 ? r[idx.updated] : "",
      }))
      .filter((r) => r.name)
      .sort((a, b) => {
        if (!Number.isNaN(a.rank) && !Number.isNaN(b.rank)) return a.rank - b.rank;
        return b.total - a.total;
      });

    boardBodyEl.innerHTML = "";
    for (const rec of records) {
      const tr = document.createElement("tr");
      const rankClass =
        rec.rank === 1 ? "rank-1" : rec.rank === 2 ? "rank-2" : rec.rank === 3 ? "rank-3" : "";
      tr.className = rankClass;
      tr.innerHTML =
        `<td class="col-rank"><span class="rank-medal">${escapeText(String(rec.rank || ""))}</span></td>` +
        `<td class="col-name">${escapeText(rec.name)}</td>` +
        `<td class="col-total">${fmtNum(rec.total)}</td>` +
        `<td class="col-sub">${fmtNum(rec.group)}</td>` +
        `<td class="col-sub">${fmtNum(rec.knockout)}</td>` +
        `<td class="col-sub">${fmtNum(rec.futures)}</td>` +
        `<td class="col-sub">${fmtNum(rec.teams)}</td>` +
        `<td class="col-sub">${fmtNum(rec.players)}</td>`;
      boardBodyEl.appendChild(tr);
    }

    boardStatusEl.hidden = true;
    tableWrapEl.hidden = false;

    // Hero + footer status updates
    const leader = records[0];
    if (leader) {
      heroStatusEl.textContent =
        `Live · ${leader.name} leads with ${fmtNum(leader.total)} pts`;
    }
    const updated = leader && leader.updated;
    if (updated) {
      footerUpdatedEl.textContent = "Last updated: " + updated;
    }
  }

  function showBoardError(msg) {
    boardStatusEl.textContent = msg;
    boardStatusEl.classList.add("error");
    boardStatusEl.hidden = false;
    tableWrapEl.hidden = true;
    heroStatusEl.textContent = "Standings unavailable";
  }

  // ============================================================
  // Recent Results
  // ============================================================
  function loadResults() {
    if (!cfg.RESULTS_CSV_URL) {
      // No URL configured — silently hide the section's loading state.
      resultsStatusEl.hidden = true;
      resultsEmptyEl.textContent = "Recent results will appear here once configured.";
      resultsEmptyEl.hidden = false;
      return;
    }

    fetch(cfg.RESULTS_CSV_URL, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then((text) => {
        const rows = parseCSV(text);
        renderResults(rows);
      })
      .catch((err) => {
        showResultsError("Could not load recent results: " + err.message);
      });
  }

  function renderResults(rows) {
    if (rows.length < 2) {
      showResultsEmpty();
      return;
    }
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = {
      date: header.indexOf("date"),
      stage: header.indexOf("stage"),
      team_a: header.indexOf("team_a"),
      team_b: header.indexOf("team_b"),
      winner: header.indexOf("winner"),
      length: header.indexOf("length"),
      correct: header.indexOf("correct_count"),
      points: header.indexOf("total_points_awarded"),
    };
    if (idx.stage === -1 || idx.team_a === -1 || idx.team_b === -1) {
      showResultsError("Recent_Results_CSV missing required columns.");
      return;
    }

    const records = rows.slice(1)
      .map((r) => ({
        date: idx.date >= 0 ? (r[idx.date] || "") : "",
        stage: r[idx.stage] || "",
        team_a: r[idx.team_a] || "",
        team_b: r[idx.team_b] || "",
        winner: idx.winner >= 0 ? (r[idx.winner] || "") : "",
        length: idx.length >= 0 ? (r[idx.length] || "") : "",
        correct: idx.correct >= 0 ? numOrZero(r[idx.correct]) : 0,
        points: idx.points >= 0 ? numOrZero(r[idx.points]) : 0,
      }))
      // a match is "finished" if it has both a stage label and a winner
      .filter((r) => r.stage && r.winner && r.team_a);

    if (records.length === 0) {
      showResultsEmpty();
      return;
    }

    // Sort by date desc (string ISO sort works); limit
    records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const limit = cfg.RESULTS_LIMIT || 9;
    const top = records.slice(0, limit);

    resultsGridEl.innerHTML = "";
    for (const rec of top) {
      const isDraw = rec.winner.toLowerCase() === "draw";
      const aWon = !isDraw && rec.winner === rec.team_a;
      const bWon = !isDraw && rec.winner === rec.team_b;

      const card = document.createElement("article");
      card.className = "match-card";
      card.innerHTML =
        `<div class="match-head">
           <span class="match-stage">${escapeText(rec.stage)}</span>
           <span class="match-date">${escapeText(rec.date)}</span>
         </div>
         <div class="match-teams">
           <div class="match-team ${aWon ? "is-winner" : ""} ${isDraw ? "is-draw" : ""}">${escapeText(rec.team_a)}</div>
           <div class="match-vs">VS</div>
           <div class="match-team ${bWon ? "is-winner" : ""} ${isDraw ? "is-draw" : ""}">${escapeText(rec.team_b)}</div>
         </div>
         <div class="match-foot">
           <span class="match-stat">
             <strong>${fmtNum(rec.correct)}</strong> correct ·
             <strong>${fmtNum(rec.points)}</strong> pts awarded
           </span>
           ${rec.length ? `<span class="match-length">${escapeText(rec.length)}</span>` : ""}
         </div>`;
      resultsGridEl.appendChild(card);
    }

    resultsStatusEl.hidden = true;
    resultsGridEl.hidden = false;
    resultsEmptyEl.hidden = true;
  }

  function showResultsError(msg) {
    resultsStatusEl.textContent = msg;
    resultsStatusEl.classList.add("error");
    resultsStatusEl.hidden = false;
    resultsGridEl.hidden = true;
    resultsEmptyEl.hidden = true;
  }
  function showResultsEmpty() {
    resultsStatusEl.hidden = true;
    resultsGridEl.hidden = true;
    resultsEmptyEl.hidden = false;
  }

  // ============================================================
  // CSV parser (handles quoted fields)
  // ============================================================
  function parseCSV(text) {
    const out = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') { field += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { field += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ",") { row.push(field); field = ""; }
        else if (ch === "\n") { row.push(field); out.push(row); row = []; field = ""; }
        else if (ch === "\r") { /* skip */ }
        else { field += ch; }
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); out.push(row); }
    return out.filter((r) => r.some((c) => c.trim() !== ""));
  }

  // ============================================================
  // utils
  // ============================================================
  function numOrZero(v) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  function fmtNum(n) { return Number(n).toLocaleString(); }
  function escapeText(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
