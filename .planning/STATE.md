---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: play-store-listing
status: in_progress
stopped_at: "2026-09-06 Phase 17 opened; JDK 17 installed user-local"
last_updated: "2026-09-06T20:50:00.000Z"
progress:
  total_phases: 17
  completed_phases: 16
  percent: 94
---

# Project State — Harmonix

## Current Focus

**Phase 17 — Play Store listing.** Remaining steps: [`.planning/phases/17-play-store-listing/17-CHECKLIST.md`](phases/17-play-store-listing/17-CHECKLIST.md). JDK 17 is on this PC at `$HOME/.local/jdk/jdk-17`. Still need: upload keystore, signed AAB, Console screenshots, Internal testing. Capacitor is not a release path.

**2026-09-05 hardening pass (post-audit):** CORS allowlist + security headers + auth/proxy rate limits; OpenRouter/NIM circuit breakers (no more 429 storms); Pocket-TTS-first pronunciation; preview-window word picks so "Hear it" plays the word; full UI i18n on web and Flutter; Flutter learns a word from a searched song; CI test gate (server/web/Flutter) before deploy; nightly SQLite backup timer (`scripts/backup-sqlite.sh`). Gloss cache + MyMemory quota cooldown so blank Word-of-the-Day translations refill from history/table. Discover search uses iTunes when Deezer 403s the VPS. Still open: restrict Coolify ports 8000/6001 to a VPN/allowlist, reboot VPS for pending kernel, React-compiler lint debt in `client/src` (26 pre-existing errors), Play Store listing.

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
| 17 | In progress — Play Store listing |

## Architecture (verified)

```text
Browser → Traefik → api → web
Flutter Android → same API + host TTS
Push main → GitHub Actions SSH → coolify-redeploy.sh
```

## Session

**Last session:** 2026-09-03 — prod hardening (password reset closed, explicit admin, JWT fail-fast, healthcheck, privacy, Flutter-only store).  
**Default branch:** `main`
