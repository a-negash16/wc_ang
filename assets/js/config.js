const DEFAULT_RESULTS_LIMIT = 9;

export function getSiteConfig(rawConfig = window.WC_ANG_CONFIG || {}) {
  const config = {
    groupName: rawConfig.groupName || rawConfig.GROUP_NAME || "",
    theme: rawConfig.theme || rawConfig.THEME || "",
    tournamentName: rawConfig.tournamentName || rawConfig.TOURNAMENT_NAME || "",
    leaderboardCsvUrl: rawConfig.leaderboardCsvUrl || rawConfig.LEADERBOARD_CSV_URL || "",
    resultsCsvUrl: rawConfig.resultsCsvUrl || rawConfig.RESULTS_CSV_URL || "",
    resultsLimit: Number(rawConfig.resultsLimit || rawConfig.RESULTS_LIMIT || DEFAULT_RESULTS_LIMIT),
  };

  if (!config.theme && config.groupName) {
    config.theme = slugify(config.groupName);
  }

  if (!Number.isInteger(config.resultsLimit) || config.resultsLimit < 1) {
    config.resultsLimit = DEFAULT_RESULTS_LIMIT;
  }

  return config;
}

export function validateSiteConfig(config) {
  const missing = [];
  if (!config.groupName) missing.push("groupName");
  if (!config.tournamentName) missing.push("tournamentName");
  if (!config.leaderboardCsvUrl) missing.push("leaderboardCsvUrl");
  return missing;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
