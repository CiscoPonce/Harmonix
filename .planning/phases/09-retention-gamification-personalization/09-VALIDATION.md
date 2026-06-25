# Phase 9: Retention, Gamification & Personalization — Validation

**Generated:** 2026-06-25
**Source:** RESEARCH.md § Validation Architecture + plan-checker analysis

## Test Framework

| Property | Value |
|----------|-------|
| Framework | mocha ^11.7.6 + chai ^6.2.2 |
| Config file | In package.json test script |
| Quick run command | `npm test -- --grep "Playlist\|Badge\|User\|Progress"` |
| Full suite command | `npm test` (runs all `*test.js` in services, routes, utils) |

## Phase Requirements → Test Map

| Behavior | Test Type | Automated Command | Test File |
|----------|-----------|-------------------|-----------|
| Playlist CRUD: create, read, update, delete, list, auth | unit | `npm test -- --grep "Playlist"` | `server/routes/playlists.test.js` |
| Playlist song add/remove | unit | `npm test -- --grep "Playlist"` | `server/routes/playlists.test.js` |
| Badge: list all badges, show unlock status | unit | `npm test -- --grep "Badge"` | `server/routes/badges.test.js` |
| Badge: unlock detection prevents duplicate inserts | unit | `npm test -- --grep "Badge"` | `server/services/badgeService.test.js` |
| User: PATCH preferences writes to DB, returns updated user | unit | `npm test -- --grep "User"` | `server/routes/user.test.js` |
| User: GET preferences returns defaults | unit | `npm test -- --grep "User"` | `server/routes/user.test.js` |
| User: PATCH rejects invalid target_language | unit | `npm test -- --grep "User"` | `server/routes/user.test.js` |
| BadgeService: streak_7 threshold check | unit | `npm test -- --grep "BadgeService\|badge"` | `server/services/badgeService.test.js` |
| BadgeService: vocab_50 threshold check | unit | `npm test -- --grep "BadgeService\|badge"` | `server/services/badgeService.test.js` |
| BadgeService: playlist_first threshold check | unit | `npm test -- --grep "BadgeService\|badge"` | `server/services/badgeService.test.js` |
| BadgeService: duplicate unlock prevention | unit | `npm test -- --grep "BadgeService\|badge"` | `server/services/badgeService.test.js` |
| SRS Review: existing progress.test.js still passes | unit | `npm test -- --grep "Progress"` | `server/routes/progress.test.js` |
| Onboarding: redirect when native_language is null | e2e | manual | — |
| Vocab: language not hardcoded | unit | grep check on vocab.js | — |

## Sampling Rate

- **Per task commit:** `npm test -- --grep "Playlist|Badge|User|Progress"` (new routes + SRS)
- **Per wave merge:** Full `npm test` suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

## Test File Checklist

- [ ] `server/routes/playlists.test.js` — playlist CRUD, auth, owner enforcement, empty states
- [ ] `server/routes/badges.test.js` — badge list, unlock status
- [ ] `server/routes/user.test.js` — PATCH/GET preferences, field validation
- [ ] `server/services/badgeService.test.js` — unit tests for each badge threshold check

## Wave 0 Gaps (Pre-Execution)

None — all test files are in Plan 01B with explicit tasks to create them.

## Phase Gate Verification

After all 4 plans execute, run:
1. `npm test` — all tests pass (existing + new)
2. Manual: visit `/onboarding` as new user → verify 2-step wizard
3. Manual: visit `/review` with due words → verify flashcard UX
4. Manual: visit `/playlists` → verify CRUD
5. Manual: visit `/dashboard` → verify Achievements card, Playlists card, language badge, review count
6. Manual: complete a quiz → verify badge unlock toast
