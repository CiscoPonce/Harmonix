# v1 Requirements — Harmonix

**Status:** Core v1 requirements satisfied by milestone **v1.7** (Phase 14). Traceability below reflects shipped product on `main`.

## 1. Music Playback & Sync (PLAYER)

- [x] **PLAYER-01**: **Synced 30s Previews**. Play 30-second audio snippets from Deezer API synchronized with LRC-format lyrics.
- [x] **PLAYER-02**: **Contextual Audio Playback**. Replay the timestamped audio segment for a target vocabulary word (Hear it / player seek).
- [x] **PLAYER-03**: **Validation Loop**. Serve words only after Deezer match + LRCLib synced lyrics (queue + curated fallback).
- [x] **PLAYER-04**: **Spotify in-app (web)**. Web Playback SDK when connected + Premium; Deezer fallback + Open in Spotify otherwise.

## 2. AI-Driven Learning (AI)

- [x] **AI-01**: **AI-Personalized Vocab**. NVIDIA NIM / OpenRouter select vocabulary appropriate for proficiency and target language.
- [x] **AI-02**: **Daily Word**. Personalized word in a real song lyric, queued for fast next-word delivery.

## 3. Learning & Gamification (STUDY)

- [x] **STUDY-01**: **SRS Flashcards**. Spaced repetition review (`/review`) with streak/goal chips on Discover.
- [ ] **STUDY-02**: **Fill-in-the-blank Quizzes**. Interactive lyric cloze while audio plays — deferred / not shipped.
- [x] **STUDY-03**: **Basic Gamification**. Streaks, goals, badges, stats.

## 4. Platform & Infrastructure (PLAT)

- [x] **PLAT-01**: **User Authentication**. JWT login/register + refresh cookie.
- [x] **PLAT-02**: **Minimalist Dark Theme**. Forest-green design system; Discover · Library · Settings shell.
- [x] **PLAT-03**: **Settings preferences**. Home/learning languages, music style, voice gender, Spotify Connect.
- [x] **PLAT-04**: **Native Android**. Flutter app (`mobile/`) is the Play Store client.
- [x] **PLAT-05**: **Spotify Library**. OAuth, playlist sync, Harmonix→Spotify export, header account chip.

## v2 / Deferred

- **STUDY-02**: Fill-in-the-blank quizzes.
- **AI metaphor / grammar tagging**.
- **PWA offline-first** hardening.
- **iOS / Wear OS**.
- **Play Store public listing**.
- **Spotify Extended Quota** for users beyond Development Mode allowlist.

## Out of Scope

- **Full Song Playback / hosting**: Restricted to Deezer 30s + Spotify Premium streaming.
- **Community-Contributed Lyrics**: Lyrics from validated APIs only (LRCLib).

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAYER-01 | Phase 2 | Complete |
| PLAYER-02 | Phase 2 / 12.6 | Complete |
| PLAYER-03 | Phase 6 / 9.5 | Complete |
| PLAYER-04 | Phase 12.6 | Complete (web) |
| AI-01 | Phase 3 | Complete |
| AI-02 | Phase 7 / 9.5 | Complete |
| STUDY-01 | Phase 5 / 9 | Complete |
| STUDY-02 | — | Deferred |
| STUDY-03 | Phase 9 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 / 13 | Complete |
| PLAT-03 | Phase 9 / 14 + polish | Complete |
| PLAT-04 | Phase 10 / 14 | Complete |
| PLAT-05 | Phase 12 / 14 | Complete |

---
*Last updated: July 22, 2026*
