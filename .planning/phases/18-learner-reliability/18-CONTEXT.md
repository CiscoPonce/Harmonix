# Phase 18 — Learner reliability

**Status:** Complete 2026-09-23  
**Milestone:** v2.1  
**Surfaces:** API (`server/`), web (`client/`), Flutter (`mobile/`)

## Goal

Stop the next tester round from hitting wrong glosses, wasted Next taps, and dead-end errors. Keep the rule that Next never repeats a song.

## Decisions locked

| ID | Decision |
|----|----------|
| D-18-01 | Song reuse stays off. Exhausted catalogs get a path forward (change style, search a song), not a repeated track. |
| D-18-02 | Native-language changes purge the word queue the same way target language and genre already do. |
| D-18-03 | A skipped queue item is discarded, never consumed. Consumed means the learner saw the card. |
| D-18-04 | Search-from-track avoids words already delivered and words already sitting in the queue. |
| D-18-05 | Password changes use the same minimum as registration (`PASSWORD_MIN` = 8). Existing shorter passwords stay valid until the user changes them. |
| D-18-06 | Next and from-track get a per-user rate limit. Do not turn song reuse back on to “save” AI calls. |
| D-18-07 | Dyslexia spacing is a persisted preference on web and Flutter, same family as voice gender. |
| D-18-08 | Spotify taste sync runs after Connect succeeds. Admin sync stays. |
| D-18-09 | Empty genre×language cells are hidden in Settings, or filled from the verified catalog. Do not relabel the wrong genre. |
| D-18-10 | `http-proxy-middleware` moves to a version that clears the 4.1.0 advisory. Confirm with `npm audit` before the bump. |

## Non-goals

- Play Console listing (Phase 17 stays operator-side)
- iOS / TestFlight
- Splitting `dailyWordService.js`
- Refresh-token revocation / session table
- Containerizing Pocket-TTS
- Paid OpenRouter models
- Bringing back same-song fallback

## Plans

| Plan | Name |
|------|------|
| [18-01](./18-01-PLAN.md) | Queue, search, and streak correctness |
| [18-02](./18-02-PLAN.md) | Rate limits, password length, proxy bump |
| [18-03](./18-03-PLAN.md) | Library cover fetches |
| [18-04](./18-04-PLAN.md) | Exhausted catalog and thin styles |
| [18-05](./18-05-PLAN.md) | Spotify taste sync and dyslexia font |
