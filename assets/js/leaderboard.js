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

  const rankChanges = getRankChanges(records);
  for (const record of records) {
    elements.boardBody.appendChild(createLeaderboardRow(record, rankChanges.get(record.name)));
  }
  saveRankSnapshot(records);

  setHidden(elements.boardStatus, true);
  setHidden(elements.tableWrap, false);

  if (records.length > 0) {
    elements.heroStatus.textContent = createHeroStatus(records);
  }

  const leader = records[0];
  if (leader && leader.updated) {
    elements.footerUpdated.textContent = `Last updated: ${leader.updated}`;
  }
}

function createHeroStatus(records) {
  const leaders = getLeaders(records);
  const lastPlaceManagers = getLastPlaceManagers(records);
  const leaderPoints = leaders[0]?.total ?? 0;
  const lastPlacePoints = lastPlaceManagers[0]?.total ?? 0;
  const leaderVerb = leaders.length === 1 ? "leads" : "lead";
  const lastVerb = lastPlaceManagers.length === 1 ? "is" : "are";

  return `Live · ⭐ ${formatNames(leaders)} ${leaderVerb} with ${formatNumber(leaderPoints)} pts · 🤡 ${formatNames(lastPlaceManagers)} ${lastVerb} last with ${formatNumber(lastPlacePoints)} pts`;
}

function getLeaders(records) {
  const firstRank = records.filter((record) => record.rank === 1);
  if (firstRank.length > 0) {
    return firstRank;
  }

  const topTotal = Math.max(...records.map((record) => record.total));
  return records.filter((record) => record.total === topTotal);
}

function getLastPlaceManagers(records) {
  const lowTotal = Math.min(...records.map((record) => record.total));
  return records.filter((record) => record.total === lowTotal);
}

function formatNames(records) {
  const names = records.map((record) => record.name);
  if (names.length <= 2) {
    return names.join(" and ");
  }
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function createLeaderboardRow(record, rankChange) {
  const row = createElement("tr", { className: getRankClass(record.rank) });
  row.append(
    createRankCell(record, rankChange),
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

function createRankCell(record, rankChange) {
  const cell = createElement("td", { className: "col-rank" });
  cell.appendChild(createElement("span", { className: "rank-medal", text: String(record.rank || "") }));

  if (rankChange && rankChange !== 0) {
    const improved = rankChange < 0;
    const indicator = createElement("span", {
      className: `rank-change ${improved ? "is-up" : "is-down"}`,
      attrs: {
        title: improved
          ? `Moved up ${Math.abs(rankChange)}`
          : `Moved down ${Math.abs(rankChange)}`,
        "aria-label": improved
          ? `Moved up ${Math.abs(rankChange)}`
          : `Moved down ${Math.abs(rankChange)}`,
      },
      text: `${improved ? "▲" : "▼"}${Math.abs(rankChange)}`,
    });
    cell.appendChild(indicator);
  }

  return cell;
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

function getRankChanges(records) {
  const previous = readRankSnapshot();
  const changes = new Map();

  for (const record of records) {
    const previousRank = previous[record.name];
    if (Number.isInteger(previousRank) && Number.isInteger(record.rank)) {
      changes.set(record.name, record.rank - previousRank);
    }
  }

  return changes;
}

function readRankSnapshot() {
  try {
    return JSON.parse(window.localStorage.getItem(getRankSnapshotKey()) || "{}");
  } catch (error) {
    return {};
  }
}

function saveRankSnapshot(records) {
  try {
    const snapshot = Object.fromEntries(
      records
        .filter((record) => record.name && Number.isInteger(record.rank))
        .map((record) => [record.name, record.rank])
    );
    window.localStorage.setItem(getRankSnapshotKey(), JSON.stringify(snapshot));
  } catch (error) {
    // Rank movement is an enhancement; standings should still render if storage is unavailable.
  }
}

function getRankSnapshotKey() {
  return `wc-ang-ranks:${window.location.pathname}`;
}
