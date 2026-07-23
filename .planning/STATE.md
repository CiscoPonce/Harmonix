---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: coolify-production-deploy
status: in_progress
stopped_at: "Phase 15 scaffolding in repo; Coolify live on VPS; cutover pending"
last_updated: "2026-07-23T20:00:00.000Z"
progress:
  total_phases: 15
  completed_phases: 14
  percent: 93
---

# Project State — Harmonix

## Current Focus

**Phases 1–14 COMPLETE** (v1.7). **Phase 15 — Coolify production deploy** is in progress: Dockerfiles + compose + docs landed in repo; Coolify 4.1.2 already runs on the VPS with no app resources yet. Live traffic still uses host `run_env.sh` + ngrok until cutover.

Also shipped recently (ops, not a numbered phase): Deezer UA / iTunes preview fallback for Hear-it; Discover shelf flip cards with title + lyric phrase.

## What is live now

| Surface | Evidence |
|---------|----------|
| Public web | `https://moral-sparrow-nationally.ngrok-free.app` → via ngrok → host `:3001` |
| Coolify | UI `:8000`, Traefik `:80`/`:443` healthy; **0** applications yet |
| API | Express `:3001` + JWT auth (host process) |
| Frontend | Next production `:3009` via `run_env.sh` |
| TTS | Pocket-TTS HQ `:3002` (host) |
| Spotify | Popup OAuth, Library sync/export, web play / Hear-it |
| Deploy target | Phase 15 → `docker-compose.yml` under Coolify |

## Phase status (reconciled)

| Phase | Status | Notes |
|------:|--------|-------|
| 1–9, 9.5 | Complete | Core product |
| 10 | Complete | Flutter primary app shipped |
| 11 | Complete | TTS live |
| 12 | Complete | Spotify API Integration |
| 12.5 | Complete | Popup OAuth & Library Connect (via Phase 14-02) |
| 12.6 | Complete | Web Playback SDK & Android honest fallback |
| 13 | Complete | Web design system + unified Discover |
| **14** | **Complete** | Production Parity & Ship |
| **15** | **In progress** | Coolify Docker Compose cutover |

## Architecture (verified)

```text
Next.js web (+ Capacitor bridge) ─┐
Flutter Android (`mobile/`) ──────┼─► Express + SQLite
                                  │
                     Deezer · LRCLib · NIM/OpenRouter · Spotify · Pocket-TTS

Edge today: ngrok → :3001
Edge Phase 15: Coolify Traefik (+ domain) → api container
```

## Decisions carried forward

- Dual frontend, one API (D-10-02)
- Capacitor temporary fallback retained alongside Flutter (D-14-05)
- Spotify-first Hear-it / full player with Deezer fallback on web (D-12.6-12)
- Popup OAuth window on Web (`D-14-01`)
- Discover is the single home; Learn nav removed (`2026-07-22`)
- Coolify owns 80/443 — Harmonix must not bind them (`2026-07-23`)
- Compose: Express is public entry; proxies to Next (`FRONTEND_PROXY_TARGET`) (`2026-07-23`)
- Pocket-TTS stays host-side initially (`TTS_SKIP_SPAWN`) (`2026-07-23`)

## Session

**Last session:** 2026-07-23  
**Stopped at:** Coolify scaffolding + roadmap/state update; awaiting Coolify UI resource + domain/ngrok cutover  
**Default branch:** `main`

## Known runtime issues (ops polish)

- Deezer Akamai may 403 bare cloud IPs — browser UA + iTunes preview fallback shipped
- NVIDIA / OpenRouter free-tier flakiness → curated catalogs keep daily word alive
- Coolify cutover blocked on: Git/source connect in UI, secrets paste, domain or ngrok retarget
- Spotify Extended Quota still optional for public users
