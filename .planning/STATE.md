---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: harmonix-rebrand
status: in_progress
last_updated: "2026-06-25T17:30:00.000Z"
progress:
  total_phases: 12
  completed_phases: 9
  total_plans: 17
  completed_plans: 17
  percent: 100
---

# Project State — Harmonix

## Project Reference

**Core Value**: Contextual language learning through real music lyrics with 100% accurate, AI-personalized content.
**Current Focus**: All phases complete — awaiting next milestone.

## Current Position

- **Phase**: All
- **Status**: All 9 phases complete
- **Progress**: [██████████] 100%

## Performance Metrics

- **Requirement Coverage**: 100% (v1) + 2 new (v1.1)
- **Phase Completion**: 9/9
- **Plan Completion**: 17/17

## Accumulated Context

### Decisions

- **D-01-01**: Use split-token auth (In-Memory Access Token + HttpOnly Refresh Cookie).
- **D-01-02**: Implement Pure Black theme (#000000 background).
- **D-01-03**: Use SQLite in WAL mode.
- **D-02-01**: Use `lrc-file-parser` with `requestAnimationFrame` for high-precision synchronization.
- **D-02-02**: Proxy all media metadata via backend to handle CORS and implement preview offset heuristics.
- **D-03-01**: Use Stepfun-AI Step-3.7-Flash via NVIDIA NIM for CEFR-tailored vocabulary extraction.
- **D-03-02**: Implement two-pass alignment (Exact -> Case-insensitive) for word mapping.
- **D-03-03**: Use Radix UI Popover for high-contrast, distraction-free definitions.
- **D-07-01**: Word-first flow — AI generates word + song, validates via Deezer/LRCLib, caches per user/day.
- **D-07-02**: Avoid NVIDIA `json_object` response format (returns null); parse plain JSON instead.
- **D-07-03**: Show full-card loading overlay during ~1 min generation; keep previous word on refresh failure.
- **D-09-01**: Badge seeds + checks for streak/vocab/quiz/playlist/daily_word categories.
- **D-09-02**: Playlists table with unique (user_id, name) constraint; playlist_songs junction table.
- **D-09-03**: User language maps via LANG_CODE_TO_NAME at extraction site (vocab.js).
- **D-09-04**: Badge detection fires synchronously on quiz finish, results in response JSON.
- **D-09-05**: AuthContext.User extended with native_language, target_language, genre, difficulty, cefr_level.
- **D-09-06**: Onboarding uses 2-step wizard with skip option; persisted to PATCH /preferences.
- **D-09-07**: Onboarding redirect uses sessionStorage flag to prevent re-redirect per session.
- **D-09-08**: Badge unlock toast auto-dismisses after 4s from any API response with badges_unlocked.
- **D-09-09**: Dashboard grid changed to sm:grid-cols-2 for 2x2 layout (4 cards).

### Todos

- [x] Phase 8 Plan 1: Full brand rename (LyricWord → Harmonix)
- [x] Phase 8 Plan 2: Public landing page & route architecture
- [x] Phase 9 Plan 01A: Backend Foundation — DB schema, services, playlist routes, badge routes, user routes
- [x] Phase 9 Plan 01B: Backend Completion — AI language fix, study.js badge detection, AuthContext, tests
- [x] Phase 9 Plan 02: Frontend Pages — Onboarding, SRS review room, playlist pages
- [x] Phase 9 Plan 03: Dashboard Integration — Badges card, playlists card, language badge, review count, onboarding redirect

### Blockers

- (None)

## Session Continuity

**Last Session Outcomes**:

- **Phase 9 fully complete** — all 4 plans (01A, 01B, 02, 03) built, tested, and committed.
- Backend: 4 new tables (badges, user_badges, playlists, playlist_songs) + badge seeds + badgeService.js + playlist/badge/user route files.
- AI extraction now uses user's native/target language (dynamic, not hardcoded Spanish).
- Badge detection fires on quiz finish, returns unlocked badges in response.
- Onboarding wizard (2-step), SRS review room (flashcard rating), playlist list+detail pages with UndoDeleteToast.
- Dashboard: BadgeGrid, LanguageBadge (EN → ES in nav), ReviewCountBadge (link to /review), Achievements card, Playlists card, onboarding redirect.
- 94 tests passing (55 services + 19 routes pre-Phase 9 + 20 new).
- Next.js build passes — 11 routes.
- Phase 8 (Rebrand & Landing) also complete.
