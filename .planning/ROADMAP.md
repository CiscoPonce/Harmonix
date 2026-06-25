# Roadmap — Harmonix (formerly LyricWord)

## Phases

- [x] **Phase 1: Foundation & Auth** — Secure access and minimalist UI foundation.
- [x] **Phase 2: Core Sync Engine** — Interactive "Karaoke" playback with precise sync. (completed 2026-06-12)
- [x] **Phase 3: AI Vocabulary Extraction** — Dynamic personalization via NVIDIA NIM. (completed 2026-06-12)
- [x] **Phase 4: Active Learning** — Interactive fill-in-the-blank lyric quizzes.
- [x] **Phase 5: Retention & Gamification** — SRS flashcards and progression tracking.
- [x] **Phase 6: Data Reliability** — Validation loop and persistent caching.
- [x] **Phase 7: Daily Word** — Word-first daily learning with validated song context. (completed 2026-06-14)
- [x] **Phase 8: Harmonix Rebrand & Landing Page** — Full rebrand to Harmonix with public marketing landing page. (completed)
- [x] **Phase 9: Retention, Gamification & Personalization** — Playlists, badges, SRS review room, and multi-language support. (completed 2026-06-25)

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
  1. System identifies 5-10 target vocabulary words per song tailored to user proficiency (CEFR).
  2. User sees target words highlighted within lyrics and can report errors in definitions.
  3. System provides a fallback list ("Words in this song") for words not precisely mapped to lines.
**Plans**: 3 plans
- [x] 03-01-PLAN.md — Backend Foundation & AI Service
- [x] 03-02-PLAN.md — Vocab API & Persistence
- [x] 03-03-PLAN.md — Frontend Interactive Lyrics
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


### Phase 7: Daily Word
**Goal**: Users receive one personalized vocabulary word per day (or on demand), found in a real song lyric.
**Depends on**: Phase 6
**Requirements**: AI-02
**Success Criteria** (what must be TRUE):
  1. User opens the app and sees one AI-generated word tailored to their level and language.
  2. The word is validated against a real song on Deezer with synced lyrics from LRCLib.
  3. User sees the exact lyric line containing the word with audio preview and can request a new word.
**Plans**: 1 plan
- [x] 07-01-PLAN.md — Word-First Daily Learning Flow
**UI hint**: yes

### Phase 8: Harmonix Rebrand & Landing Page
**Goal**: Rebrand the entire app from "LyricWord" to "Harmonix" and build a public marketing landing page for unauthenticated visitors.
**Depends on**: Phase 7
**Requirements**: BRAND-01, BRAND-02
**Success Criteria** (what must be TRUE):
  1. Every user-facing and developer-facing reference to "LyricWord" is replaced with "Harmonix".
  2. The Harmonix logo and favicon are deployed across the app.
  3. Unauthenticated visitors see a professional landing page at '/' with hero, features, testimonials, and footer.
  4. Authenticated users are redirected from '/' to '/dashboard' where the full study experience lives.
  5. The landing page is responsive, uses a light theme, and matches the Harmonix design reference.
**Plans**: 2 plans
- [x] 08-01-PLAN.md — Full Brand Rename (LyricWord → Harmonix)
- [x] 08-02-PLAN.md — Public Landing Page & Route Architecture
**UI hint**: yes

### Phase 9: Retention, Gamification & Personalization
**Goal**: Shift Harmonix from a stateless utility into a sticky, engaging daily habit with playlists, badges, SRS review, and multi-language support.
**Depends on**: Phase 8
**Requirements**: STUDY-01, STUDY-03, AI-02
**Success Criteria** (what must be TRUE):
  1. User can set their native and target language via an onboarding flow; AI respects these in extraction prompts.
  2. User can create, view, and manage custom song playlists.
  3. User can unlock badges and achievements for milestones (streaks, words learned, etc.).
  4. User can review learned words via a dedicated SRS flashcard room with SM-2 algorithm.
**Plans**: 4 plans
- [x] 09-01A-PLAN.md — Backend Foundation: DB schema, services, playlist/badge/user routes
- [x] 09-01B-PLAN.md — Backend Completion: AI language fix, badge detection, AuthContext, tests
- [x] 09-02-PLAN.md — Frontend Pages: Onboarding wizard, SRS review room, playlists
- [x] 09-03-PLAN.md — Dashboard Integration: Badges card, playlists card, language badge, review count, onboarding redirect

**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 3/3 | Completed | 2026-06-12 |
| 2. Core Sync Engine | 3/3 | Completed | 2026-06-12 |
| 3. AI Vocabulary Extraction | 3/3 | Completed | 2026-06-12 |
| 4. Active Learning | 1/1 | Completed | 2026-06-13 |
| 5. Retention & Gamification | 1/1 | Completed | 2026-06-13 |
| 6. Data Reliability | 1/1 | Completed | 2026-06-13 |
| 7. Daily Word | 1/1 | Completed | 2026-06-14 |
| 8. Harmonix Rebrand & Landing | 2/2 | Completed | — |
| 9. Retention, Gamification & Personalization | 4/4 | Completed | 2026-06-25 |
