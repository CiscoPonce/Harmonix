---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: play-store-listing
status: complete
stopped_at: "2026-11-09 Account profile is in the repo as Android 1.0.21 (24). Closed testing is still 1.0.18 until that build is uploaded. Public listing still needs 12 testers for 14 days."
last_updated: "2026-11-09T20:30:00.000Z"
progress:
  total_phases: 19
  completed_phases: 19
  percent: 100
---

# Project State — Harmonix

## Current Focus

**Phases 1–19 are complete.** Play closed testing is Flutter `1.0.18` (version code `21`). This repo is `1.0.21` (version code `24`): new accounts confirm an email code, and Account has a photo, username, bio, streak, achievements, and delete account. It is not uploaded. The public listing waits on 12 closed-test testers for 14 days. **`hello@peeporunclub.co.uk` is live on Zoho.**

**2026-11-08 signup:** New accounts confirm a six-digit code from `hello@peeporunclub.co.uk` before a user row is created. Existing accounts log in as before. The mail service is `https://email-auth.ponceteam.com`. The API key stays on the Harmonix server.

**2026-11-05 Play:** Closed testing had Flutter `1.0.17` (versionCode `20`) before `1.0.18`. The public listing still needs 12 opted-in testers for 14 days.

**2026-11-04 Play:** `1.0.17` adds the Android Spotify return, Next-failure actions on the open card, and a login that survives an offline open or a deploy. A rejected login returns to the welcome screen. The web has `/app/library` and `/app/settings` pages that hand back to the app. Spotify Connect works on the web.

**2026-11-04 gloss:** "stories high" is pisos, a season ticket is an abono, English "Play" is not a Spanish word, and "Sean Paul" is not taught as the verb sean.

**2026-10-31 opening:** Every fresh launch plays the white five-second drawing (no book, one circle, “LEARN WORDS THROUGH MUSIC”). Skip ends it. Coming back from another app does not replay it. The three explanation pages still show only when there is no account. The launcher icon is the circle. The web logo is unchanged.

**2026-10-26 welcome:** Logged-out launch plays the five-second Bauhaus drawing, then three screens explain what Harmonix is for, how to use a word, and how Next and search work. Get Started comes after that. Signed-in people go straight to the word. The web logo is unchanged.

**Still pending:** the public Play listing waits on 12 closed-test testers for 14 days.

**Phase 19 — Account profile (complete in repo).** Settings on the web and on Android opens with a photo, username, bio, and the current day streak, followed by words obtained, days learned, words reviewed, today's words, and localized achievements that use those same counts (`streak_7`, `daily_word_7`, `vocab_50`, `review_10`, `playlist_first`; `quiz_perfect` is hidden). The web header reflects the user's avatar or initial, and learners can delete their account directly in Settings (`DELETE /api/user/account`). A deleted account's access token is rejected. Email stays the login. Color palettes wait. Plans: `.planning/phases/19-account-profile/` (`19-01` through `19-04`). This ships in Android `1.0.21` (version code `24`), which is not uploaded yet.

**2026-10-24 gloss:** Wrong lyric senses are rejected and replaced from a curated sense (leading, grave, spirit, and the other live misses). A target language no longer accepts a song whose lyrics are another language. Stored cards are repaired on the next API start.

**2026-10-21 voices:** Host Pocket-TTS is 4.0.1 (`/home/ubuntu/pocket-tts-4/.venv`). French, Portuguese, Italian, German, and English male use it. Spanish and English female stay on Kokoro. Old pronunciation clips are not reused.

**Phase 18 — Learner reliability (complete).** Native-language changes purge the word queue; duplicate queue cards are discarded; song search skips lemmas already queued; streaks use UTC. New-word routes are rate-limited, passwords are at least 8 characters, and playlist lists use cached covers. Exhausted catalogs offer a style change or a song search. Spotify taste syncs after connect, and the dyslexia font is saved on web and Android. Song reuse stays off.

**2026-09-18 song uniqueness:** Next never reuses a song. Testers were getting repeats because exhausted-catalog fallback served a known track again. Unused catalog + AI new-song pick only; if nothing unused remains, the API fails honestly (`song_already_used`) instead of looping. Searching a song already learned from is also rejected.

**2026-09-14 NIM/OpenRouter:** New NVIDIA Build key is live. Fast gloss uses Lightning with thinking off (~0.4–1.8s).

**2026-09-18 shelf:** Discover cards were duplicating words (`flame`, `trust`) because gloss polish inserted a second `daily_words` row. Recent lists now keep one card per word, and polish updates the existing row.

**2026-09-23 NIM:** Live bake-off on production keys: `z-ai/glm-5.3` is primary (~468ms gloss, ~1.4–2s song JSON). `nvidia/nemotron-3.5-lightning-30b-a3b` is fast song backup (~2s). `z-ai/glm-5.3-flash` is slower (~2–8s) and demoted. OpenRouter fallback: Super `:free` only (Lightning `:free` returned placeholder songs; most other `:free` slugs 429).

**2026-09-23 next-word:** English rock example hits were all already heard (292 songs). Song pick now drops used examples and asks once more for different tracks instead of failing Next.

**2026-10-14 NIM:** Lightning is the primary model again. GLM-5.3 timed out on every live call, and GLM-5.3 Flash timed out on a direct probe. Both stay in the list after Lightning. `nvidia/kumo-tabular` is a self-hosted table classifier, not a hosted chat model, so it is not in this chain.

**2026-10-03 next-word:** GLM-5.3 is timing out, so an empty famous list never reached Lightning. Song picks now ask Lightning first. When the famous list is used up, Next tries the current iTunes chart for that language and style before the model.

**2026-10-01 sessions:** Logout clears the refresh cookie and the server-side refresh id. A copied refresh token cannot mint a new access token. Refresh rotates that id, and a password change does the same.

**2026-09-30 gloss:** "wheels" in Sweet Home Alabama was stored as "pez gordo" (the bigwig idiom). The lyric sense is ruedas. That hit is rejected and replaced on the next boot.

**2026-09-30 Spanish pop:** The Spanish pop catalog is now a few dozen famous songs (Shakira, Juanes, Luis Miguel, Juan Gabriel, and others) so Next does not wait on a stalled model after the first hits are used. A model timeout is not retried. Spanish pronunciation says the word twice at natural speed, and Pocket decode is steadier.

**2026-09-25 songs:** The same deeper catalog now covers pop, rock, and hip-hop for English, Spanish, French, German, Portuguese, and Italian. Reggaeton stays a Spanish list. Each of those styles has at least 12 famous songs before the model is asked.

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
| TTS | Host Pocket 4.0.1 `:3002` for French, Portuguese, Italian, German, and English male; host Kokoro `:3003` speaks Spanish and English female; compose `TTS_SKIP_SPAWN=true` |
| Deploy | Push `main` → `.github/workflows/deploy-harmonix.yml` → `scripts/coolify-redeploy.sh` (Coolify UI status only; do not use Coolify Restart) |
| Mobile | Flutter `1.0.18` (version code `21`) is on closed testing. This repo is `1.0.20` (version code `23`), with email confirmation for new accounts, and is not uploaded. Public listing still needs 12 testers for 14 days. |

## Phase status

| Phase | Status |
|------:|--------|
| 1–16 | Complete |
| 17 | Complete — closed test submitted; public release waits on Google’s tester rule |
| 18 | Complete — Learner reliability |
| 19 | Complete — Account profile |

## Architecture (verified)

```text
Browser → Traefik → api → web
Flutter Android → same API + host TTS
Push main → GitHub Actions SSH → coolify-redeploy.sh
```

## Session

**Last session:** 2026-09-03 — prod hardening (password reset closed, explicit admin, JWT fail-fast, healthcheck, privacy, Flutter-only store).  
**Default branch:** `main`
