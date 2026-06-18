# Prediction Submissions MVP

The public site remains read-only for standings, match data, and prediction pulse CSVs.
Prediction writes must go through a private backend API so Google Sheet edit access, PINs,
and commissioner-only fields are never exposed in browser code.

## Data Split

Public display data:
- `leaderboardCsvUrl`
- `predictionPulseCsvUrl`
- World Cup match JSON under `assets/wc2026/data/`

Private submission data:
- manager identity records
- commissioner-held manager PINs or PIN hashes
- raw prediction submissions
- optional audit history for changed picks

## Frontend Config

Each group config can opt into submissions with the deployed Apps Script web app URL:

```js
predictionSubmitUrl: "https://script.google.com/macros/s/.../exec"
```

Leave it blank until the backend is deployed. The page will still render the prediction
controls, but submissions will be blocked.

## Login

`POST predictionSubmitUrl`

Request:

```json
{
  "action": "login",
  "manager_id": "manager-name-or-id",
  "pin": "1234",
  "group_slug": "tikur-abay"
}
```

Success response:

```json
{
  "ok": true,
  "token": "signed-session-token",
  "manager_id": "manager-name-or-id",
  "display_name": "Manager Name",
  "group_slug": "tikur-abay",
  "expires_at": "2026-06-18T18:00:00.000Z"
}
```

The browser stores the signed session token in `sessionStorage`. The PIN is not stored.

## Submit Prediction

`POST predictionSubmitUrl`

Request:

```json
{
  "action": "submit_prediction",
  "token": "signed-session-token",
  "manager_id": "manager-name-or-id",
  "group_slug": "tikur-abay",
  "match_id": "400021502",
  "pick": "POR",
  "home_code": "POR",
  "away_code": "COD",
  "kickoff_at": "2026-06-17T17:00:00Z"
}
```

The `pick` value must be one of:
- home team code from the match data
- `Tie`
- away team code from the match data

Success response:

```json
{
  "ok": true,
  "message": "Prediction saved"
}
```

Error response:

```json
{
  "ok": false,
  "message": "Deadline passed"
}
```

## Required Server-Side Validation

The backend must validate every write:
- manager exists and is active
- PIN is valid for that manager
- `match_id` exists in trusted match data
- `pick` matches the home team code, away team code, or `Tie`
- current server time is before kickoff minus one hour
- only one active pick exists per `manager_id + match_id`

The frontend countdown is only a convenience. The backend deadline check is the rule.

## Suggested Private Tables

`managers`
- `manager_id`
- `display_name`
- `group_slug`
- `pin`
- `pin_sha256`
- `is_active`
- `role`

`prediction_matches`
- `match_id`
- `group_slug`
- `home_code`
- `home_team`
- `away_code`
- `away_team`
- `kickoff_at`
- `status`

`prediction_submissions`
- `submitted_at`
- `updated_at`
- `group_slug`
- `manager_id`
- `match_id`
- `home_code`
- `away_code`
- `pick`
- `deadline_at`
- `status`

`prediction_audit` optional:
- `changed_at`
- `group_slug`
- `manager_id`
- `match_id`
- `old_pick`
- `new_pick`

## Apps Script Backend

The first backend implementation lives at:

```text
backend/google-apps-script/predictions.gs
```

Setup:

1. In the Google Sheet, create the private tabs listed above.
2. Open Extensions > Apps Script.
3. Paste `predictions.gs` into the Apps Script project.
4. Set Script Property `TOKEN_SECRET` to a long random value.
5. Deploy as a Web App.
6. Set access to anyone with the link.
7. Copy the `/exec` URL into each group `config.js` as `predictionSubmitUrl`.

The web app is public by URL, but writes are still protected by manager PIN validation,
signed short-lived tokens, match validation, and server-side deadline checks.

## Prediction Pulse Reveal

The public page hides prediction pulse on upcoming cards until the prediction deadline:
kickoff minus one hour. After that point, the pulse and manager lists can display.
