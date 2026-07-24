---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: coolify-production-deploy
status: complete
stopped_at: "Phase 15 cutover re-verified; .com NXDOMAIN; live domain .co.uk"
last_updated: "2026-07-24T17:00:00.000Z"
progress:
  total_phases: 15
  completed_phases: 15
  percent: 100
---

# Project State — Harmonix

## Current Focus

**Phases 1–15 COMPLETE** (v1.8). Production is Coolify Traefik + Compose. **Deploy via GitHub Actions only** (or `scripts/coolify-redeploy.sh`) — do **not** use Coolify UI Restart.

Next product work starts with a new milestone discuss when ready.

## What is live now

| Surface | Evidence |
|---------|----------|
| Public web | **https://harmonix.peeporunclub.co.uk** (Let’s Encrypt) |
| Containers | `api-rxwdj1k3qu51fqf8uwtal389` + `web-rxwdj1k3qu51fqf8uwtal389` |
| Volume | `rxwdj1k3qu51fqf8uwtal389_harmonix-data` (`SQLITE_PATH=/data/harmonix.db`, UID 999) |
| TTS | Host systemd `harmonix-tts` on `:3002` (`TTS_BASE_URL=http://10.0.0.15:3002`); API image includes **ffmpeg** for atempo |
| Deploy | Push `main` → `.github/workflows/deploy-harmonix.yml` → `scripts/coolify-redeploy.sh` (Traefik API/web standbys, zero-downtime) |
| Coolify | Traefik + UI resource **Harmonix** (env/status only — not Restart for deploys) |
| Rollback | `run_env.sh` + ngrok documented (legacy only) |

## Phase status

| Phase | Status |
|------:|--------|
| 1–14 | Complete |
| **15** | **Complete** (domain + Coolify + GH Actions auto-deploy) |

## Architecture (verified)

```text
Browser → Traefik (harmonix.peeporunclub.co.uk)
            → api:3001 → web:3009
            → SQLite volume (Coolify UUID)
            → host TTS :3002 (systemd)
Push main → GitHub Actions SSH → coolify-redeploy.sh
```

## Session

**Last session:** 2026-07-24 — Coolify domain cutover plan closed out against live `.co.uk` (`.com` still NXDOMAIN).  
**Default branch:** `main`
