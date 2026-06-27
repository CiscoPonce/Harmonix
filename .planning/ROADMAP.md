# Harmonix Roadmap

## Phase 9.5 — Background Word Queue Service

**Status:** in progress  
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
- "New word" uses `/next` for instant delivery when buffered
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

- **Phase 9:** Badges, playlists, onboarding, SRS review
- **Phase 8:** Harmonix rebrand & landing page
- **Phases 1–7:** Core MVP (auth, player, AI vocab, quizzes, daily word)
