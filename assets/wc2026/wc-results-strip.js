import { clearElement, createElement, setHidden } from "../js/dom.js";
import { getMatches } from "./wc-data.js";

const FINISHED_LIMIT = 12;

export async function renderWcResultsStrip(mountEl) {
  clearElement(mountEl);
  setHidden(mountEl, false);

  const matches = await getMatches();
  const finishedMatches = matches
    .filter((match) => match.status === "finished")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, FINISHED_LIMIT);

  if (finishedMatches.length === 0) {
    mountEl.appendChild(createElement("p", { className: "wc-empty", text: "No completed matches yet." }));
    return;
  }

  const shell = createElement("div", { className: "wc-strip-shell" });
  const track = createElement("div", { className: "wc-strip-track" });

  for (const match of finishedMatches) {
    track.appendChild(createMatchCard(match));
  }

  const prevButton = createArrowButton("prev", "Previous World Cup result");
  const nextButton = createArrowButton("next", "Next World Cup result");
  prevButton.addEventListener("click", () => scrollTrack(track, -1));
  nextButton.addEventListener("click", () => scrollTrack(track, 1));

  shell.append(prevButton, track, nextButton);
  mountEl.appendChild(shell);
}

function createMatchCard(match) {
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
    createElement("div", { className: "st", text: "Full time" }),
    createElement("div", { className: "dt", text: formatShortDate(match.date) })
  );

  middle.append(teams, when);
  card.append(top, middle);
  return card;
}

function createTeamRow(side, match) {
  const rowClasses = ["wc-row"];
  if (match.winner && side.code !== match.winner) {
    rowClasses.push("loser");
  }

  const row = createElement("div", { className: rowClasses.join(" ") });
  row.append(createFlag(side), createElement("span", { className: "nm", text: side.name }));
  row.appendChild(createElement("span", { className: "score", text: String(side.score) }));
  return row;
}

function createFlag(side) {
  const flag = createElement("img", {
    className: "wc-flag",
    attrs: {
      src: side.flagPath,
      width: "24",
      height: "18",
      loading: "lazy",
      alt: side.name,
    },
  });
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
