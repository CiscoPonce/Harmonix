---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: harmonix-rebrand
status: in_progress
last_updated: "2026-06-25T17:03:00.000Z"
progress:
  total_phases: 12
  completed_phases: 7
  total_plans: 17
  completed_plans: 13
  percent: 68
---

|---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: harmonix-rebrand
status: in_progress
last_updated: "2026-06-22T00:00:00.000Z"
progress:
 total_phases: 9
 completed_phases: 7
 total_plans: 15
 completed_plans: 13
 percent: 87
---

# Project State — Harmonix

## Project Reference

**Core Value**: Contextual language learning through real music lyrics with 100% accurate, AI-personalized content.
**Current Focus**: Retention, Gamification & Personalization (Phase 9, planned).

## Current Position

- **Phase**: 9
- **Plan**: 09-01A (pending)
- **Status**: Planned
- **Progress**: [████████░░] 87%

## Performance Metrics

- **Requirement Coverage**: 100% (v1) + 2 new (v1.1)
- **Phase Completion**: 7/9
- **Plan Completion**: 13/17

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

### Todos

- [x] Phase 7 Daily Word completed
- [ ] Phase 8 Plan 1: Full brand rename (LyricWord → Harmonix)
- [ ] Phase 8 Plan 2: Public landing page & route architecture
- [ ] Phase 9 Plan 01A: Backend Foundation — DB schema, services, playlist routes, badge routes, user routes
- [ ] Phase 9 Plan 01B: Backend Completion — AI language fix, study.js badge detection, AuthContext, tests
- [ ] Phase 9 Plan 02: Frontend Pages — Onboarding, SRS review room, playlist pages
- [ ] Phase 9 Plan 03: Dashboard Integration — Badges card, playlists card, language badge, review count, onboarding redirect

### Blockers

- (None)

## Session Continuity

**Last Session Outcomes**:

- Phase 7 (Daily Word) completed and verified.
- `/api/daily-word` and `/api/daily-word/new` endpoints live.
- DailyWordCard on home page with lyric snippet, audio preview, and on-demand refresh.
- AI word generation validated against Deezer and LRCLib with retry loop.
- Interactive dashboard cards (Stats, Recent, Daily) deployed with real data.
- Test database isolation (lyricword.test.db) prevents test suite from wiping production data.
- Repository renamed to Harmonix (https://github.com/CiscoPonce/Harmonix).
