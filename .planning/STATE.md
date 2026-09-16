---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: play-store-listing
status: in_progress
stopped_at: "2026-09-06 Phase 17 opened; JDK 17 installed user-local"
last_updated: "2026-09-15T20:22:00.000Z"
progress:
  total_phases: 17
  completed_phases: 16
  percent: 94
---

# Project State — Harmonix

## Current Focus

**Phase 17 — Play Store listing.** Section A (keystore + signed AAB `1.0.8+11`) is done on this PC. Remaining: Play Console create-app, screenshots, Internal testing — [`.planning/phases/17-play-store-listing/17-CHECKLIST.md`](phases/17-play-store-listing/17-CHECKLIST.md). AAB: `mobile/build/app/outputs/bundle/release/app-release.aab`. Capacitor is not a release path.

**2026-09-14 NIM/OpenRouter:** New NVIDIA Build key is live. Fast gloss uses Lightning with thinking off (~0.4–1.8s). Next-word was slow because the unused catalog is exhausted (`song_already_used`); we now skip unused AI + genre-widen and reuse a known song with a new word.

**2026-09-16 word picking:** Spanish cards reject English bilingual slips (`really` / `-ly` adverbs). Chorus chants like `(Highs, highs, highs)` are not served, even when the unused-song catalog is empty.

**2026-09-15 store polish:** Marketing homepage describes Word of the Day, not karaoke. Library/Settings leftover English follows the UI language. Kokoro has no German — first tap skips the English fake voice and uses device TTS (`de-DE`). Play Console listing and Spotify Premium/allowlist stay operator-side.

**2026-09-15 TTS words:** Testers got Pocket clicks instead of words. Isolated-word path now pads short prompts, uses EOS -2.0, rejects clips under ~180ms of voice (retry 3×), trims silence, and busts the pronunciation cache. Pocket stays best for Spanish; other languages use Kokoro then device TTS.

**2026-09-14 card IPA + TTS:** Word-of-the-Day IPA comes from an offline table (English including `younger`) so cards are not blank when NIM is down. Pocket-TTS on the host can `/reload` into the learner's language instead of speaking Spanish at English words. Pronunciation no longer returns a silent WAV — the client falls back to device TTS. Android/web show pending copy and poll while polish finishes.

**2026-09-13 daily-word cards:** Next still returns instantly when the queue is stocked. Translation + IPA come from the gloss cache / background polish. If the unused song catalog is empty (this account: 276 songs), Next reuses a known track immediately instead of waiting on NIM 403 + OpenRouter timeouts (~55s). Stem/dictionary glosses stay provisional so AI polish can replace noun/verb mix-ups (`wondering` → preguntándose). Discover search uses iTunes when Deezer 403s the VPS.

**2026-09-06 daily-word quality:** Next word is one song per card (same-song extras only as last-resort, with honesty copy).

**2026-09-05 hardening pass (post-audit):** CORS allowlist + security headers + auth/proxy rate limits; OpenRouter/NIM circuit breakers (no more 429 storms); Pocket-TTS-first pronunciation; preview-window word picks so "Hear it" plays the word; full UI i18n on web and Flutter; Flutter learns a word from a searched song; CI test gate (server/web/Flutter) before deploy; nightly SQLite backup timer (`scripts/backup-sqlite.sh`). Still open: restrict Coolify ports 8000/6001 to a VPN/allowlist, reboot VPS for pending kernel, React-compiler lint debt in `client/src` (26 pre-existing errors), Play Store listing.

## What is live now

| Surface | Evidence |
|---------|----------|
| Public web | **https://harmonix.peeporunclub.co.uk** (Let’s Encrypt) |
| Privacy | `/privacy` |
| Library URL | `/playlists` (`/library` redirects) |
| Containers | `api-rxwdj1k3qu51fqf8uwtal389` + `web-rxwdj1k3qu51fqf8uwtal389` |
| Volume | `rxwdj1k3qu51fqf8uwtal389_harmonix-data` (`SQLITE_PATH=/data/harmonix.db`, UID 999) |
| TTS | Host systemd `harmonix-tts` on `:3002` (Spanish Pocket, EOS -2.0, pad-short); Kokoro then device TTS for other languages (German skips Kokoro — no de model); compose `TTS_SKIP_SPAWN=true` |
| Deploy | Push `main` → `.github/workflows/deploy-harmonix.yml` → `scripts/coolify-redeploy.sh` (Coolify UI status only; do not use Coolify Restart) |
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
