# v1 Requirements — LyricWord

## 1. Music Playback & Sync (PLAYER)

- [x] **PLAYER-01**: **Synced 30s Previews**. Play 30-second audio snippets from Deezer API synchronized with LRC-format lyrics.
- [ ] **PLAYER-02**: **Contextual Audio Playback**. Allow users to replay the specific timestamped audio segment associated with a target vocabulary word.
- [ ] **PLAYER-03**: **Validation Loop**. Implement logic to verify that AI-selected songs have valid LRC lyrics and that audio durations match the lyric timestamps before serving to users.

## 2. AI-Driven Learning (AI)

- [ ] **AI-01**: **AI-Personalized Vocab**. Use NVIDIA NIM to analyze song lyrics and select 5-10 vocabulary words appropriate for the user's proficiency level and target language.

## 3. Learning & Gamification (STUDY)

- [ ] **STUDY-01**: **SRS Flashcards**. Implement a Spaced Repetition System (FSRS) for reviewing learned vocabulary words.
- [ ] **STUDY-02**: **Fill-in-the-blank Quizzes**. Generate interactive exercises where users must identify or type the missing target word in a lyric snippet while the audio plays.
- [ ] **STUDY-03**: **Basic Gamification**. Track user XP, daily streaks, and levels to encourage consistent practice.

## 4. Platform & Infrastructure (PLAT)

- [ ] **PLAT-01**: **User Authentication**. JWT-based secure login and registration system (Email/Password).
- [ ] **PLAT-02**: **Minimalist Dark Theme**. A high-contrast, distraction-free UI designed for focused language study.

---

## v2 / Deferred Requirements

- **PLAYER-04**: Search & Discovery (Manual song search).
- **AI-02**: Metaphor Decoder (Explaining poetic slang).
- **AI-03**: Grammar Pattern Tagging.
- **PLAT-03**: PWA Support (Service workers, offline caching).
- **PLAT-04**: Native Mobile Apps (Flutter).

## Out of Scope

- **Full Song Playback**: Restricted to 30s previews for copyright compliance.
- **Community-Contributed Lyrics**: All lyrics must be sourced from validated APIs.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAYER-01 | Phase 2 | Complete |
| PLAYER-02 | Phase 2 | Pending |
| PLAYER-03 | Phase 6 | Pending |
| AI-01 | Phase 3 | Pending |
| STUDY-01 | Phase 5 | Pending |
| STUDY-02 | Phase 4 | Pending |
| STUDY-03 | Phase 5 | Pending |
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
