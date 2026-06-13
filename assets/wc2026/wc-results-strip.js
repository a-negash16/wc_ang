import { clearElement, createElement, numberOrZero, setHidden } from "../js/dom.js";
import { parseCSV } from "../js/csv.js";
import { getMatches } from "./wc-data.js";

const FINISHED_LIMIT = 8;
const UPCOMING_LIMIT = 8;
const PREDICTION_PULSE_COLUMNS = {
  matchId: "match_id",
  teamA: "team_a_picks",
  draw: ["draw_picks", "tie_picks"],
  teamB: "team_b_picks",
  total: "total_picks",
  teamAName: ["team_a", "home_team"],
  teamBName: ["team_b", "away_team"],
  teamAManagers: ["team_a_managers", "home_managers"],
  drawManagers: ["draw_managers", "tie_managers"],
  teamBManagers: ["team_b_managers", "away_managers"],
};

export async function renderWcResultsStrip(mountEl, options = {}) {
  clearElement(mountEl);
  setHidden(mountEl, false);

  const [matches, pulseByMatchId] = await Promise.all([
    getMatches(options),
    loadPredictionPulse(options.config),
  ]);
  warnForUnmatchedPulseRows(pulseByMatchId, matches);
  const now = new Date();
  const upcomingMatches = getUpcomingMatches(matches, now);
  const finishedMatches = matches
    .filter((match) => match.status === "finished")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, FINISHED_LIMIT);

  const variant = options.variant || "all";
  if (variant === "upcoming") {
    renderMatchSet(
      mountEl,
      upcomingMatches,
      pulseByMatchId,
      "Today / Up next",
      "No upcoming matches available yet.",
      "Previous upcoming match",
      "Next upcoming match",
      { showManagers: true }
    );
    return;
  }

  if (variant === "finished") {
    renderMatchSet(
      mountEl,
      finishedMatches,
      pulseByMatchId,
      "Latest finals",
      "No completed matches yet.",
      "Previous World Cup result",
      "Next World Cup result",
      { showManagers: false }
    );
    return;
  }

  if (upcomingMatches.length > 0) {
    mountEl.appendChild(
      createMatchRail("Today / Up next", upcomingMatches, pulseByMatchId, "Previous upcoming match", "Next upcoming match", { showManagers: true })
    );
  }

  if (finishedMatches.length > 0) {
    mountEl.appendChild(
      createMatchRail("Latest finals", finishedMatches, pulseByMatchId, "Previous World Cup result", "Next World Cup result", { showManagers: false })
    );
  }
}

function renderMatchSet(mountEl, matches, pulseByMatchId, title, emptyText, prevLabel, nextLabel, railOptions = {}) {
  if (matches.length === 0) {
    mountEl.appendChild(createElement("p", { className: "wc-empty", text: emptyText }));
    return;
  }

  mountEl.appendChild(createMatchRail(title, matches, pulseByMatchId, prevLabel, nextLabel, railOptions));
}

function getUpcomingMatches(matches, now) {
  const activeMatches = matches
    .filter((match) => match.status !== "finished")
    .sort((a, b) => a.date.localeCompare(b.date));

  const todayMatches = activeMatches.filter((match) => isSameLocalDay(new Date(match.date), now));
  return (todayMatches.length > 0 ? todayMatches : activeMatches).slice(0, UPCOMING_LIMIT);
}

function createMatchRail(title, matches, pulseByMatchId, prevLabel, nextLabel, railOptions = {}) {
  const shell = createElement("div", { className: "wc-strip-shell" });
  shell.appendChild(createElement("h3", { className: "wc-rail-title", text: title }));

  const track = createElement("div", { className: "wc-strip-track" });

  for (const match of matches) {
    track.appendChild(createMatchCard(match, getPulseForMatch(pulseByMatchId, match), railOptions));
  }

  const prevButton = createArrowButton("prev", prevLabel);
  const nextButton = createArrowButton("next", nextLabel);
  prevButton.addEventListener("click", () => scrollTrack(track, -1));
  nextButton.addEventListener("click", () => scrollTrack(track, 1));

  shell.append(prevButton, track, nextButton);
  return shell;
}

function createMatchCard(match, pulse, options = {}) {
  const card = createElement("article", { className: "wc-card" });
  const top = createElement("div", { className: "wc-top" });

  top.append(
    createElement("span", { text: `Match ${match.n}` }),
    createElement("span", {
      className: "wc-chip",
      text: match.stage === "group" && match.group ? `Group ${match.group}` : formatStage(match.stage),
    })
  );

  if (match.venueCity) {
    top.appendChild(createElement("span", { text: match.venueCity }));
  }

  top.appendChild(createElement("span", { className: "wc-spacer" }));

  const middle = createElement("div", { className: "wc-mid" });
  const teams = createElement("div", { className: "wc-teams" });
  teams.append(createTeamRow(match.home, match), createTeamRow(match.away, match));

  const when = createElement("div", { className: "wc-when" });
  when.append(
    createElement("div", { className: "st", text: getStatusLabel(match) }),
    createElement("div", { className: "dt", text: formatMatchDate(match) })
  );

  middle.append(teams, when);
  card.append(top, middle);

  if (pulse) {
    card.appendChild(createPulse(pulse, match, options));
  }

  return card;
}

function createTeamRow(side, match) {
  const rowClasses = ["wc-row"];
  if (match.winner && side?.code !== match.winner) {
    rowClasses.push("loser");
  }

  const row = createElement("div", { className: rowClasses.join(" ") });
  row.append(createFlag(side), createElement("span", { className: "nm", text: side?.name || "TBD" }));
  row.appendChild(createElement("span", {
    className: "score",
    text: match.status === "finished" && side?.score != null ? String(side.score) : "–",
  }));
  return row;
}

function createPulse(pulse, match, options = {}) {
  const total = pulse.total || pulse.teamA + pulse.draw + pulse.teamB;
  if (!total) {
    return createElement("div", { className: "wc-pulse wc-pulse-empty", text: "Prediction pulse pending" });
  }

  const pulseEl = createElement("div", { className: "wc-pulse" });
  pulseEl.appendChild(createElement("div", { className: "wc-pulse-label", text: "Prediction pulse" }));
  const bar = createElement("div", { className: "wc-pulse-bar" });

  bar.append(
    createPulseSegment("home", pulse.teamA, total),
    createPulseSegment("tie", pulse.draw, total),
    createPulseSegment("away", pulse.teamB, total)
  );

  const split = createElement("div", { className: "wc-pulse-split" });
  split.append(
    createElement("span", { text: `${Math.round((pulse.teamA / total) * 100)}% home` }),
    createElement("span", { text: `${Math.round((pulse.draw / total) * 100)}% tie` }),
    createElement("span", { text: `${Math.round((pulse.teamB / total) * 100)}% away` })
  );

  pulseEl.append(bar, split);
  if (options.showManagers) {
    const managerList = createPulseManagers(pulse, match);
    if (managerList) {
      pulseEl.appendChild(managerList);
    }
  }
  return pulseEl;
}

function createPulseManagers(pulse, match) {
  const groups = [
    {
      label: match.home?.name || "Home",
      managers: pulse.teamAManagers,
    },
    {
      label: "Tie",
      managers: pulse.drawManagers,
    },
    {
      label: match.away?.name || "Away",
      managers: pulse.teamBManagers,
    },
  ].filter((group) => group.managers);

  if (groups.length === 0) return null;

  const list = createElement("div", { className: "wc-pulse-managers" });
  for (const group of groups) {
    const row = createElement("div", { className: "wc-pulse-manager-row" });
    row.append(
      createElement("span", { className: "wc-pulse-manager-label", text: group.label }),
      createElement("span", { className: "wc-pulse-manager-names", text: group.managers })
    );
    list.appendChild(row);
  }

  return list;
}

function createPulseSegment(kind, value, total) {
  const segment = createElement("span", {
    className: `wc-pulse-segment ${kind}`,
    attrs: { style: `width: ${Math.max((value / total) * 100, value > 0 ? 6 : 0)}%` },
  });
  return segment;
}

async function loadPredictionPulse(config) {
  if (!config?.predictionPulseCsvUrl) return new Map();

  try {
    const response = await fetch(config.predictionPulseCsvUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = parseCSV(await response.text());
    return parsePredictionPulseRows(rows);
  } catch (error) {
    console.error("Could not load prediction pulse:", error);
    return new Map();
  }
}

function parsePredictionPulseRows(rows) {
  if (rows.length < 2) return new Map();
  const header = rows[0].map((value) => value.trim().toLowerCase());
  const columns = columnIndexWithAliases(header, PREDICTION_PULSE_COLUMNS);
  const pulseByMatchId = new Map();

  if (columns.matchId === -1) return pulseByMatchId;

  for (const row of rows.slice(1)) {
    const matchId = row[columns.matchId];
    const teamAName = cleanText(row[columns.teamAName]);
    const teamBName = cleanText(row[columns.teamBName]);
    if (!matchId && (!teamAName || !teamBName)) continue;

    const pulse = {
      teamA: numberOrZero(row[columns.teamA]),
      draw: numberOrZero(row[columns.draw]),
      teamB: numberOrZero(row[columns.teamB]),
      total: columns.total >= 0 ? numberOrZero(row[columns.total]) : 0,
      teamAManagers: cleanManagerList(row[columns.teamAManagers]),
      drawManagers: cleanManagerList(row[columns.drawManagers]),
      teamBManagers: cleanManagerList(row[columns.teamBManagers]),
    };

    if (matchId) {
      pulseByMatchId.set(`id:${matchId}`, pulse);
    }
    if (teamAName && teamBName) {
      pulseByMatchId.set(getTeamPairKey(teamAName, teamBName), pulse);
    }
    addPulseSourceRow(pulseByMatchId, {
      matchId,
      teamAName,
      teamBName,
      idKey: matchId ? `id:${matchId}` : "",
      pairKey: teamAName && teamBName ? getTeamPairKey(teamAName, teamBName) : "",
    });
  }

  return pulseByMatchId;
}

function addPulseSourceRow(pulseByMatchId, row) {
  if (!pulseByMatchId.sourceRows) {
    pulseByMatchId.sourceRows = [];
  }
  pulseByMatchId.sourceRows.push(row);
}

function cleanManagerList(value) {
  const text = cleanText(value);
  if (!text || text === "#N/A") return "";
  return text;
}

function cleanText(value) {
  return String(value || "").trim();
}

function columnIndexWithAliases(header, columns) {
  return Object.fromEntries(
    Object.entries(columns).map(([key, columnNames]) => {
      const names = Array.isArray(columnNames) ? columnNames : [columnNames];
      return [key, names.reduce((found, name) => (found >= 0 ? found : header.indexOf(name)), -1)];
    })
  );
}

function getPulseForMatch(pulseByMatchId, match) {
  return pulseByMatchId.get(`id:${match.id}`)
    || pulseByMatchId.get(getTeamPairKey(match.home?.name, match.away?.name));
}

function warnForUnmatchedPulseRows(pulseByMatchId, matches) {
  if (!pulseByMatchId.sourceRows?.length) return;

  const matchKeys = new Set();
  for (const match of matches) {
    matchKeys.add(`id:${match.id}`);
    matchKeys.add(getTeamPairKey(match.home?.name, match.away?.name));
  }

  const unmatchedRows = pulseByMatchId.sourceRows.filter((row) => {
    return (!row.idKey || !matchKeys.has(row.idKey)) && (!row.pairKey || !matchKeys.has(row.pairKey));
  });

  if (unmatchedRows.length > 0) {
    console.warn(
      "Prediction pulse rows did not match any World Cup match:",
      unmatchedRows.map((row) => ({
        match_id: row.matchId,
        team_a: row.teamAName,
        team_b: row.teamBName,
      }))
    );
  }
}

function getTeamPairKey(teamAName, teamBName) {
  return `teams:${normalizeTeamName(teamAName)}:${normalizeTeamName(teamBName)}`;
}

function normalizeTeamName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function createFlag(side) {
  const flag = createElement("img", {
    className: "wc-flag",
    attrs: {
      src: side?.flagPath || "",
      width: "24",
      height: "18",
      loading: "lazy",
      alt: side?.name || "",
    },
  });
  if (!side?.flagPath) {
    flag.style.display = "none";
  }
  flag.addEventListener("error", () => {
    flag.style.display = "none";
  });
  return flag;
}

function createArrowButton(direction, label) {
  return createElement("button", {
    className: "wc-arrow",
    attrs: {
      type: "button",
      "data-dir": direction,
      "aria-label": label,
    },
    text: direction === "prev" ? "‹" : "›",
  });
}

function scrollTrack(track, direction) {
  const firstCard = track.querySelector(".wc-card");
  const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 280;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  track.scrollBy({
    left: direction * (cardWidth + 24),
    behavior: reducedMotion ? "auto" : "smooth",
  });
}

function isSameLocalDay(date, otherDate) {
  return date.getFullYear() === otherDate.getFullYear()
    && date.getMonth() === otherDate.getMonth()
    && date.getDate() === otherDate.getDate();
}

function getStatusLabel(match) {
  if (match.status === "finished") return "Full time";
  return "Kickoff";
}

function formatMatchDate(match) {
  if (match.status !== "finished") {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(match.date));
  }
  return formatShortDate(match.date);
}

function formatShortDate(dateValue) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(dateValue));
}

function formatStage(stage) {
  const labels = {
    r32: "Round of 32",
    r16: "Round of 16",
    qf: "Quarterfinal",
    sf: "Semifinal",
    third: "Third place",
    final: "Final",
  };
  return labels[stage] || stage;
}
