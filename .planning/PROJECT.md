# Harmonix

## What This Is

Harmonix is an AI-first language learning platform that teaches vocabulary through song lyrics. It dynamically generates personalized content based on user preferences and proficiency, strictly validated against real-world music APIs (LRCLib, Deezer) to ensure accuracy. Spotify Connect powers Library sync, export, and (on web) Premium in-app playback.

## Core Value

Contextual language learning through real music lyrics with 100% accurate, AI-personalized content.

## Requirements

### Validated (v1.7 shipped)

- [x] **AI-Personalized Vocabulary**: Daily words from user profile (languages, difficulty, music style).
- [x] **Lyric Validation Loop**: AI candidates matched to Deezer + LRCLib before serving.
- [x] **Interactive web app**: Next.js App Router shell (Discover · Library · Settings).
- [x] **Audio Integration**: Deezer 30s previews; Spotify Web Playback when connected (Premium).
- [x] **User Authentication**: JWT access + httpOnly refresh cookie.
- [x] **SQLite Caching**: Songs, daily-word queue, TTS pronunciation cache.
- [x] **Open-Source Core**: MIT-licensed codebase.
- [x] **Native Android (Flutter)**: Primary mobile client (`mobile/`); Capacitor retained as legacy fallback.

### Active / optional ops

- [ ] Production domain (replace ngrok for public release)
- [ ] Play Store listing + Extended Spotify Quota for non-allowlisted users
- [ ] AI provider hardening (reduce NIM 404 / OpenRouter 429 cold-path latency)

### Out of Scope

- [ ] **Wear OS Support** — Deferred.
- [ ] **Full Song Streaming / hosting** — Copyright; 30s Deezer + Spotify Premium streaming only.
- [ ] **iOS App Store** — After Android release path is stable.
- [ ] **Import Spotify → vocab pipeline** — Not in v1.7.

## Context

Harmonix bridges traditional vocabulary apps and real-world music. Learning home is unified **Discover**. Preferences (languages, music style, voice gender) live in Settings. Dual frontend (Next.js + Flutter) shares one Express API.

## Constraints

- **Tech Stack**: Node.js (Express), SQLite, Next.js/React, Flutter Android, Pocket-TTS, Spotify Web API.
- **Budget**: Near-zero MVP (VPS + free-tier APIs); Spotify Extended Quota required for public OAuth beyond allowlist.
- **API Limits**: Respect rate limits for NVIDIA NIM, OpenRouter, LRCLib, Deezer, Spotify.
- **Licensing**: Core MIT; lyrics via LRCLib; no full-song hosting.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Node.js (Express) + SQLite | Lightweight API + zero-config persistence | Shipped |
| Dual frontend, one API | Web validate fast; Flutter for Play Store | Shipped (D-10-02) |
| Discover = single home | Remove Learn/Dashboard split | Shipped 2026-07-22 |
| Spotify-first play + Deezer fallback | Premium UX when linked; always-on preview | Shipped (D-12.6-12) |
| Library Spotify status in header only | Avoid duplicate Connect/Connected CTAs | Shipped 2026-07-22 |
| Capacitor kept as fallback | Bridge until Flutter is sole mobile path | D-14-05 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: July 22, 2026 — v1.7 complete + post-ship polish*
