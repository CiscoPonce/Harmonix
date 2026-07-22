# Harmonix Roadmap

**Last reconciled:** 2026-07-22 — phases 1–14 complete + post-ship polish synced  
**Live:** https://moral-sparrow-nationally.ngrok-free.app (`main` @ VPS)

---

## How the product runs (architecture)

```text
  Browser / Capacitor WebView          Flutter Android (`mobile/`)
  Next.js :3009 (prod via run_env)     Discover · Library · Settings
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
**Learning core:** AI song candidates → Deezer match → LRCLib synced lyrics → queue (`user_word_queue`) → Daily Word on unified **Discover** home.  
**Preferences:** Settings edits home/learning languages, music style (genre), and TTS voice gender; genre change purges the word queue.

---

## Completed phases

| Phase | Milestone | Status |
|------:|-----------|--------|
| 1–7 | Core MVP | Complete |
| 8 | Harmonix rebrand & landing | Complete |
| 9 | Badges, playlists, onboarding, SRS | Complete |
| 9.5 | Background word queue | Complete |
| 10 | Mobile dual frontend (Flutter primary) | Complete (MVP) |
| 11 | Word Phonics TTS (Pocket-TTS) | Complete |
| **12** | Spotify API (OAuth, Library, export) | **Complete** |
| **12.5** | Spotify Connect UX (popup + Library) | **Complete** (via Phase 14-02) |
| **12.6** | Spotify in-app playback **(web)** | **Complete** |
| **13** | Web design system (shell + Discover) | **Complete** |
| **14** | Production Parity & Ship | **Complete** |

### Phase 12 — Spotify API Integration ✅

Shipped and live: PKCE OAuth, encrypted tokens, Settings Connect card, provider-separated Library, playlist detail, Harmonix→Spotify export + match report, web + Android linking, `/callback` alias, ops runbook.

Residual ops (not blocking “done”): Extended Quota Mode for public users — tracked as optional post-v1.7 ops.

### Phase 12.5 — Spotify Connect UX ✅

Shipped via Phase 14-02: popup OAuth on web, Library refresh after connect, Settings Connect / Connected / Reconnect / Disconnect. Library header shows account chip (`Spotify · {display_name}`) when linked; Connect / Reconnect CTAs stay in the header (not duplicated in page body).

### Phase 12.6 — Spotify In-App Playback (web) ✅

Shipped on web: Web Playback SDK, `GET /api/spotify/player/token`, `POST /api/spotify/resolve-play`, Daily Word Hear-it + full player Spotify-first / Deezer 30s fallback, **Open in Spotify** when SDK unavailable, ~12s line-anchored clips, per-user API admission queue.

Android in-app Spotify streaming remains out of scope (honest fallback: Deezer preview + Open in Spotify).

### Phase 13 — Web Design System ✅

Shipped: AppShell (Discover · Library · Settings), DM Sans + Fraunces, forest tokens, unified `/discover` home (Word of the Day + practice strip + search; Learn folded in; `/dashboard` redirects), theme-aware brand logos, full-height sidebar + Pro Plan card.

### Phase 11 — TTS ✅

Pocket-TTS HQ on `:3002`, `/api/daily-word/pronounce`, SQLite cache, web + Flutter speakers, Settings **voice gender** preference.

### Phase 9.5 — Word queue ✅

Validated queue + `/next` + refill; cold generate still ~20–60s when empty (AI timeouts fall back to curated catalogs). Music style changes purge the queue so the next refill matches the new genre.

### Phase 10 — Mobile dual frontend ✅

MVP complete. Flutter is primary Android; Capacitor retained as legacy fallback (D-14-05). Play Store listing / production domain remain optional ops.

**Shipped on Flutter:** 3-tab shell (Discover · Library · Settings), Daily Word + Deezer preview + TTS, Spotify OAuth/Library/export, language edit in Settings, dark mode, stats/badges.  
**Not on Flutter:** in-app Spotify playback (external Open in Spotify only).

---

## Phase 14 — Production Parity & Ship ✅

**Status:** Complete  
**Milestone:** v1.7 — Ship  
**Goal:** One phase for everything still open at ship: web polish, mobile parity, Connect UX, release ops.

| Plan | Name | Status | Priority |
|------|------|--------|----------|
| [14-01](./phases/14-production-parity-ship/14-01-PLAN.md) | Web polish & shell consistency | Complete | P0 |
| [14-02](./phases/14-production-parity-ship/14-02-PLAN.md) | Spotify Connect UX (popup + Library) | Complete | P0 |
| [14-03](./phases/14-production-parity-ship/14-03-PLAN.md) | Flutter Settings language editors | Complete | P1 |
| [14-04](./phases/14-production-parity-ship/14-04-PLAN.md) | Flutter Spotify playback / honest fallback | Complete | P1 |
| [14-05](./phases/14-production-parity-ship/14-05-PLAN.md) | Dual-frontend QA & Capacitor deprecate | Complete | P1 |
| [14-06](./phases/14-production-parity-ship/14-06-PLAN.md) | Play Store, domain, release runbook | Complete | P2 |
| [14-07](./phases/14-production-parity-ship/14-07-PLAN.md) | Ops — tests, AI providers, Spotify quota | Complete | P2 |

**Out of scope for 14:** Wear OS productization, iOS, full-song hosting, import Spotify→vocab pipeline.

**Context stubs:**  
[12.5-CONTEXT](./phases/12.5-spotify-connect-ux/12.5-CONTEXT.md),  
[12.6-CONTEXT](./phases/12.6-spotify-in-app-playback/12.6-CONTEXT.md),  
[13-CONTEXT](./phases/13-web-design-system/13-CONTEXT.md),  
[10-CONTEXT](./phases/10-mobile-dual-frontend/10-CONTEXT.md).

---

## Post-v1.7 polish (shipped on `main`, 2026-07-22)

Not a new phase — product refinements after Phase 14 close:

| Area | What shipped |
|------|----------------|
| Home | Discover = single home; Learn removed from nav; `/dashboard` → `/discover` |
| Settings | Music style (any/pop/rock/hip-hop/reggaeton) + voice gender (female/male) |
| Library | Connected Spotify account in **header only** (`Spotify · {name}`) |
| Player | Spotify SDK timeout → Deezer 30s + Open in Spotify |
| Brand | Transparent theme logos; HarmonixWordmark light/dark |
| Shell | Sidebar pinned full height; Pro Plan restored |

---

## Runtime health notes (2026-07-22)

Observed on VPS while live:

- Stack healthy: API `:3001`, Next `:3009`, TTS `:3002`, ngrok public **200**
- Spotify resolve-play and status in active use
- Word queue refill reaches `ready=5/5` after curated fallback
- NVIDIA primary model often **404**; OpenRouter free models hit **429** → curated Deezer path still delivers words (slow cold path)

---

## Suggested next

Optional ops only — Phase 14 is complete. Prefer `/gsd-progress` or a new milestone discuss for: production domain, Play Store listing, AI provider hardening, Extended Spotify Quota.
