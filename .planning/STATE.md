---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: production-parity-ship
status: ready_to_plan
stopped_at: "2026-07-22 codebase+VPS audit; phases 12/12.6-web/13 marked complete; remaining consolidated into Phase 14"
last_updated: "2026-07-22T20:15:00.000Z"
progress:
  total_phases: 14
  completed_phases: 13
  percent: 93
---

# Project State — Harmonix

## Current Focus

**Phase 14 — Production Parity & Ship** is the single remaining active phase (consolidates leftover 10 / 12.5 / 12.6-Android / 13-04 / 12-11 ops).

Today’s audit (2026-07-22) confirmed the live VPS stack and what is actually shipped in code before closing phases.

## What is live now

| Surface | Evidence |
|---------|----------|
| Public web | `https://moral-sparrow-nationally.ngrok-free.app` → HTTP 200 |
| API | Express `:3001` + JWT auth |
| Frontend | Next production `:3009` via `run_env.sh` |
| TTS | Pocket-TTS HQ `:3002` |
| Spotify | OAuth Connect, Library, export, web in-app play / Hear-it |
| Languages | Web Settings can change home + learning languages |
| Flutter | 4-tab MVP + Spotify OAuth/Library/export (no in-app Spotify play) |
| Deploy commit | `e2930c9` (settings languages) on VPS at audit time |

## Phase status (reconciled)

| Phase | Status | Notes |
|------:|--------|-------|
| 1–9, 9.5 | Complete | Core product |
| 10 | MVP done | Release/Play Store → Phase 14 |
| 11 | Complete | TTS live |
| 12 | **Complete** | Product MVP; Extended Quota → 14-07 |
| 12.5 | Folded → 14 | Popup / Library Connect not built |
| 12.6 | **Complete (web)** | Android playback → 14-04 |
| 13 | **Complete (MVP)** | Pixel polish → 14-01 |
| **14** | **Next** | All remaining work |

## Architecture (verified)

```text
Next.js web (+ Capacitor bridge) ─┐
Flutter Android (`mobile/`) ──────┼─► Express + SQLite
                                  │
                     Deezer · LRCLib · NIM/OpenRouter · Spotify · Pocket-TTS
```

## Decisions carried forward

- Dual frontend, one API (D-10-02)
- Capacitor temporary; deprecate after Flutter public launch (D-10-04)
- Spotify-first Hear-it / full player with Deezer fallback on web (D-12.6-12)
- Validation-first daily words; queue for instant next word
- Copyright: 30s Deezer previews; Spotify audio via user Premium / SDK only

## Session

**Last session:** 2026-07-22T20:15:00.000Z  
**Stopped at:** Repo hygiene + Phase 14 plans 14-01…14-07 drafted; next = execute 14-01/14-02  
**Resume file:** `.planning/phases/14-production-parity-ship/14-01-PLAN.md`  
**Default branch:** `main`

## Known runtime issues (for Phase 14-07)

- NVIDIA `moonshotai/kimi-k2.6` → frequent 404; falls back to OpenRouter
- OpenRouter free models → 429 under load; curated catalogs keep daily word alive
- Server tests ~268 pass / **2 fail:** Pocket-TTS pronounce readiness timeout; Spotify `/status` contract drift (`playback_scopes_ok` / redirect diagnostics ahead of test)
- `deploy.sh` runs full `npm test` then stalls on those failures — use `run_env.sh` after pull until 14-07 fixes them
- Spotify playback is client SDK-driven (`player/token` + `resolve-play`); no server `/me/player` control (by design)
