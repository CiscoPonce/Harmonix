---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: flutter-web-parity
status: complete
stopped_at: "Phase 16 closed; Play Store is Flutter-only"
last_updated: "2026-09-03T21:50:00.000Z"
progress:
  total_phases: 16
  completed_phases: 16
  percent: 100
---

# Project State — Harmonix

## Current Focus

**Play Store listing (Flutter `mobile/` only).** Phase 16 workstreams shipped in July; planning docs caught up 2026-09-03. Capacitor is not a release path.

## What is live now

| Surface | Evidence |
|---------|----------|
| Public web | **https://harmonix.peeporunclub.co.uk** (Let’s Encrypt) |
| Privacy | `/privacy` |
| Library URL | `/playlists` (`/library` redirects) |
| Containers | `api-rxwdj1k3qu51fqf8uwtal389` + `web-rxwdj1k3qu51fqf8uwtal389` |
| Volume | `rxwdj1k3qu51fqf8uwtal389_harmonix-data` (`SQLITE_PATH=/data/harmonix.db`, UID 999) |
| TTS | Host systemd `harmonix-tts` on `:3002`; compose `TTS_SKIP_SPAWN=true` |
| Deploy | Push `main` → `.github/workflows/deploy-harmonix.yml` → `scripts/coolify-redeploy.sh` |
| Mobile | Flutter Play Store path (`mobile/`) |

## Phase status

| Phase | Status |
|------:|--------|
| 1–16 | Complete |

## Architecture (verified)

```text
Browser → Traefik → api → web
Flutter Android → same API + host TTS
Push main → GitHub Actions SSH → coolify-redeploy.sh
```

## Session

**Last session:** 2026-09-03 — prod hardening (password reset closed, explicit admin, JWT fail-fast, healthcheck, privacy, Flutter-only store).  
**Default branch:** `main`
