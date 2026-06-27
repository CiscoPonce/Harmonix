# Harmonix Roadmap

## Phase 10 — Mobile: Android Wrapper → Native App → Dual Frontend

**Status:** Planned  
**Milestone:** v1.3 — Mobile  
**Strategy:** Option B (Capacitor APK) → test → Option C (Flutter) → test → **two frontends, one API**

**Context:** [phases/10-mobile-dual-frontend/10-CONTEXT.md](./phases/10-mobile-dual-frontend/10-CONTEXT.md)  
**UI spec (team mockup):** [phases/10-mobile-dual-frontend/10-UI-SPEC.md](./phases/10-mobile-dual-frontend/10-UI-SPEC.md)  
**Mockup asset:** [phases/10-mobile-dual-frontend/design/android-mockup-v1.png](./phases/10-mobile-dual-frontend/design/android-mockup-v1.png)

| Plan | Name | Status |
|------|------|--------|
| 10-00A | Prerequisites — no domain (ngrok OK) | Pending |
| 10-00B | Prerequisites — domain + Play Store | Pending |
| 10-01 | Option B — Capacitor Android APK | Pending |
| 10-02 | Option B — test & internal Play track | Pending |
| 10-03 | Option C — Flutter MVP (**design mockup**) | Pending |
| 10-04 | Option C — test & dual-frontend parity | Pending |
| 10-05 | Documentation & dual-frontend runbook | Pending |

**End state:** Next.js (web) + Flutter (Android) sharing Express/SQLite backend. Capacitor APK is a temporary bridge during 10-01/10-02.

**4 tabs (Flutter):** Discover · Library · Learn (Daily Word) · Settings (Stats & Achievements)

---

## Phase 9.5 — Background Word Queue Service

**Status:** Complete  
**Goal:** Instant word delivery after the first slow generation by pre-validating and buffering words per user.

### Plan 9.5-01: Validated Word Queue (Backend)

- **Queue table:** `user_word_queue` stores fully validated payloads (Deezer + LRCLib + sync), not raw AI JSON
- **Batch efficiency:** Validate all 5 AI candidates from one call; enqueue every valid result
- **Smart refill:** When ready count drops below 3, trigger async background refill (max 5 queued)
- **Expiry:** Unconsumed queue items expire after 7 days
- **Endpoints:**
  - `POST /api/daily-word/next` — pop next validated word (<100ms when queue stocked)
  - `GET /api/daily-word/queue-status` — `{ ready, refilling, target }`
- **Dedupe:** Refill avoids words in recent history and current queue
- **Genre boost:** Prefer candidates matching user `genre` preference when multiple validate

### Plan 9.5-02: Queue Status UI

- Queue badge on Daily Word card (`N words ready`)
- "Next word" uses `/next` for instant delivery when buffered
- Full loading overlay only when queue is empty and generation is required
- Background refill indicator when stocking queue

### Success criteria

| Scenario | Target |
|----------|--------|
| First word (cold) | ~60s (unchanged) |
| Second+ word (queue stocked) | <100ms |
| Validation-first | 100% queued words pass Deezer/LRCLib checks |

---

## Completed phases

- **Phase 9.5:** Background word queue (instant daily words)
- **Phase 9:** Badges, playlists, onboarding, SRS review
- **Phase 8:** Harmonix rebrand & landing page
- **Phases 1–7:** Core MVP (auth, player, AI vocab, quizzes, daily word)
