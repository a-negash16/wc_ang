const DEFAULT_DATA_BASE_URL = new URL("./data/", import.meta.url).href;
const DEFAULT_FLAG_BASE_PATH = new URL("./flags/", import.meta.url).href;

const DATA_FILES = {
  matches: "matches.json",
  teams: "teams.json",
  venues: "venues.json",
  weather: "weather.json",
  meta: "meta.json",
};

const FIFA_TO_FLAG_CODE = {
  ENG: "GB-ENG",
  SCO: "GB-SCT",
  WAL: "GB-WLS",
  NIR: "GB-NIR",
};

let dataPromise = null;
let metaPromise = null;

export async function getMatches(options = {}) {
  const { matches, teams, venues, weather } = await loadCoreData(options);

  return matches.map((match) => {
    const venue = match.venueId ? venues[match.venueId] : null;
    const forecast = weather[match.id] || null;

    return {
      id: match.id,
      n: match.n,
      stage: match.stage,
      group: match.group || null,
      date: match.date,
      status: match.status,
      time: match.time || null,
      winner: match.winner || null,
      home: joinSide(match.home, teams, options),
      away: joinSide(match.away, teams, options),
      venueCity: getEnglishName(venue?.cityName, venue?.city || null),
      tempF: forecast && typeof forecast.tC === "number" ? celsiusToFahrenheit(forecast.tC) : null,
    };
  });
}

export async function getTitleOdds(options = {}) {
  const meta = await loadMeta(options);
  return Array.isArray(meta.titleOdds) ? meta.titleOdds : [];
}

async function loadCoreData(options) {
  if (options.forceRefresh) {
    dataPromise = null;
  }

  if (!dataPromise) {
    dataPromise = Promise.all([
      fetchJson(DATA_FILES.matches, options),
      fetchJson(DATA_FILES.teams, options),
      fetchJson(DATA_FILES.venues, options),
      fetchJson(DATA_FILES.weather, options),
    ]).then(([matchesData, teamsData, venuesData, weatherData]) => ({
      matches: matchesData.matches || [],
      teams: teamsData.teams || {},
      venues: venuesData.venues || {},
      weather: weatherData || {},
    }));
  }

  return dataPromise;
}

async function loadMeta(options) {
  if (!metaPromise) {
    metaPromise = fetchJson(DATA_FILES.meta, options);
  }
  return metaPromise;
}

async function fetchJson(fileName, options) {
  const response = await fetch(new URL(fileName, getDataBaseUrl(options)).href, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`${fileName}: HTTP ${response.status}`);
  }
  return response.json();
}

function joinSide(side, teams, options) {
  if (!side || !side.code) {
    return null;
  }

  const team = teams[side.code] || {};
  const iso2 = getFlagCode(side.code, team);

  return {
    code: side.code,
    name: getEnglishName(team.name, side.code),
    iso2,
    flagPath: iso2 ? `${getFlagBasePath(options)}${iso2.toLowerCase()}.png` : null,
    score: side.score ?? null,
    pen: side.pen ?? null,
  };
}

function getFlagCode(teamCode, team) {
  return FIFA_TO_FLAG_CODE[teamCode] || team.iso2 || null;
}

function getEnglishName(name, fallback) {
  if (!name) return fallback;
  if (typeof name === "string") return name;
  return name.en || fallback;
}

function celsiusToFahrenheit(value) {
  return Math.round(((value * 9) / 5 + 32) * 10) / 10;
}

function getDataBaseUrl(options) {
  return ensureTrailingSlash(options.dataBaseUrl || DEFAULT_DATA_BASE_URL);
}

function getFlagBasePath(options) {
  return ensureTrailingSlash(options.flagBasePath || DEFAULT_FLAG_BASE_PATH);
}

function ensureTrailingSlash(value) {
  return String(value).endsWith("/") ? String(value) : `${value}/`;
}
