# WC ANG

A private World Cup 2026 prediction & fantasy league. Single commissioner runs the scoring spreadsheet; this repo hosts the public leaderboard page.

## What's in this repo

| Path | Purpose |
|---|---|
| [WC_ANG_TRD.md](WC_ANG_TRD.md) | Locked Technical Requirements Document (v1.0) |
| `WC_ANG_TRD.docx` | Original prompt-template (historical reference) |
| `wc_ang_06_10_mvp_v2.xlsx` | Scoring engine — the live spreadsheet (upload to Google Sheets) |
| `wc_ang_06_10_fixed.xlsx` | Earlier draft, kept for comparison |
| `index.html` | Landing page |
| `style.css` | Page styles |
| `app.js` | Fetches CSV, renders leaderboard |
| `config.js` | Holds the published CSV URL — edit this |

## One-time setup

### 1. Put the spreadsheet on Google Sheets
1. Upload `wc_ang_06_10_mvp_v2.xlsx` to Google Drive.
2. Right-click → **Open with** → **Google Sheets**. Save as a Google Sheets file.
3. Verify formulas recalculate (look at `Leaderboard_2` — values should appear once you add sample data).

### 2. Publish Landing_CSV to the web
1. In the sheet, open **File → Share → Publish to web**.
2. In the dialog:
   - **Link** tab.
   - Sheet dropdown: select **`Landing_CSV`**.
   - Format dropdown: **Comma-separated values (.csv)**.
3. Click **Publish**, confirm.
4. Copy the URL. It will look like:
   `https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?gid=…&single=true&output=csv`

### 3. Wire the URL into the site
Open `config.js` and paste the URL into `CSV_URL`:

```js
window.WC_ANG_CONFIG = {
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=...&single=true&output=csv",
  TOURNAMENT_NAME: "World Cup 2026 Prediction League"
};
```

Commit and push.

### 4. Enable GitHub Pages
1. Push this repo to `github.com/a-negash16/wc_ang`.
2. In the repo: **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Branch: `main`, folder: `/ (root)`. Save.
5. Wait ~30 seconds. Page goes live at:
   **https://a-negash16.github.io/wc_ang/**

## Commissioner workflow (per match day)

1. Open the Google Sheet.
2. Enter match results in `Matches_1` or `Matches_2`.
3. Update stat counters in `DE_Teams` / `DE_Players` for any drafted assets.
4. Update `Scoring_Constants!B27` (`Last_Updated`) to the current ISO timestamp.
5. Done — the published CSV refreshes automatically; the website picks up the new data on the next page load.

You never need to touch this repo again unless you want to restyle the page or adjust scoring constants in the spreadsheet.

## Local preview

```sh
# any static server works; here's the simplest
python3 -m http.server 8000
# open http://localhost:8000
```

## Restyling

`style.css` defines a small palette of CSS variables at the top. Tweak `--accent`, `--accent-soft`, fonts, and the rest cascades.

## Out of scope (per TRD §9)

No auth, no submissions, no live websocket updates, no multi-group support, no automated form input. See [WC_ANG_TRD.md](WC_ANG_TRD.md) §9 for the full list.
