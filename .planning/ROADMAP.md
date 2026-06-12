# Roadmap — LyricWord

## Phases

- [x] **Phase 1: Foundation & Auth** — Secure access and minimalist UI foundation.
- [x] **Phase 2: Core Sync Engine** — Interactive "Karaoke" playback with precise sync. (completed 2026-06-12)
- [ ] **Phase 3: AI Vocabulary Extraction** — Dynamic personalization via NVIDIA NIM.
- [ ] **Phase 4: Active Learning** — Interactive fill-in-the-blank lyric quizzes.
- [ ] **Phase 5: Retention & Gamification** — SRS flashcards and progression tracking.
- [ ] **Phase 6: Data Reliability** — Validation loop and persistent caching.

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Users can securely access the platform with a high-contrast UI foundation.
**Depends on**: Nothing
**Requirements**: PLAT-01, PLAT-02
**Success Criteria** (what must be TRUE):
  1. User can create an account and log in via email/password.
  2. User experiences a distraction-free minimalist dark interface from the start.
  3. User remains authenticated across browser sessions and refreshes.
**Plans**: 3 plans
- [x] 01-01-PLAN.md — Backend Auth API
- [x] 01-02-PLAN.md — Frontend High-Contrast Foundation
- [x] 01-03-PLAN.md — Auth UI & Session Management
**UI hint**: yes

### Phase 2: Core Sync Engine
**Goal**: Users can play song snippets synchronized with interactive lyrics.
**Depends on**: Phase 1
**Requirements**: PLAYER-01, PLAYER-02
**Success Criteria** (what must be TRUE):
  1. User can listen to 30s audio previews with "Karaoke-style" lyric highlighting.
  2. User can click a specific lyric line to jump the audio to that timestamp.
  3. Audio and lyrics remain perfectly synchronized without perceptible drift.
**Plans**: 3 plans
- [x] 02-01-PLAN.md — Backend Media Proxy
- [x] 02-02-PLAN.md — Lyric Sync Engine Hook
- [x] 02-03-PLAN.md — Karaoke UI Integration
**UI hint**: yes

### Phase 3: AI Vocabulary Extraction
**Goal**: Users receive personalized vocabulary words extracted from song lyrics.
**Depends on**: Phase 2
**Requirements**: AI-01
**Success Criteria** (what must be TRUE):
  1. System identifies 5-10 target vocabulary words per song tailored to user proficiency.
  2. User sees target words highlighted within the interactive lyric view.
  3. User can view context-aware definitions for target words during playback.
**Plans**: 3 plans
- [ ] 03-01-PLAN.md — Backend Foundation & AI Service
- [ ] 03-02-PLAN.md — Vocab API & Persistence
- [ ] 03-03-PLAN.md — Frontend Interactive Lyrics
**UI hint**: yes

### Phase 4: Active Learning
**Goal**: Users can practice vocabulary through interactive lyric-based exercises.
**Depends on**: Phase 3
**Requirements**: STUDY-02
**Success Criteria** (what must be TRUE):
  1. User can complete fill-in-the-blank quizzes using song lyrics as the source.
  2. User receives immediate visual/audio feedback for correct and incorrect answers.
  3. Quizzes dynamically use target vocabulary extracted in the previous phase.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Retention & Gamification
**Goal**: Users are motivated to return via spaced repetition and progress tracking.
**Depends on**: Phase 4
**Requirements**: STUDY-01, STUDY-03
**Success Criteria** (what must be TRUE):
  1. User can review learned words via a Spaced Repetition System (SRS) interface.
  2. User sees a persistent display of their daily streak and total XP.
  3. User receives feedback/celebration when hitting daily study goals.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Data Reliability
**Goal**: System ensures content integrity through automated validation.
**Depends on**: Phase 5
**Requirements**: PLAYER-03
**Success Criteria** (what must be TRUE):
  1. System automatically prevents serving songs where lyrics and audio timing mismatch.
  2. User experiences fast, reliable song loading through intelligent local caching.
  3. Only songs with validated LRC metadata are presented in the learning feed.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 3/3 | Completed | 2026-06-12 |
| 2. Core Sync Engine | 3/3 | Complete   | 2026-06-12 |
| 3. AI Vocabulary Extraction | 0/3 | Not started | - |
| 4. Active Learning | 0/0 | Not started | - |
| 5. Retention & Gamification | 0/0 | Not started | - |
| 6. Data Reliability | 0/0 | Not started | - |
