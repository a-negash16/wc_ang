import { RESULTS_COLUMNS } from "./columns.js";
import { parseCSV } from "./csv.js";
import {
  clearElement,
  columnIndex,
  createElement,
  formatNumber,
  numberOrZero,
  setHidden,
  setStatus,
} from "./dom.js";

export async function loadResults(config, elements) {
  if (!config.resultsCsvUrl) {
    setHidden(elements.resultsStatus, true);
    elements.resultsEmpty.textContent = "Recent results will appear here once configured.";
    setHidden(elements.resultsEmpty, false);
    return;
  }

  try {
    const response = await fetch(config.resultsCsvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const records = parseResultRows(parseCSV(await response.text()));
    renderResults(records, config.resultsLimit, elements);
  } catch (error) {
    showResultsError(`Could not load recent results: ${error.message}`, elements);
  }
}

export function parseResultRows(rows) {
  if (rows.length < 2) {
    return [];
  }

  const header = rows[0].map((value) => value.trim().toLowerCase());
  const columns = columnIndex(header, RESULTS_COLUMNS);

  for (const key of ["stage", "teamA", "teamB"]) {
    if (columns[key] === -1) {
      throw new Error(`Recent_Results_CSV is missing column: ${RESULTS_COLUMNS[key]}`);
    }
  }

  return rows
    .slice(1)
    .map((row) => ({
      date: columns.date >= 0 ? row[columns.date] || "" : "",
      stage: row[columns.stage] || "",
      teamA: row[columns.teamA] || "",
      teamB: row[columns.teamB] || "",
      winner: columns.winner >= 0 ? row[columns.winner] || "" : "",
      length: columns.length >= 0 ? row[columns.length] || "" : "",
      correct: columns.correct >= 0 ? numberOrZero(row[columns.correct]) : 0,
      points: columns.points >= 0 ? numberOrZero(row[columns.points]) : 0,
    }))
    .filter((record) => record.stage && record.winner && record.teamA)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function renderResults(records, limit, elements) {
  if (records.length === 0) {
    showResultsEmpty(elements);
    return;
  }

  clearElement(elements.resultsGrid);
  for (const record of records.slice(0, limit)) {
    elements.resultsGrid.appendChild(createResultCard(record));
  }

  setHidden(elements.resultsStatus, true);
  setHidden(elements.resultsGrid, false);
  setHidden(elements.resultsEmpty, true);
}

function createResultCard(record) {
  const isDraw = record.winner.toLowerCase() === "draw";
  const teamAWon = !isDraw && record.winner === record.teamA;
  const teamBWon = !isDraw && record.winner === record.teamB;

  const card = createElement("article", { className: "match-card" });
  const header = createElement("div", { className: "match-head" });
  header.append(
    createElement("span", { className: "match-stage", text: record.stage }),
    createElement("span", { className: "match-date", text: record.date })
  );

  const teams = createElement("div", { className: "match-teams" });
  teams.append(
    createElement("div", {
      className: getTeamClass(teamAWon, isDraw),
      text: record.teamA,
    }),
    createElement("div", { className: "match-vs", text: "VS" }),
    createElement("div", {
      className: getTeamClass(teamBWon, isDraw),
      text: record.teamB,
    })
  );

  const footer = createElement("div", { className: "match-foot" });
  const stat = createElement("span", { className: "match-stat" });
  stat.append(
    createElement("strong", { text: formatNumber(record.correct) }),
    document.createTextNode(" correct · "),
    createElement("strong", { text: formatNumber(record.points) }),
    document.createTextNode(" pts awarded")
  );
  footer.appendChild(stat);

  if (record.length) {
    footer.appendChild(createElement("span", { className: "match-length", text: record.length }));
  }

  card.append(header, teams, footer);
  return card;
}

function getTeamClass(isWinner, isDraw) {
  return ["match-team", isWinner ? "is-winner" : "", isDraw ? "is-draw" : ""]
    .filter(Boolean)
    .join(" ");
}

function showResultsError(message, elements) {
  setStatus(elements.resultsStatus, message, true);
  setHidden(elements.resultsGrid, true);
  setHidden(elements.resultsEmpty, true);
}

function showResultsEmpty(elements) {
  setHidden(elements.resultsStatus, true);
  setHidden(elements.resultsGrid, true);
  setHidden(elements.resultsEmpty, false);
}
