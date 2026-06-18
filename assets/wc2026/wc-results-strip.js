import { clearElement, createElement, numberOrZero, setHidden } from "../js/dom.js";
import { parseCSV } from "../js/csv.js";
import { getMatches } from "./wc-data.js";

const FINISHED_LIMIT = 8;
const UPCOMING_LIMIT = 8;
const PREDICTION_LOCK_MS = 60 * 60 * 1000;
const PREDICTION_SESSION_KEY = "wc_ang_prediction_session";
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
  const upcomingMatchGroups = getUpcomingMatchGroups(matches, now);
  const finishedMatches = matches
    .filter((match) => match.status === "finished")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, FINISHED_LIMIT);

  const variant = options.variant || "all";
  if (variant === "upcoming") {
    const showPredictionForm = Boolean(options.config?.enablePredictionSubmissions || options.config?.predictionSubmitUrl);
    renderUpcomingMatchSets(
      mountEl,
      upcomingMatchGroups,
      pulseByMatchId,
      "No upcoming matches available yet.",
      "Previous upcoming match",
      "Next upcoming match",
      { config: options.config, showManagers: true, showPredictionForm, now }
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

  renderUpcomingMatchSets(mountEl, upcomingMatchGroups, pulseByMatchId, "", "Previous upcoming match", "Next upcoming match", {
    showManagers: true,
    showPredictionForm: Boolean(options.config?.enablePredictionSubmissions || options.config?.predictionSubmitUrl),
    config: options.config,
    now,
  });

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

function renderUpcomingMatchSets(mountEl, groups, pulseByMatchId, emptyText, prevLabel, nextLabel, railOptions = {}) {
  const visibleGroups = groups.filter((group) => group.matches.length > 0);
  if (visibleGroups.length === 0) {
    if (emptyText) mountEl.appendChild(createElement("p", { className: "wc-empty", text: emptyText }));
    return;
  }

  if (railOptions.showPredictionForm) {
    mountEl.appendChild(createPredictionAuthPanel(railOptions.config));
  }

  for (const group of visibleGroups) {
    mountEl.appendChild(createMatchRail(group.title, group.matches, pulseByMatchId, prevLabel, nextLabel, railOptions));
  }
}

function getUpcomingMatchGroups(matches, now) {
  const activeMatches = matches
    .filter((match) => match.status !== "finished")
    .sort((a, b) => a.date.localeCompare(b.date));

  const openForPicks = activeMatches.filter((match) => !isPredictionLocked(match, now));
  const todayOpen = openForPicks.filter((match) => isSameLocalDay(new Date(match.date), now));
  const tomorrowOpen = openForPicks.filter((match) => isSameLocalDay(new Date(match.date), addDays(now, 1)));
  const laterOpen = openForPicks.filter((match) => {
    const matchDate = new Date(match.date);
    return !isSameLocalDay(matchDate, now) && !isSameLocalDay(matchDate, addDays(now, 1));
  });
  const lockedTodayMatches = activeMatches.filter((match) => {
    const matchDate = new Date(match.date);
    return isSameLocalDay(matchDate, now) && isPredictionLocked(match, now);
  });

  return [
    { title: "Open for prediction · Today", matches: todayOpen.slice(0, UPCOMING_LIMIT) },
    { title: "Open for prediction · Tomorrow", matches: tomorrowOpen.slice(0, UPCOMING_LIMIT) },
    { title: "Open for prediction · Later", matches: laterOpen.slice(0, 4) },
    { title: "Deadline passed · Today", matches: lockedTodayMatches.slice(0, 4) },
  ];
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

  if (options.showPredictionForm) {
    card.appendChild(createPredictionPanel(match, options));
  }

  if (pulse && shouldShowPulse(match, options)) {
    card.appendChild(createPulse(pulse, match, options));
  } else if (pulse && options.showPredictionForm) {
    card.appendChild(createPulseLocked(match, options));
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

function createPredictionPanel(match, options = {}) {
  const isLocked = isPredictionLocked(match, options.now);
  const panel = createElement("form", {
    className: ["wc-pick-panel", isLocked ? "is-locked" : ""].filter(Boolean).join(" "),
    attrs: {
      "data-match-id": match.id,
      "data-locks-at": getPredictionDeadline(match).toISOString(),
    },
  });

  panel.appendChild(createElement("div", {
    className: "wc-pick-countdown",
    text: isLocked ? "Prediction deadline passed" : `Locks in ${formatTimeUntilLock(match, options.now)}`,
  }));

  if (isLocked) {
    return panel;
  }

  startPredictionCountdown(panel, match);
  const session = getPredictionSession(options.config);
  const canSubmit = Boolean(options.config?.predictionSubmitUrl && session?.token);

  const choices = createElement("div", { className: "wc-pick-options" });
  choices.append(
    createPickButton(match.home?.name || "Home", match.home?.code || "home", !canSubmit),
    createPickButton("Tie", "Tie", !canSubmit),
    createPickButton(match.away?.name || "Away", match.away?.code || "away", !canSubmit)
  );

  const status = createElement("div", {
    className: "wc-pick-status",
    attrs: { role: "status", "aria-live": "polite" },
    text: canSubmit
      ? `Unlocked as ${session.displayName || session.managerId}. Pick can be changed until the deadline.`
      : options.config?.predictionSubmitUrl
        ? "Unlock once above to submit picks."
      : "Submission API not connected yet.",
  });

  panel.append(choices, status);
  panel.addEventListener("submit", (event) => submitPrediction(event, match, options, status));
  return panel;
}

function createPickButton(label, value, isLocked) {
  return createElement("button", {
    className: "wc-pick-button",
    attrs: {
      type: "submit",
      name: "pick",
      value,
      disabled: isLocked ? "" : undefined,
    },
    text: label,
  });
}

function createPulseLocked(match, options = {}) {
  const text = isPredictionLocked(match, options.now)
    ? "Prediction pulse ready"
    : `Prediction pulse unlocks in ${formatTimeUntilLock(match, options.now)}`;
  return createElement("div", { className: "wc-pulse wc-pulse-empty", text });
}

async function submitPrediction(event, match, options, statusEl) {
  event.preventDefault();
  const submitUrl = options.config?.predictionSubmitUrl;
  if (!submitUrl) {
    setPickStatus(statusEl, "Submission API not connected yet.", true);
    return;
  }

  if (isPredictionLocked(match)) {
    setPickStatus(statusEl, "Deadline passed. Pick is locked.", true);
    return;
  }

  const submitter = event.submitter;
  const session = getPredictionSession(options.config);
  const pick = String(submitter?.value || "");
  const allowedPicks = new Set([match.home?.code, "Tie", match.away?.code].filter(Boolean));

  if (!session?.token) {
    setPickStatus(statusEl, "Unlock once above before submitting picks.", true);
    return;
  }
  if (!allowedPicks.has(pick)) {
    setPickStatus(statusEl, "Pick is not valid for this match.", true);
    return;
  }

  setPickStatus(statusEl, "Saving pick...", false);
  try {
    const response = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "submit_prediction",
        token: session.token,
        manager_id: session.managerId,
        group_slug: options.config?.theme || "",
        match_id: match.id,
        pick,
        home_code: match.home?.code || "",
        away_code: match.away?.code || "",
        kickoff_at: match.date,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.message || `HTTP ${response.status}`);
    }
    setPickStatus(statusEl, payload.message || "Prediction saved.", false);
  } catch (error) {
    setPickStatus(statusEl, `Could not save pick: ${error.message}`, true);
  }
}

function createPredictionAuthPanel(config) {
  const session = getPredictionSession(config);
  const panel = createElement("form", {
    className: ["wc-auth-panel", session ? "is-unlocked" : ""].filter(Boolean).join(" "),
  });

  const summary = createElement("div", { className: "wc-auth-summary" });
  summary.append(
    createElement("span", { className: "wc-auth-kicker", text: "Manager picks" }),
    createElement("strong", {
      text: session
        ? `Unlocked as ${session.displayName || session.managerId}`
        : "Unlock once, then tap your picks",
    })
  );

  const controls = createElement("div", { className: "wc-auth-controls" });
  const managerInput = createElement("input", {
    className: "wc-pick-input",
    attrs: {
      type: "text",
      name: "manager_id",
      placeholder: "Manager",
      autocomplete: "username",
      required: "",
      disabled: session ? "" : undefined,
    },
  });
  const pinInput = createElement("input", {
    className: "wc-pick-input",
    attrs: {
      type: "password",
      name: "pin",
      placeholder: "PIN",
      autocomplete: "current-password",
      inputmode: "numeric",
      required: "",
      disabled: session ? "" : undefined,
    },
  });
  const unlockButton = createElement("button", {
    className: "wc-auth-button",
    attrs: {
      type: session ? "button" : "submit",
      disabled: config?.predictionSubmitUrl ? undefined : "",
    },
    text: session ? "Switch" : "Unlock",
  });
  controls.append(managerInput, pinInput, unlockButton);

  const status = createElement("div", {
    className: "wc-pick-status",
    attrs: { role: "status", "aria-live": "polite" },
    text: config?.predictionSubmitUrl
      ? session
        ? "Your PIN is not stored in this browser."
        : "PIN is checked by the private prediction API."
      : "Submission API not connected yet.",
  });

  if (session) {
    unlockButton.addEventListener("click", () => {
      clearPredictionSession();
      window.location.reload();
    });
  } else {
    panel.addEventListener("submit", (event) => unlockPredictionSession(event, config, status));
  }

  panel.append(summary, controls, status);
  return panel;
}

async function unlockPredictionSession(event, config, statusEl) {
  event.preventDefault();
  const submitUrl = config?.predictionSubmitUrl;
  if (!submitUrl) {
    setPickStatus(statusEl, "Submission API not connected yet.", true);
    return;
  }

  const form = event.currentTarget;
  const managerId = String(form.elements.manager_id?.value || "").trim();
  const pin = String(form.elements.pin?.value || "");
  if (!managerId || !pin) {
    setPickStatus(statusEl, "Manager and PIN are required.", true);
    return;
  }

  setPickStatus(statusEl, "Unlocking...", false);
  try {
    const response = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "login",
        manager_id: managerId,
        pin,
        group_slug: config.theme || "",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false || !payload.token) {
      throw new Error(payload.message || `HTTP ${response.status}`);
    }
    savePredictionSession(config, {
      token: payload.token,
      managerId: payload.manager_id || managerId,
      displayName: payload.display_name || managerId,
      groupSlug: payload.group_slug || config.theme || "",
      expiresAt: payload.expires_at || "",
    });
    window.location.reload();
  } catch (error) {
    setPickStatus(statusEl, `Could not unlock: ${error.message}`, true);
  }
}

function getPredictionSession(config) {
  try {
    const session = JSON.parse(window.sessionStorage.getItem(PREDICTION_SESSION_KEY) || "null");
    if (!session?.token || session.groupSlug !== (config?.theme || "")) return null;
    if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
      clearPredictionSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function savePredictionSession(config, session) {
  window.sessionStorage.setItem(PREDICTION_SESSION_KEY, JSON.stringify({
    token: session.token,
    managerId: session.managerId,
    displayName: session.displayName,
    groupSlug: session.groupSlug || config?.theme || "",
    expiresAt: session.expiresAt,
  }));
}

function clearPredictionSession() {
  window.sessionStorage.removeItem(PREDICTION_SESSION_KEY);
}

function setPickStatus(element, message, isError) {
  element.textContent = message;
  element.classList.toggle("is-error", Boolean(isError));
}

function startPredictionCountdown(panel, match) {
  const countdownEl = panel.querySelector(".wc-pick-countdown");
  const update = () => {
    if (!panel.isConnected) {
      window.clearInterval(timer);
      return;
    }

    const isLocked = isPredictionLocked(match);
    countdownEl.textContent = isLocked
      ? "Prediction deadline passed"
      : `Locks in ${formatTimeUntilLock(match)}`;
    panel.classList.toggle("is-locked", isLocked);
    panel.querySelectorAll("input, button").forEach((control) => {
      control.disabled = isLocked;
    });
  };
  const timer = window.setInterval(update, 60000);
  update();
}

function shouldShowPulse(match, options = {}) {
  return !options.showPredictionForm || isPredictionLocked(match, options.now);
}

function isPredictionLocked(match, now = new Date()) {
  return new Date(now).getTime() >= getPredictionDeadline(match).getTime();
}

function getPredictionDeadline(match) {
  return new Date(new Date(match.date).getTime() - PREDICTION_LOCK_MS);
}

function formatTimeUntilLock(match, now = new Date()) {
  const diffMs = Math.max(0, getPredictionDeadline(match).getTime() - new Date(now).getTime());
  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
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

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
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
