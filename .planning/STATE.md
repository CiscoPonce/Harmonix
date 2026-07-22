---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: production-parity-ship
status: complete
stopped_at: "Phases 1–14 complete; Discover/Learn unified; brand logo shipped"
last_updated: "2026-07-22T22:35:00.000Z"
progress:
  total_phases: 14
  completed_phases: 14
  percent: 100
---

# Project State — Harmonix

## Current Focus

**All roadmap phases (1–14) are COMPLETE.** Product home is unified **Discover** (Learn folded in). Brand logo live on web shell / auth / landing.

## What is live now

| Surface | Evidence |
|---------|----------|
| Public web | `https://moral-sparrow-nationally.ngrok-free.app` → HTTP 200 |
| API | Express `:3001` + JWT auth |
| Frontend | Next production `:3009` via `run_env.sh` |
| TTS | Pocket-TTS HQ `:3002` |
| Spotify | OAuth Connect (Popup & Deep Link), Library, export, web play / Hear-it |
| Languages | Web & Flutter Settings change home + learning languages (not genre) |
| Flutter | 3-tab app (Discover · Library · Settings) + Spotify OAuth/Library/export |
| Brand | `client/public/logo.png` + AppShell / auth wordmark |
| Deploy | Standalone APK runbook + `run_env.sh` |
| Git | Product branch = `main` only |

## Phase status (reconciled)

| Phase | Status | Notes |
|------:|--------|-------|
| 1–9, 9.5 | Complete | Core product |
| 10 | Complete | Flutter primary app shipped |
| 11 | Complete | TTS live |
| 12 | Complete | Spotify API Integration |
| 12.5 | Complete | Popup OAuth & Library Connect |
| 12.6 | Complete | Web Playback SDK & Android Honest Fallback |
| 13 | Complete | Web Design System + unified Discover |
| **14** | **Complete** | Production Parity & Ship |

## Architecture (verified)

```text
Next.js web (+ Capacitor bridge) ─┐
Flutter Android (`mobile/`) ──────┼─► Express + SQLite
                                  │
                     Deezer · LRCLib · NIM/OpenRouter · Spotify · Pocket-TTS
```

## Decisions carried forward

- Dual frontend, one API (D-10-02)
- Capacitor temporary fallback retained alongside Flutter (D-14-05)
- Spotify-first Hear-it / full player with Deezer fallback on web (D-12.6-12)
- Popup OAuth window on Web (`D-14-01`)
- External browser + deep link on Flutter (`D-14-03`)
- Honest Fallback for Spotify on Flutter Android (`D-14-04`)
- Standalone APK + release runbook (`D-14-07`)
- Discover is the single home; Learn nav removed (`2026-07-22`)

## Session

**Last session:** 2026-07-22  
**Stopped at:** Brand logo + repo README readiness; phases verified complete on `main`  
**Default branch:** `main`

## Known runtime issues (ops polish)

- NVIDIA `moonshotai/kimi-k2.6` → frequent 404; falls back to OpenRouter
- OpenRouter free models → 429 under load; curated catalogs keep daily word alive
- Server tests may fail when Pocket-TTS is down or Spotify `/status` contract drifts — use `run_env.sh` after pull for deploys
- Spotify playback is client SDK-driven (`player/token` + `resolve-play`); no server `/me/player` control (by design)
