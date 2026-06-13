import fs from "node:fs/promises";
import path from "node:path";

const SEASON_ID = "285023";
const FIFA_MATCHES_URL = `https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&idSeason=${SEASON_ID}`;
const DATA_DIR = path.resolve("assets/wc2026/data");

const FIFA_TO_FLAG_CODE = {
  ENG: "GB-ENG",
  SCO: "GB-SCT",
  WAL: "GB-WLS",
  NIR: "GB-NIR",
};

const GROUP_STAGE_ID = "289273";

async function main() {
  const [existingTeams, existingVenues, existingWeather] = await Promise.all([
    readJson(path.join(DATA_DIR, "teams.json"), { teams: {} }),
    readJson(path.join(DATA_DIR, "venues.json"), { venues: {} }),
    readJson(path.join(DATA_DIR, "weather.json"), {}),
  ]);

  const fifaData = await fetchJson(FIFA_MATCHES_URL);
  const fifaMatches = Array.isArray(fifaData.Results) ? fifaData.Results : [];
  if (fifaMatches.length === 0) {
    throw new Error("FIFA response did not include any matches.");
  }

  const teamIdToCode = new Map();
  const teams = { ...(existingTeams.teams || {}) };
  const venues = { ...(existingVenues.venues || {}) };

  for (const match of fifaMatches) {
    for (const side of [match.Home, match.Away]) {
      if (!side?.Abbreviation) continue;
      teamIdToCode.set(String(side.IdTeam), side.Abbreviation);
      teams[side.Abbreviation] = mergeTeam(teams[side.Abbreviation], side, match);
    }

    if (match.Stadium?.IdStadium) {
      venues[String(match.Stadium.IdStadium)] = mergeVenue(
        venues[String(match.Stadium.IdStadium)],
        match.Stadium
      );
    }
  }

  const matches = fifaMatches
    .map((match) => normalizeMatch(match, teamIdToCode))
    .sort((a, b) => a.n - b.n);

  const meta = {
    updatedAt: new Date().toISOString(),
    season: SEASON_ID,
    counts: {
      matches: matches.length,
      teams: Object.keys(teams).length,
      venues: Object.keys(venues).length,
      weather: Object.keys(existingWeather).length,
    },
    sources: ["api.fifa.com"],
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await Promise.all([
    writeJson(path.join(DATA_DIR, "matches.json"), { matches }),
    writeJson(path.join(DATA_DIR, "teams.json"), { teams }),
    writeJson(path.join(DATA_DIR, "venues.json"), { venues }),
    writeJson(path.join(DATA_DIR, "weather.json"), existingWeather),
    writeJson(path.join(DATA_DIR, "meta.json"), meta),
  ]);

  console.log(`Refreshed ${matches.length} matches at ${meta.updatedAt}.`);
}

function normalizeMatch(match, teamIdToCode) {
  const home = normalizeSide(match.Home, match.HomeTeamScore);
  const away = normalizeSide(match.Away, match.AwayTeamScore);

  return {
    id: String(match.IdMatch),
    n: Number(match.MatchNumber),
    stage: normalizeStage(match),
    group: normalizeGroup(match),
    date: match.Date,
    venueId: match.Stadium?.IdStadium ? String(match.Stadium.IdStadium) : null,
    status: normalizeStatus(match),
    time: match.MatchTime || null,
    home,
    away,
    phA: match.PlaceHolderA || null,
    phB: match.PlaceHolderB || null,
    winner: match.Winner ? teamIdToCode.get(String(match.Winner)) || null : null,
    attendance: match.Attendance || null,
    officials: normalizeOfficials(match.Officials),
  };
}

function normalizeSide(side, score) {
  return {
    code: side?.Abbreviation || null,
    score: score ?? side?.Score ?? null,
    pen: null,
  };
}

function normalizeStatus(match) {
  if (match.MatchStatus === 0 && match.ResultType) return "finished";
  if (match.MatchStatus === 2 || match.MatchStatus === 3) return "live";
  return "scheduled";
}

function normalizeStage(match) {
  if (String(match.IdStage) === GROUP_STAGE_ID) return "group";
  const stage = getLocalized(match.StageName, "").toLowerCase();
  if (stage.includes("round of 32")) return "r32";
  if (stage.includes("round of 16")) return "r16";
  if (stage.includes("quarter")) return "qf";
  if (stage.includes("semi")) return "sf";
  if (stage.includes("third")) return "third";
  if (stage.includes("final")) return "final";
  return stage || "unknown";
}

function normalizeGroup(match) {
  const groupName = getLocalized(match.GroupName, "");
  const matchResult = groupName.match(/Group\s+([A-Z])/i);
  return matchResult ? matchResult[1].toUpperCase() : null;
}

function normalizeOfficials(officials = []) {
  return officials.map((official) => ({
    id: official.OfficialId ? String(official.OfficialId) : null,
    country: official.IdCountry || null,
    role: getLocalized(official.TypeLocalized, "").toLowerCase() || null,
    name: {
      en: getLocalized(official.NameShort, getLocalized(official.Name, "")),
    },
    typeName: {
      en: getLocalized(official.TypeLocalized, ""),
    },
  }));
}

function mergeTeam(existing = {}, side, match) {
  const code = side.Abbreviation;
  const team = {
    ...existing,
    code,
    fifaId: side.IdTeam ? String(side.IdTeam) : existing.fifaId,
    group: normalizeGroup(match) || existing.group || null,
    name: {
      ...(existing.name || {}),
      en: getLocalized(side.TeamName, side.ShortClubName || code),
    },
    iso2: existing.iso2 || getIso2(code),
    flag: existing.flag || side.PictureUrl?.replace("{format}", "sq").replace("{size}", "3") || null,
  };

  return team;
}

function mergeVenue(existing = {}, stadium) {
  const id = String(stadium.IdStadium);
  return {
    ...existing,
    id,
    name: {
      ...(typeof existing.name === "object" ? existing.name : {}),
      en: getLocalized(stadium.Name, existing.name || ""),
    },
    city: existing.city || getLocalized(stadium.CityName, ""),
    cityName: {
      ...(existing.cityName || {}),
      en: getLocalized(stadium.CityName, existing.city || ""),
    },
    country: existing.country || getIso2(stadium.IdCountry) || stadium.IdCountry || null,
    capacity: existing.capacity || stadium.Capacity || null,
  };
}

function getIso2(fifaCode) {
  return FIFA_TO_FLAG_CODE[fifaCode] || null;
}

function getLocalized(values, fallback) {
  if (!Array.isArray(values)) return fallback;
  return (
    values.find((value) => value.Locale === "en-GB")?.Description ||
    values.find((value) => value.Locale?.startsWith("en"))?.Description ||
    values[0]?.Description ||
    fallback
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "wc-ang-data-refresh/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return response.json();
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 1)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
