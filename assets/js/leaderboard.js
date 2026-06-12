import { LEADERBOARD_COLUMNS } from "./columns.js";
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

export async function loadLeaderboard(config, elements) {
  try {
    const response = await fetch(config.leaderboardCsvUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rows = parseCSV(await response.text());
    if (rows.length < 2) {
      throw new Error("CSV has no data rows.");
    }

    const records = parseLeaderboardRows(rows);
    renderLeaderboard(records, elements);
  } catch (error) {
    showBoardError(`Could not load standings: ${error.message}`, elements);
  }
}

export function parseLeaderboardRows(rows) {
  const header = rows[0].map((value) => value.trim().toLowerCase());
  const columns = columnIndex(header, LEADERBOARD_COLUMNS);

  for (const key of ["rank", "name", "total"]) {
    if (columns[key] === -1) {
      throw new Error(`Landing_CSV is missing column: ${LEADERBOARD_COLUMNS[key]}`);
    }
  }

  return rows
    .slice(1)
    .map((row) => ({
      rank: parseInt(row[columns.rank], 10),
      name: row[columns.name] || "",
      total: numberOrZero(row[columns.total]),
      group: numberOrZero(row[columns.group]),
      knockout: numberOrZero(row[columns.knockout]),
      futures: numberOrZero(row[columns.futures]),
      teams: numberOrZero(row[columns.teams]),
      players: numberOrZero(row[columns.players]),
      updated: columns.updated >= 0 ? row[columns.updated] : "",
    }))
    .filter((record) => record.name)
    .sort(compareLeaderboardRecords);
}

function renderLeaderboard(records, elements) {
  clearElement(elements.boardBody);

  for (const record of records) {
    elements.boardBody.appendChild(createLeaderboardRow(record));
  }

  setHidden(elements.boardStatus, true);
  setHidden(elements.tableWrap, false);

  const leader = records[0];
  if (leader) {
    elements.heroStatus.textContent = `Live · ${leader.name} leads with ${formatNumber(leader.total)} pts`;
  }

  if (leader && leader.updated) {
    elements.footerUpdated.textContent = `Last updated: ${leader.updated}`;
  }
}

function createLeaderboardRow(record) {
  const row = createElement("tr", { className: getRankClass(record.rank) });
  row.append(
    createCell("td", String(record.rank || ""), "col-rank", "rank-medal"),
    createCell("td", record.name, "col-name"),
    createCell("td", formatNumber(record.total), "col-total"),
    createCell("td", formatNumber(record.group), "col-sub"),
    createCell("td", formatNumber(record.knockout), "col-sub"),
    createCell("td", formatNumber(record.futures), "col-sub"),
    createCell("td", formatNumber(record.teams), "col-sub"),
    createCell("td", formatNumber(record.players), "col-sub")
  );
  return row;
}

function createCell(tagName, text, className, innerClassName = "") {
  const cell = createElement(tagName, { className });
  if (innerClassName) {
    cell.appendChild(createElement("span", { className: innerClassName, text }));
    return cell;
  }
  cell.textContent = text;
  return cell;
}

function compareLeaderboardRecords(a, b) {
  if (!Number.isNaN(a.rank) && !Number.isNaN(b.rank)) {
    return a.rank - b.rank;
  }
  return b.total - a.total;
}

function getRankClass(rank) {
  if (rank === 1) return "rank-1";
  if (rank === 2) return "rank-2";
  if (rank === 3) return "rank-3";
  return "";
}

function showBoardError(message, elements) {
  setStatus(elements.boardStatus, message, true);
  setHidden(elements.tableWrap, true);
  elements.heroStatus.textContent = "Standings unavailable";
}
