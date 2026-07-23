---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: coolify-production-deploy
status: complete
stopped_at: "Phase 15 domain cutover live; GitHub auto-deploy webhook still optional"
last_updated: "2026-07-23T22:10:00.000Z"
progress:
  total_phases: 15
  completed_phases: 15
  percent: 100
---

# Project State — Harmonix

## Current Focus

**Phases 1–15 COMPLETE** for production URL cutover (v1.8). Live on Coolify Traefik + Docker Compose. Optional: wire Coolify **Deploy on push** from GitHub `main`.

## What is live now

| Surface | Evidence |
|---------|----------|
| Public web | **https://harmonix.peeporunclub.co.uk** (Let’s Encrypt) |
| Compose | `lyric-api-1` + `lyric-web-1`; volume `lyric_harmonix-data` |
| TTS | Host Pocket-TTS `:3002` + systemd `harmonix-tts` |
| Coolify | Traefik + UI resource **Harmonix** (domain on `api`); Git webhook auto-deploy **not** enabled yet |
| Rollback | `run_env.sh` + ngrok documented |

## Phase status

| Phase | Status |
|------:|--------|
| 1–14 | Complete |
| **15** | **Complete** (domain + compose live; auto-deploy follow-up optional) |

## Architecture (verified)

```text
Browser → Traefik (harmonix.peeporunclub.co.uk)
            → api:3001 → web:3009
            → SQLite volume
            → host TTS :3002
```

## Session

**Last session:** 2026-07-23  
**Default branch:** `main`
