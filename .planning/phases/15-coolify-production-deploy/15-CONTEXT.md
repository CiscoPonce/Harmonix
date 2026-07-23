# Phase 15 — Coolify production deploy

**Status:** Complete (2026-07-23)  
**Milestone:** v1.8

## Goal

Run Harmonix under Coolify Traefik on `harmonixinstance` with a real domain; stop relying on host `run_env.sh` + ngrok for production.

## Done

- Coolify 4.1.2 + Traefik healthy
- `docker-compose.yml`, Dockerfiles, `SQLITE_PATH` / `FRONTEND_PROXY_TARGET` / host TTS
- Domain: **https://harmonix.peeporunclub.co.uk**
- Coolify service **Harmonix** (`api` + `web`) healthy
- Old VPS `agent-midas` Harmonix stopped
- GitHub Actions push → `scripts/coolify-redeploy.sh`
- Docs: `docs/COOLIFY-DEPLOY.md`, runbook, README, ROADMAP/STATE

## Follow-ups (optional)

- Containerize Pocket-TTS
- Native Coolify Git webhook (vs GitHub Actions SSH) if desired

## Rollback

Stop Coolify Harmonix containers, then `bash run_env.sh` (emergency only).
