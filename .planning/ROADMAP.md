# Harmonix Roadmap

**Last reconciled:** 2026-07-22 — full codebase + VPS runtime audit  
**Live:** https://moral-sparrow-nationally.ngrok-free.app (`main` @ VPS)

---

## How the product runs (architecture)

```text
  Browser / Capacitor WebView          Flutter Android (`mobile/`)
  Next.js :3009 (prod via run_env)     Discover · Library · Learn · Settings
              \                         /
               \                       /
                ▼                     ▼
           Express API :3001  +  SQLite (harmonix.db)
                │
    ┌───────────┼───────────────┬────────────────┐
    ▼           ▼               ▼                ▼
 NVIDIA/OpenRouter   Deezer+LRCLib   Pocket-TTS:3002   Spotify Web API
 (daily-word AI)     (validate)      (pronounce)       (OAuth, lists, play)
                │
           ngrok → public HTTPS
```

**Deploy:** `git pull` on VPS → `bash run_env.sh` (backend + `next build/start` + TTS + ngrok).  
**Auth:** JWT access + httpOnly refresh cookie.  
**Learning core:** AI song candidates → Deezer match → LRCLib synced lyrics → queue (`user_word_queue`) → Daily Word / Learn.

---

## Completed phases

| Phase | Milestone | Status |
|------:|-----------|--------|
| 1–7 | Core MVP | Complete |
| 8 | Harmonix rebrand & landing | Complete |
| 9 | Badges, playlists, onboarding, SRS | Complete |
| 9.5 | Background word queue | Complete |
| 11 | Word Phonics TTS (Pocket-TTS) | Complete |
| **12** | Spotify API (OAuth, Library, export) | **Complete** (product MVP) |
| **12.6** | Spotify in-app playback **(web)** | **Complete** (web MVP) |
| **13** | Web design system (shell + Discover) | **Complete** (MVP) |

### Phase 12 — Spotify API Integration ✅

Shipped and live: PKCE OAuth, encrypted tokens, Settings Connect, provider-separated Library, playlist detail, Harmonix→Spotify export + match report, web + Android linking, `/callback` alias, ops runbook.

Residual ops (not blocking “done”): Extended Quota Mode for public users; formal accessibility/policy checklist — tracked in **Phase 14**.

### Phase 12.6 — Spotify In-App Playback (web) ✅

Shipped on web: Web Playback SDK, `GET /api/spotify/player/token`, `POST /api/spotify/resolve-play`, Daily Word Hear-it + full player Spotify-first / Deezer fallback, ~12s line-anchored clips, per-user API admission queue.

Android in-app Spotify streaming remains **Phase 14**.

### Phase 13 — Web Design System ✅

Shipped: AppShell (Discover · Library · Learn · Settings), DM Sans + Fraunces, forest tokens, `/discover` home, shell on Learn/Library/Settings.

Pixel polish (WOTD/player bar/search wiring) → **Phase 14**.

### Phase 11 — TTS ✅

Pocket-TTS HQ on `:3002`, `/api/daily-word/pronounce`, SQLite cache, web + Flutter speakers. Live on VPS.

### Phase 9.5 — Word queue ✅

Validated queue + `/next` + refill; cold generate still ~20–60s when empty (AI timeouts fall back to curated catalogs).

---

## Phase 10 — Mobile dual frontend (MVP shipped; release open)

**Status:** MVP complete — release / Play Store / docs open → rolled into Phase 14  
**Milestone:** v1.3

| Plan | Name | Status |
|------|------|--------|
| 10-00A | Prerequisites — ngrok OK | Done |
| 10-00B | Domain + Play Store | → Phase 14 |
| 10-01 | Capacitor Android APK | Done (bridge) |
| 10-02 | Option B Play internal track | → Phase 14 |
| 10-03 | Flutter MVP (`mobile/`) | Done |
| 10-04 | Dual-frontend parity / test gate | → Phase 14 |
| 10-05 | Dual-frontend runbook | → Phase 14 |

**Shipped on Flutter today:** 4-tab shell, Daily Word + Deezer preview + TTS, Spotify OAuth/Library/export, language edit via Onboarding, dark mode, stats/badges.  
**Not on Flutter:** in-app Spotify playback (external Open in Spotify only).

---

## Phase 12.5 — Spotify Connect UX

**Status:** Planned — folded into Phase 14  
Popup OAuth, Library inline Connect, onboarding prompt — not yet in code (Connect still Settings-first / Discover link to Settings).

---

## Phase 14 — Production Parity & Ship *(consolidated remaining work)*

**Status:** Planned  
**Milestone:** v1.7 — Ship  
**Goal:** One phase for everything still open: web polish, mobile parity, Connect UX, release ops.

| Plan | Name | Source | Priority |
|------|------|--------|----------|
| 14-01 | Web polish — WOTD/player bar/header search; shell on player/review/detail | 13-04 + shell gaps | P0 |
| 14-02 | Spotify Connect UX — popup OAuth + Library inline Connect | 12.5 | P0 |
| 14-03 | Flutter language editors in Settings (parity with web) | settings gap | P1 |
| 14-04 | Flutter Spotify playback (if feasible) or honest Premium/Open-in-Spotify UX | 12.6-04 | P1 |
| 14-05 | Dual-frontend QA gate + Capacitor deprecate decision | 10-04 / D-10-04 | P1 |
| 14-06 | Play Store / domain / release runbook | 10-00B, 10-02, 10-05 | P2 |
| 14-07 | Ops — Extended Quota, AI provider health (NIM 404 / OpenRouter 429), formal 12-11 smoke | 12-11 + runtime | P2 |

**Out of scope for 14:** Wear OS productization, iOS, full-song hosting, import Spotify→vocab pipeline.

**Context stubs:** reuse  
[12.5-CONTEXT](./phases/12.5-spotify-connect-ux/12.5-CONTEXT.md),  
[12.6-CONTEXT](./phases/12.6-spotify-in-app-playback/12.6-CONTEXT.md),  
[13-CONTEXT](./phases/13-web-design-system/13-CONTEXT.md),  
[10-CONTEXT](./phases/10-mobile-dual-frontend/10-CONTEXT.md).

---

## Runtime health notes (2026-07-22)

Observed on VPS while live:

- Stack healthy: API `:3001`, Next `:3009`, TTS `:3002`, ngrok public **200**
- Spotify resolve-play and status in active use
- Word queue refill reaches `ready=5/5` after curated fallback
- NVIDIA primary model often **404**; OpenRouter free models hit **429** → curated Deezer path still delivers words (slow cold path)

---

## Suggested next command

`/gsd-discuss-phase 14` — lock UX choices for Connect popup vs redirect, Flutter playback feasibility, and Play Store timing.
