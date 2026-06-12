# What Changed

This project was cleaned up so it is easier to maintain, easier to understand,
and safer to expand with more league pages.

## Short version

Before, each league page had almost the same large block of HTML copied into
it. If we wanted to change the page layout, we had to update every league page
by hand.

Now, each league page is small. It only loads:

1. Its own `config.js`
2. The shared app code from `assets/js/app.js`

The shared app builds the page for every league using the values in that
league's config file.

## New folder structure

```text
assets/js/
  app.js            Starts the app
  config.js         Reads and validates page settings
  layout.js         Builds the shared page HTML
  leaderboard.js    Loads and renders standings
  results.js        Loads and renders recent results
  csv.js            Parses Google Sheets CSV data
  dom.js            Small DOM helper functions
  columns.js        Shared CSV column names
```

The old top-level `app.js` still exists, but it is now only a compatibility
loader. New pages should load `assets/js/app.js` directly.

## What each league page does now

Each league page, such as `dagi-united/index.html`, is now just a simple shell.
It has the basic page setup, then this:

```html
<div id="app"></div>

<script src="./config.js"></script>
<script type="module" src="../assets/js/app.js"></script>
```

That means the shared JavaScript controls the actual page layout.

## What each config file does

Each league has a `config.js` file. This is the main file to edit when adding
or changing a league.

Example:

```js
window.WC_ANG_CONFIG = {
  groupName: "Dagi United",
  theme: "dagi-united",
  tournamentName: "World Cup 2026 Prediction League",
  leaderboardCsvUrl: "https://...",
  resultsCsvUrl: "",
  resultsLimit: 9,
};
```

The config tells the app:

- what the league is called
- which color theme to use
- which Google Sheets CSV to load
- whether recent results are enabled

## Why this is better

- Less copied code
- Clearer file responsibilities
- Easier to add a new league page
- Easier to debug when something breaks
- Safer rendering because most dynamic text uses DOM text nodes
- Config is validated before data loading starts

## How to add a new league

1. Copy one existing league folder.
2. Rename the folder to the new URL slug.
3. Update the new folder's `config.js`.
4. Add a new theme in `style.css` if needed.
5. Preview locally with:

```sh
python3 -m http.server 8000
```

Then open the new page in the browser.

## What was not changed

- The site is still a static GitHub Pages site.
- There is still no build step.
- The existing league URLs still work.
- The root `index.html` is still the private placeholder page.
