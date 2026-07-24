---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: flutter-web-parity
status: in_progress
stopped_at: "Phase 16 started — Flutter Settings music style + voice gender + theme tokens"
last_updated: "2026-07-24T17:10:00.000Z"
progress:
  total_phases: 16
  completed_phases: 15
  percent: 94
---

# Project State — Harmonix

## Current Focus

**Phase 16 — Flutter + Capacitor web parity (v1.9).** Web remains live on Coolify. Product focus: make Flutter match web Settings / Discover / Library / design; Capacitor stays legacy WebView of production.

## What is live now

| Surface | Evidence |
|---------|----------|
| Public web | **https://harmonix.peeporunclub.co.uk** (Let’s Encrypt) |
| Containers | `api-rxwdj1k3qu51fqf8uwtal389` + `web-rxwdj1k3qu51fqf8uwtal389` |
| Volume | `rxwdj1k3qu51fqf8uwtal389_harmonix-data` (`SQLITE_PATH=/data/harmonix.db`, UID 999) |
| TTS | Host systemd `harmonix-tts` on `:3002` (`TTS_BASE_URL=http://10.0.0.15:3002`); API image includes **ffmpeg** for atempo |
| Deploy | Push `main` → `.github/workflows/deploy-harmonix.yml` → `scripts/coolify-redeploy.sh` |
| Mobile | Flutter primary (`mobile/`); Capacitor legacy loads live web |

## Phase status

| Phase | Status |
|------:|--------|
| 1–15 | Complete |
| **16** | **In progress** — Settings prefs + theme started |

## Architecture (verified)

```text
Browser / Capacitor → Traefik → api → web
Flutter Android     → same API + host TTS
Push main → GitHub Actions SSH → coolify-redeploy.sh
```

## Session

**Last session:** 2026-07-24 — Phase 16 discuss locked; Flutter Settings music style / voice gender / language list + brand tokens.  
**Default branch:** `main`  
**Active work branch:** `cursor/phase16-flutter-parity-1e8c`
