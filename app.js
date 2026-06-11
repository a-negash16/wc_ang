// WC ANG — Leaderboard client.
// Fetches the published Landing_CSV from Google Sheets, parses it, renders the table.

(function () {
  const cfg = window.WC_ANG_CONFIG || {};
  const statusEl = document.getElementById("board-status");
  const wrapEl = document.getElementById("table-wrap");
  const bodyEl = document.getElementById("board-body");
  const updatedEl = document.getElementById("last-updated");

  if (!cfg.CSV_URL) {
    showError(
      "CSV_URL is not configured. Open config.js and paste the published " +
      "Google Sheets CSV URL for the Landing_CSV tab."
    );
    return;
  }

  fetch(cfg.CSV_URL, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    })
    .then((text) => {
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("CSV has no data rows.");
      render(rows);
    })
    .catch((err) => {
      showError("Could not load the leaderboard: " + err.message);
    });

  // ---- CSV parser (handles quoted fields and embedded commas) ----
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

  // ---- Renderer ----
  function render(rows) {
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
        showError("CSV is missing column: " + k);
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

    bodyEl.innerHTML = "";
    for (const rec of records) {
      const tr = document.createElement("tr");
      const rankClass =
        rec.rank === 1 ? "rank-1" : rec.rank === 2 ? "rank-2" : rec.rank === 3 ? "rank-3" : "";
      tr.innerHTML =
        `<td class="col-rank ${rankClass}">${escape(String(rec.rank || ""))}</td>` +
        `<td class="col-name">${escape(rec.name)}</td>` +
        `<td class="col-total">${fmt(rec.total)}</td>` +
        `<td class="col-sub">${fmt(rec.group)}</td>` +
        `<td class="col-sub">${fmt(rec.knockout)}</td>` +
        `<td class="col-sub">${fmt(rec.futures)}</td>` +
        `<td class="col-sub">${fmt(rec.teams)}</td>` +
        `<td class="col-sub">${fmt(rec.players)}</td>`;
      bodyEl.appendChild(tr);
    }

    const updated = records[0] && records[0].updated;
    updatedEl.textContent = updated
      ? "Last updated: " + updated
      : "Last updated: (unknown)";

    statusEl.hidden = true;
    wrapEl.hidden = false;
  }

  function showError(msg) {
    statusEl.textContent = msg;
    statusEl.classList.add("error");
    statusEl.hidden = false;
    wrapEl.hidden = true;
    updatedEl.textContent = "";
  }

  function numOrZero(v) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }
  function fmt(n) { return Number(n).toLocaleString(); }
  function escape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
