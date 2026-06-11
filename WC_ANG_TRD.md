# WC_ANG — Technical Requirements Document (MVP)

**Version:** 1.0
**Date:** 2026-06-10
**Status:** Locked
**Replaces:** `WC_ANG_TRD.docx` (prompt-template; kept for historical reference)

---

## 1. Product Summary

WC_ANG is a private World Cup 2026 fantasy-prediction game for 4–8 managers per group. Managers earn points for match predictions through the group stage, lock in tournament-long futures picks at the draft, run a snake draft of teams and players, and predict every knockout match from R32 through the Final.

The MVP is **commissioner-driven**: a single operator (the commissioner) types all inputs into a Google Sheet, the sheet computes everything, and a static landing page surfaces the leaderboard. There is no automated input pipeline, no submission locks, no odds API, and no draft engine in MVP.

## 2. Game Phases

### 2.1 Group Stage
- Per group-stage match, a manager picks one outcome: **Team A wins**, **Team B wins**, or **Draw**.
- Correct winner pick (Team A or Team B): **+3 pts**.
- Correct Draw pick: **+5 pts**.
- Incorrect pick: 0 pts. No bonus or odds modifier.

### 2.2 Group-Stage Standings & Draft Seeding
- At the end of the group stage, managers are ranked by total group-stage points.
- Standings determine snake-draft order (highest points picks first in odd rounds).
- Tiebreakers: **commissioner discretion** (documented at the start of the tournament).

### 2.3 Snake Draft (manual)
- After group stage, managers conduct a synchronous draft (in-person, voice, or chat) supervised by the commissioner.
- Each manager drafts:
  - **4 national teams**
  - **4 players**
- No coach in MVP.
- Total picks per manager: **8** (4 team rounds + 4 player rounds).
- Snake order: round 1 in seed order, round 2 reversed, etc.
- All ownership is exclusive within the group — no asset can be drafted twice.
- Commissioner enters picks into the spreadsheet as they happen; the `Duplicate_Check` column flags any accidental duplicate Asset_ID.

### 2.4 Locked Futures (submitted with draft)
At draft time, each manager submits one-shot picks. These cannot be changed afterward.

| Pick | Pts if correct |
|---|---|
| Tournament Winner | 100 |
| Finalist (2 separate team picks) | 50 each |
| Golden Boot | 150 |
| Player of the Tournament | 150 |

Max futures total per manager: **500 pts**.

### 2.5 Knockout Predictions (R32 → Final, 31 matches)
For every knockout match, each manager submits four fields:

| Field | Pts if correct |
|---|---|
| Winner | 5 |
| Goal Scorer #1 | 3 |
| Goal Scorer #2 | 3 |
| Match length (`90` / `ET` / `Pens`) | 2 |

Max per knockout match: **13 pts**.

**Rules:**
- Both scorer slots score independently. If a manager enters the same player in both slots, only one slot pays out.
- Goal scorers count if they scored in the match, regardless of when. Own goals do not count.
- "Length" predicts how the match ended: 90 (regulation), ET (extra time), or Pens (penalty shootout).

### 2.6 Drafted-Team Scoring (cumulative)
Each drafted team earns advancement bonuses as it progresses. Bonuses are cumulative — a champion earns all five.

| Stage reached | Pts | Cumulative |
|---|---|---|
| Round of 16 | +10 | 10 |
| Quarterfinal | +20 | 30 |
| Semifinal | +30 | 60 |
| Final | +40 | 100 |
| Champion | +50 | 150 |

Max per drafted team: **150**. With 4 teams, theoretical max = 600, but realistically capped by single-champion reality (~250–350 for a strong draft).

### 2.7 Drafted-Player Scoring (per occurrence)

| Stat | Pts |
|---|---|
| Goal | 5 |
| Assist | 3 |
| Man of the Match | 7 |
| Clean sheet | 3 (GK and CB only) |
| Penalty save | 10 (GK only) |

Position eligibility is enforced by the spreadsheet formula.

## 3. Leaderboard

```
Manager_Total =
    Group_Stage_Points
  + Knockout_Prediction_Points
  + Futures_Points
  + Drafted_Teams_Points
  + Drafted_Players_Points
```

Ranking by `Manager_Total` descending. Tiebreakers: commissioner discretion.

## 4. Operating Model

| Concern | MVP approach |
|---|---|
| Predictions input | Commissioner types manually into the sheet |
| Draft input | Commissioner types live during the draft session |
| Result input | Commissioner types after each match |
| Submission lock enforcement | Honor system — commissioner refuses late submissions |
| Multi-group support | Single group only in MVP |
| Automation | None |

## 5. Architecture

```
   ┌───────────────────────┐
   │  Google Sheet (xlsx)  │   ← Commissioner edits
   │   Scoring engine      │
   └──────────┬────────────┘
              │ Manual CSV export of Landing_CSV tab
              ▼
   ┌───────────────────────┐
   │  CSV file in repo /   │
   │  Published Sheet URL  │
   └──────────┬────────────┘
              │ Static site fetches on page load
              ▼
   ┌───────────────────────┐
   │  Static Landing Page  │   ← Free host (GH Pages / Cloudflare Pages)
   │   Leaderboard view    │
   └───────────────────────┘
```

**Stack & cost:** Google Sheets (free) + static HTML/JS (free) + free static host = **$0/month**.

## 6. Spreadsheet Design

Source of truth: `wc_ang_06_10_mvp_v2.xlsx`.

13 sheets:

| # | Sheet | Role |
|---|---|---|
| 1 | `Scoring_Constants` | All point values; every formula references this |
| 2 | `Managers` | Roster + workflow checklist |
| 3 | `Matches_1` | Group-stage fixtures + results |
| 4 | `Predictions_1` | Group-stage picks per manager |
| 5 | `Leaderboard_1` | Group-stage standings |
| 6 | `DE_Teams` | Draft-eligible teams + advancement flags |
| 7 | `DE_Players` | Draft-eligible players + stat counters |
| 8 | `Draft_Board` | Snake-draft picks with duplicate-detection |
| 9 | `Futures` | Champion / finalists / Golden Boot / POT picks + actual-result sidecar |
| 10 | `Matches_2` | All 31 knockout fixtures + results + scorers + length |
| 11 | `Predictions_2` | Knockout picks per manager |
| 12 | `Leaderboard_2` | Combined standings across all five point sources |
| 13 | `Landing_CSV` | Export tab — public-facing leaderboard schema |

Scoring constants are at `Scoring_Constants!B3..B25`. `Last_Updated` is at `Scoring_Constants!B27` and is manually edited by the commissioner before each CSV export.

## 7. Landing_CSV Schema (public contract)

This is the **public schema** the website consumes. Do not break it without updating the frontend.

| Column | Type | Description |
|---|---|---|
| `rank` | integer | Standings rank (1 = leader) |
| `manager_name` | string | Display name from Managers |
| `total_points` | integer | Manager_Total |
| `group_stage_points` | integer | Group-stage subtotal |
| `knockout_prediction_points` | integer | Knockout-prediction subtotal |
| `futures_points` | integer | Futures subtotal |
| `drafted_teams_points` | integer | Sum of drafted teams' Total_Team_Points |
| `drafted_players_points` | integer | Sum of drafted players' Total_Player_Points |
| `last_updated` | ISO-8601 string | Snapshot timestamp set by commissioner |

## 8. Frontend Requirements (MVP)

- **Single page**: landing + leaderboard combined.
- **Hero**: tournament name, tagline, "last updated" timestamp from the CSV.
- **Leaderboard table**: rank, name, total, with per-source subtotals (sortable column headers nice-to-have but not required).
- **Mobile-responsive** — most viewers will be on phones.
- **Loading & error states**: spinner during CSV fetch; clear message if the CSV is unreachable.
- **No auth, no login, no submissions** — view-only.
- **Refresh cadence**: daily. Page does not need live-polling.

## 9. Out of Scope for MVP

Explicitly deferred:

- Data-validation dropdowns in the sheet
- Automated submission lock enforcement (timestamp gating)
- Multi-group support
- Multiple sportsbooks / odds APIs / underdog probability mechanic
- Automated draft order computation
- Google Forms / web-form prediction submission
- Coach drafting and scoring
- Tiebreaker formulas
- User accounts / authentication
- Live websocket updates
- Mobile app
- Analytics / telemetry

These belong to Phase 2+.

## 10. Roadmap

| Phase | Deliverable | Effort |
|---|---|---|
| **Phase 1 (this doc)** | Spreadsheet MVP + static landing page | ~1 weekend |
| Phase 2 | Google Form for predictions; Apps Script writes into the sheet | ~1 week |
| Phase 3 | Automated draft tooling; lock enforcement; multi-group | ~2 weeks |
| Phase 4 | Public scaling: real auth, real database, hosted backend | 1+ months |

## 11. Risks (Phase 1 only)

| Risk | Mitigation |
|---|---|
| Commissioner mistypes Asset_ID and breaks a manager's score | `Duplicate_Check` column catches duplicates; commissioner double-checks each row visually |
| Late submission accepted accidentally | Commissioner refuses late entries by policy; `Submission_Time` column makes this auditable |
| Sheet formula gets accidentally edited | Lock formula cells in Google Sheets ("Protect range") |
| CSV export forgotten before a refresh | `Last_Updated` is visible on landing page; managers will notice if it goes stale |
| Goal_Scorers free-text collision (e.g. name substrings) | Use `Player_ID` codes in the comma-separated list rather than names |

## 12. Deliverables (numbered, no gaps)

1. Game Design Document (§2–3 above)
2. Technical Architecture (§5)
3. Spreadsheet Design (§6 — implemented in `wc_ang_06_10_mvp_v2.xlsx`)
4. Frontend Requirements (§8)
5. Development Roadmap (§10)
6. Risk Analysis (§11)
7. Commissioner Playbook (separate doc, to be written)

---

**Change log**
- 2026-06-10 — v1.0 — Initial locked version. Removed DraftKings/underdog mechanic. Removed coach layer. Settled scoring at 3/5 group, 5/3/3/2 knockout, 100/50/150/150 futures.
