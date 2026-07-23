# Phase 15 — Coolify production deploy

**Status:** In progress (2026-07-23)  
**Milestone:** v1.8

## Goal

Run Harmonix as a Coolify Docker Compose resource on `harmonixinstance`, replacing host-managed `run_env.sh` for API + Next while keeping Pocket-TTS on the host initially.

## Done

- Confirmed Coolify 4.1.2 + Traefik healthy; no existing app resources
- Added `docker-compose.yml`, `server/Dockerfile`, `client/Dockerfile`
- `FRONTEND_PROXY_TARGET`, `SQLITE_PATH`, `TTS_SKIP_SPAWN` / `TTS_BASE_URL`
- Docs: `docs/COOLIFY-DEPLOY.md`, runbook §0b, ROADMAP/STATE

## Remaining

1. Create Coolify Docker Compose resource (Git or server directory)
2. Paste secrets; set Spotify redirects for chosen public URL
3. Deploy; smoke test; point ngrok or domain at `api`
4. Stop host Node/Next; keep TTS + Coolify
5. Optional later: TTS container

## Rollback

`docker compose down` then `bash run_env.sh`
