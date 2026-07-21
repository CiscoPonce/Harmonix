# Harmonix Roadmap

## Phase 10 — Mobile: Android Wrapper → Native App → Dual Frontend

**Status:** In progress (Option C MVP)  
**Milestone:** v1.3 — Mobile  
**Strategy:** Option B (Capacitor APK) → test → Option C (Flutter) → test → **two frontends, one API**

**Context:** [phases/10-mobile-dual-frontend/10-CONTEXT.md](./phases/10-mobile-dual-frontend/10-CONTEXT.md)  
**UI spec (Flutter SoT — light/green):** [phases/10-mobile-dual-frontend/10-UI-SPEC.md](./phases/10-mobile-dual-frontend/10-UI-SPEC.md)  
**Language reliability:** [docs/LANGUAGE-RELIABILITY.md](../docs/LANGUAGE-RELIABILITY.md)

| Plan | Name | Status |
|------|------|--------|
| 10-00A | Prerequisites — no domain (ngrok OK) | Done |
| 10-00B | Prerequisites — domain + Play Store | Pending |
| 10-01 | Option B — Capacitor Android APK | Done |
| 10-02 | Option B — test & internal Play track | Pending |
| 10-03 | Option C — Flutter MVP (`mobile/`, light/green Learn) | Done (MVP) |
| 10-04 | Option C — test & dual-frontend parity | Pending |
| 10-05 | Documentation & dual-frontend runbook | Pending |

**End state:** Next.js (web) + Flutter (Android) sharing Express/SQLite backend. Capacitor APK is a temporary bridge; deprecate after Flutter public launch (D-10-04).

**4 tabs (Flutter):** Discover · Library · Learn (Daily Word, default) · Settings (Stats & Achievements)

---

## Phase 11 — Word Phonics TTS Integration

**Status:** Planned  
**Milestone:** v1.4 — Phonics Integration  
**Strategy:** Run Pocket-TTS HTTP server to dynamically generate and cache phonetic pronunciation audio for target words.

Context: [phases/11-word-phonics-tts/11-CONTEXT.md](./phases/11-word-phonics-tts/11-CONTEXT.md)

| Plan | Name | Status |
|------|------|--------|
| 11-01 | Backend TTS Service + API Endpoint | Pending |
| 11-02 | Frontend Pronunciation Button | Pending |

**End state:** Pocket-TTS running as a backend utility serving phonetic audio to Next.js and Flutter clients with SQLite caching.

---

## Phase 12: Spotify API Integration

**Goal:** As a signed-in Harmonix learner, I want to connect my Spotify account from Settings and view and export playlists on web and Android, so that I can use my Spotify music inside Harmonix across both platforms.
**Mode:** mvp
**Status:** In Progress  
**Milestone:** v1.5 — Spotify Integration  
**Strategy:** Implement OAuth 2.0 PKCE flow, playlist management, and export functionality.
**Plans:** 10/11 plans executed

- [x] 12-01-PLAN.md
- [x] 12-02-PLAN.md
- [x] 12-03-PLAN.md
- [x] 12-04-PLAN.md
- [x] 12-05-PLAN.md
- [x] 12-06-PLAN.md
- [x] 12-07-PLAN.md
- [x] 12-08-PLAN.md
- [x] 12-09-PLAN.md
- [x] 12-10-PLAN.md
- [ ] 12-11-PLAN.md

Context: [phases/12-spotify-api-integration/12-CONTEXT.md](./phases/12-spotify-api-integration/12-CONTEXT.md)

| Plan | Name | Status |
|------|------|--------|
| 12-01 | Blocking Spotify account, callback, secret, cache-policy, and quota facts | Complete |
| 12-02 | Wave 0 backend ABI, adversarial contracts, OAuth state, and token crypto | Complete |
| 12-03 | Wave 0 matching corpus, Flutter contracts, and dependency-free web tests | Complete |
| 12-04 | Backend OAuth/status/list foundation and API user journey | Complete |
| 12-05 | Web Settings OAuth → provider-separated Library consumer | Complete |
| 12-06 | Android Settings OAuth → verified App Link → Library parity | Complete |
| 12-07 | Web and Android in-app playlist detail with restricted-list handling | Complete |
| 12-08 | Validation-first matching and web export match report | Complete |
| 12-09 | Android export parity and cross-platform resilience/cleanup | Complete |
| 12-10 | Automated release matrix and Spotify operations runbook | Complete |
| 12-11 | Sandbox/device, UI/accessibility, policy/branding, and quota gates | Pending |

**End state:** Users can connect Spotify accounts, view their Spotify playlists in Harmonix, and export Harmonix playlists to Spotify with intelligent song matching.

**Key Features:**

- OAuth 2.0 with PKCE for secure authentication
- Encrypted token storage with auto-refresh
- View user's Spotify playlists in Library
- Export Harmonix playlists to Spotify (>90% match accuracy target)
- Rate limiting and caching for API efficiency
- Match report showing successful and unmatched tracks

---

## Phase 12.5 — Spotify Connect UX (one-click OAuth)

**Goal:** As a Harmonix learner, I want to connect Spotify in one click from Library (popup OAuth when possible), so that linking feels as easy as other modern apps — without Developer Dashboard steps or a Settings-only detour.

**Mode:** mvp  
**Status:** Planned  
**Milestone:** v1.5 — Spotify Integration (UX polish)  
**Depends on:** Phase 12 backend OAuth (complete); operator Client ID on VPS (set); Dashboard redirect URI must match live env

Context: [phases/12.5-spotify-connect-ux/12.5-CONTEXT.md](./phases/12.5-spotify-connect-ux/12.5-CONTEXT.md)

| Plan | Name | Status |
|------|------|--------|
| 12.5-01 | Web popup OAuth + callback `postMessage` (redirect fallback) | Pending |
| 12.5-02 | Library inline **Connect Spotify** (shared auth hook) | Pending |
| 12.5-03 | Optional onboarding connect prompt (web) | Pending |
| 12.5-04 | Operator runbook + popup/Library tests | Pending |

**End state:** Learners connect from Library or Settings via OAuth 2.0 popup (or redirect fallback); operators follow a documented one-time Dashboard + VPS checklist invisible to users.

**Key UX changes:**

- Popup window for Spotify login/consent; Harmonix tab stays open
- **Connect Spotify** on Library empty/disconnected states — not only “Open Settings”
- Settings card unchanged for disconnect / reconnect / status
- No tokens or OAuth secrets exposed to the browser beyond validated auth start URL

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
