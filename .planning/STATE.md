---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: play-store-listing
status: in_progress
stopped_at: "2026-09-23 Phase 18 learner reliability complete; Phase 17 Play Console listing remains"
last_updated: "2026-09-23T20:00:00.000Z"
progress:
  total_phases: 18
  completed_phases: 17
  percent: 94
---

# Project State — Harmonix

## Current Focus

**Phase 17 — Play Store listing (current operator track).** Section A keystore + AAB `1.0.8+11` is done. **`hello@peeporunclub.co.uk` is live on Zoho** (confirmed 2026-09-23). Next: Play Console listing, screenshots, Internal testing — [`.planning/phases/17-play-store-listing/17-CHECKLIST.md`](phases/17-play-store-listing/17-CHECKLIST.md).

**Phase 18 — Learner reliability (complete).** Native-language changes purge the word queue; duplicate queue cards are discarded; song search skips lemmas already queued; streaks use UTC. New-word routes are rate-limited, passwords are at least 8 characters, and playlist lists use cached covers. Exhausted catalogs offer a style change or a song search. Spotify taste syncs after connect, and the dyslexia font is saved on web and Android. Song reuse stays off.

**2026-09-18 song uniqueness:** Next never reuses a song. Testers were getting repeats because exhausted-catalog fallback served a known track again. Unused catalog + AI new-song pick only; if nothing unused remains, the API fails honestly (`song_already_used`) instead of looping. Searching a song already learned from is also rejected.

**2026-09-14 NIM/OpenRouter:** New NVIDIA Build key is live. Fast gloss uses Lightning with thinking off (~0.4–1.8s).

**2026-09-18 shelf:** Discover cards were duplicating words (`flame`, `trust`) because gloss polish inserted a second `daily_words` row. Recent lists now keep one card per word, and polish updates the existing row.

**2026-09-23 NIM:** Live bake-off on production keys: `z-ai/glm-5.3` is primary (~468ms gloss, ~1.4–2s song JSON). `nvidia/nemotron-3.5-lightning-30b-a3b` is fast song backup (~2s). `z-ai/glm-5.3-flash` is slower (~2–8s) and demoted. OpenRouter fallback: Super `:free` only (Lightning `:free` returned placeholder songs; most other `:free` slugs 429).

**2026-09-23 next-word:** English rock example hits were all already heard (292 songs). Song pick now drops used examples and asks once more for different tracks instead of failing Next.

**2026-09-23 repo:** Public GitHub page points at the live site. Play candidate stays `1.0.8+11`. Platform changelog stays on release-please (`0.0.x`). APKs are not in git. Play Console create-app, screenshots, and Internal testing are still operator steps.

**2026-09-16 word picking:** Spanish cards reject English bilingual slips (`really` / `-ly` adverbs). Chorus chants like `(Highs, highs, highs)` are not served, even when the unused-song catalog is empty.

**2026-09-15 store polish:** Marketing homepage describes Word of the Day, not karaoke. Library/Settings leftover English follows the UI language. Kokoro has no German — first tap skips the English fake voice and uses device TTS (`de-DE`). Play Console listing and Spotify Premium/allowlist stay operator-side.

**2026-09-15 TTS words:** Testers got Pocket clicks instead of words. Isolated-word path now pads short prompts, uses EOS -2.0, rejects clips under ~180ms of voice (retry 3×), trims silence, and busts the pronunciation cache. Pocket stays best for Spanish; other languages use Kokoro then device TTS.

**2026-09-14 card IPA + TTS:** Word-of-the-Day IPA comes from an offline table (English including `younger`) so cards are not blank when NIM is down. Pocket-TTS on the host can `/reload` into the learner's language instead of speaking Spanish at English words. Pronunciation no longer returns a silent WAV — the client falls back to device TTS. Android/web show pending copy and poll while polish finishes.

**2026-09-13 daily-word cards:** Next still returns instantly when the queue is stocked. Translation + IPA come from the gloss cache / background polish. Stem/dictionary glosses stay provisional so AI polish can replace noun/verb mix-ups (`wondering` → preguntándose). Discover search uses iTunes when Deezer 403s the VPS.

**2026-09-06 daily-word quality:** Next word is one unused song per card. No same-song extras on Next.

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
| 17 | In progress — Play Store listing (mailbox live) |
| 18 | Complete — Learner reliability |

## Architecture (verified)

```text
Browser → Traefik → api → web
Flutter Android → same API + host TTS
Push main → GitHub Actions SSH → coolify-redeploy.sh
```

## Session

**Last session:** 2026-09-03 — prod hardening (password reset closed, explicit admin, JWT fail-fast, healthcheck, privacy, Flutter-only store).  
**Default branch:** `main`
