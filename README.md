# WC ANG

Private World Cup 2026 prediction league. This repo hosts the public leaderboard page.

**Live site:** https://a-negash16.github.io/wc_ang/

## Stack
- Plain HTML + CSS + vanilla JS modules - no build step
- Reads leaderboard data from a published Google Sheets CSV
- Hosted on GitHub Pages
- Prediction submissions are designed to go through a private API, not public CSVs

## Project structure
```text
.
├── assets/js/            # Shared browser modules
├── docs/                 # Public implementation notes
├── dagi-united/          # League page shell + config
├── squad/                # League page shell + config
├── tikur-abay/           # League page shell + config
├── app.js                # Compatibility loader for older script references
├── index.html            # Private root placeholder
└── style.css             # Shared styles and league themes
```

The league pages are intentionally small. Each page loads its local
`config.js`, then loads the shared app from `assets/js/app.js`. The shared app
renders the page, validates required config, fetches Google Sheets CSV data, and
renders standings/results.

Prediction submissions use an optional `predictionSubmitUrl` config value. Leave
it blank until a private backend API is deployed. See
`docs/prediction-submissions.md` for the API contract and security boundary.

## Add a league page
1. Copy an existing league folder.
2. Rename the folder to the new URL slug.
3. Update `config.js`:
   - `groupName`
   - `theme`
   - `leaderboardCsvUrl`
   - `resultsCsvUrl`, if recent results are enabled
4. Add a matching `body.theme-{theme}` block in `style.css` if the theme is new.
5. Preview locally before publishing.

Required leaderboard columns:

```text
rank
manager_name
total_points
group_stage_points
knockout_prediction_points
futures_points
drafted_teams_points
drafted_players_points
last_updated
```

Required recent results columns:

```text
date
stage
team_a
team_b
winner
length
correct_count
total_points_awarded
```

## Local preview
```sh
python3 -m http.server 8000
# open http://localhost:8000
```
