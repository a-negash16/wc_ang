import { getSiteConfig, validateSiteConfig } from "./config.js";
import { requireElement, setHidden, setStatus } from "./dom.js";
import { renderLeagueLayout } from "./layout.js";
import { loadLeaderboard } from "./leaderboard.js";
import { renderWcResultsStrip } from "../wc2026/wc-results-strip.js";

const WC_RESULTS_REFRESH_MS = 60 * 60 * 1000;

bootstrap();

function bootstrap() {
  const config = getSiteConfig();

  try {
    renderLeagueLayout(config);
    const elements = getRequiredElements();
    const missingConfig = validateSiteConfig(config);

    if (missingConfig.length > 0) {
      showConfigurationError(missingConfig, elements);
      return;
    }

    loadLeaderboard(config, elements);
    loadWcResultsStrip();
  } catch (error) {
    showFatalError(error);
  }
}

function getRequiredElements() {
  return {
    heroStatus: requireElement("hero-status"),
    footerUpdated: requireElement("footer-updated"),
    boardStatus: requireElement("board-status"),
    tableWrap: requireElement("table-wrap"),
    boardBody: requireElement("board-body"),
  };
}

function loadWcResultsStrip() {
  try {
    const mountEl = requireElement("wc-strip");
    renderWcResultsStrip(mountEl).catch((error) => {
      console.error("Could not render World Cup results strip:", error);
    });

    window.setInterval(() => {
      renderWcResultsStrip(mountEl, { forceRefresh: true }).catch((error) => {
        console.error("Could not refresh World Cup results strip:", error);
      });
    }, WC_RESULTS_REFRESH_MS);
  } catch (error) {
    console.error("Could not start World Cup results strip:", error);
  }
}

function showConfigurationError(missingConfig, elements) {
  const message = `Missing required config value(s): ${missingConfig.join(", ")}`;
  setStatus(elements.boardStatus, message, true);
  setHidden(elements.tableWrap, true);
  elements.heroStatus.textContent = "Standings unavailable";
}

function showFatalError(error) {
  const root = document.getElementById("app") || document.body;
  root.innerHTML = `
    <main class="section section-light">
      <div class="container">
        <div class="board-status error" role="alert"></div>
      </div>
    </main>
  `;
  root.querySelector(".board-status").textContent = `Could not start page: ${error.message}`;
}
