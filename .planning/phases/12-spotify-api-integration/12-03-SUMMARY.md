---
phase: 12-spotify-api-integration
plan: "03"
subsystem: testing
tags: [spotify, matching, corpus, flutter, nextjs, controlled-red, provider-identity]

requires:
  - phase: 12-spotify-api-integration
    provides: OAuth/crypto primitives and foundation controlled-RED runners (12-02)
provides:
  - Labeled multilingual match corpus with >90% accepted-match precision gate
  - Controlled-RED match ranking and expanded export mutation-order contracts
  - Flutter Settings/Library/detail/export controlled-RED widget contracts
  - Dependency-free web provider DTO contracts with Node 24 test:spotify
affects: [12-04, 12-05, 12-06, 12-07, 12-08, 12-09]

tech-stack:
  added: []
  patterns:
    - accepted-match precision (not overall accuracy) corpus gate
    - Flutter constructor-contract factories returning null until implementation slices
    - Node 24 --experimental-strip-types web contract tests without new packages

key-files:
  created:
    - server/services/fixtures/spotify-match-corpus.json
    - server/services/spotifyMatchService.test.js
    - server/services/spotifyMatchCorpus.test.js
    - mobile/test/spotify_settings_test.dart
    - mobile/test/spotify_deep_link_test.dart
    - mobile/test/spotify_library_list_test.dart
    - mobile/test/spotify_playlist_detail_test.dart
    - mobile/test/spotify_export_test.dart
    - mobile/tool/assert_red_spotify_tests.dart
    - client/src/lib/spotifyContracts.ts
    - client/src/lib/spotifyContracts.test.ts
    - .planning/phases/12-spotify-api-integration/deferred-items.md
  modified:
    - server/services/spotifyExportService.test.js
    - server/scripts/assert-red-contracts.js
    - client/package.json

key-decisions:
  - "Precision gate divides correct accepts by (correct accepts + false positives); rejection coverage is tracked separately"
  - "Flutter RED uses explicit Args + factory hooks that fail with slice sentinels until owning implementation plans"
  - "Web strategy is pure DTO contracts + test:spotify + eslint(on new files) + next build; no component/E2E package"
  - "Installed Next 16.2.9 docs exist at client/node_modules/next/dist/docs/ (01-app App Router tree)"

patterns-established:
  - "assert_red_spotify_tests.dart mirrors server assert-red-contracts with explicit files + sentinel"
  - "providerStableId / safeSpotifyUrl are the shared web navigation trust boundary"

requirements-completed: [PHASE-12-MVP, D-12-02, D-12-03, D-12-04, D-12-06, D-12-08, D-12-09, D-12-10, D-12-12, D-12-13]

coverage:
  - id: D1
    description: Match corpus fixture covers multilingual and research collision categories
    requirement: D-12-13
    verification:
      - kind: unit
        ref: server/services/spotifyMatchCorpus.test.js#loads a labeled multilingual corpus
        status: pass
    human_judgment: false
  - id: D2
    description: Controlled RED for match ranking and corpus precision gate
    requirement: D-12-13
    verification:
      - kind: unit
        ref: node scripts/assert-red-contracts.js … --sentinel NOT_IMPLEMENTED_SPOTIFY_MATCH
        status: pass
    human_judgment: false
  - id: D3
    description: Controlled RED for export mutation-order and partial-state contracts
    requirement: D-12-12
    verification:
      - kind: unit
        ref: node scripts/assert-red-contracts.js services/spotifyExportService.test.js --sentinel NOT_IMPLEMENTED_SPOTIFY_EXPORT
        status: pass
    human_judgment: false
  - id: D4
    description: Flutter Settings/deep-link/list/detail/export controlled RED groups
    requirement: D-12-02
    verification:
      - kind: automated_ui
        ref: dart run tool/assert_red_spotify_tests.dart --sentinel NOT_IMPLEMENTED_SPOTIFY_*
        status: pass
    human_judgment: false
  - id: D5
    description: Web provider DTO contracts and Node 24 test:spotify without new dependency
    requirement: D-12-08
    verification:
      - kind: unit
        ref: cd client && npm run test:spotify
        status: pass
    human_judgment: false
  - id: D6
    description: Production Next build remains green with new contracts
    requirement: PHASE-12-MVP
    verification:
      - kind: integration
        ref: cd client && npm run build
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-07-20
status: complete
---

# Phase 12 Plan 03: Wave 0 Client & Matching Contracts Summary

**Locked provider-aware identity, a >90% accepted-match corpus gate, and independently executable controlled-RED contracts for backend matching/export, Flutter journeys, and dependency-free web DTOs.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-19T23:34:02Z
- **Completed:** 2026-07-19T23:38:27Z
- **Tasks:** 3/3
- **Files modified:** 15

## Accomplishments

- Authored a labeled multilingual match corpus covering diacritics, featured artists, editions, ties, local/unavailable, duration, and null-item cases with an accepted-match precision floor > 0.90.
- Expanded export RED contracts for validation-before-mutation, zero-match no-create, ≤100 batching, cache/market policy, no-AI boundary, and pre/post-create partial states.
- Added Flutter controlled-RED suites for Settings link, OAuth→Library, provider-separated Library, detail, and export with `assert_red_spotify_tests.dart`.
- Shipped green web `spotifyContracts` (stable IDs, safe Spotify URLs, DTO parsers) runnable via `npm run test:spotify` on Node 24 with no new packages.

## Task Commits

1. **Task 1:** `75d2754` — `test(12-03): add matching corpus and export RED contracts`
2. **Task 2:** `5db6387` — `test(12-03): add Flutter Spotify controlled-RED widget contracts`
3. **Task 3:** `9846f49` — `feat(12-03): add dependency-free web Spotify DTO contracts`

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `server/services/fixtures/spotify-match-corpus.json` — labeled accept/reject corpus
- `server/services/spotifyMatchService.test.js` / `spotifyMatchCorpus.test.js` — MATCH sentinel RED
- `server/services/spotifyExportService.test.js` — expanded EXPORT sentinel RED
- `server/scripts/assert-red-contracts.js` — explicit-file + sentinel isolation hardening
- `mobile/test/spotify_*.dart` — Flutter slice contracts
- `mobile/tool/assert_red_spotify_tests.dart` — Flutter controlled-RED runner
- `client/src/lib/spotifyContracts.ts` / `.test.ts` — web DTO/provider identity contracts
- `client/package.json` — `test:spotify` script
- `deferred-items.md` — pre-existing full-suite lint debt

## Decisions Made

- Measure precision only among accepted matches so forced rejections cannot inflate the >90% target.
- Flutter factories stay in test files until 12-06/12-07/12-09 wire real widgets; each slice sentinel is independently provable.
- Inspected installed Next 16.2.9 docs at `client/node_modules/next/dist/docs/01-app/` before web contract work (docs present).
- Deliberately avoided adding a web component/E2E package; UI acceptance remains lint (scoped), `next build`, and plan 12-10 browser verification.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed as written for deliverable contracts.

### Pre-existing / Deferred

**1. [Scope boundary] Full `npm run lint` already fails on unrelated files**
- **Found during:** Task 3 verification
- **Issue:** Pre-existing `react-hooks/set-state-in-effect` and related errors outside 12-03 files.
- **Action:** Verified new files with `npx eslint src/lib/spotifyContracts.ts src/lib/spotifyContracts.test.ts` (pass); logged full-suite lint debt in `deferred-items.md`. Did not mass-fix unrelated UI.
- **Files modified:** `deferred-items.md` only

## TDD Gate Compliance

- Task 1–2 are Wave 0 controlled-RED (test commits only); GREEN lands in owning implementation plans (12-08 match/export, 12-06/07/09 Flutter).
- Task 3 shipped GREEN pure contracts with `feat(12-03)` after executable Node tests — RED gate N/A for dependency-free parsers that are the deliverable itself.

## Known Stubs

Intentional Wave 0 stubs (required for controlled RED; not plan-blocking):

| File | Stub | Reason |
|------|------|--------|
| `mobile/test/spotify_*_test.dart` factories | return `null` | Implementation slices 12-06/07/09 replace with real widgets |
| `server` match/export services | absent modules | GREEN in 12-08 |

## Threat Flags

None beyond plan threat model T-12-11…T-12-14 — contracts encode provider allowlist, precision gate, HTTPS Spotify URL allowlist, and partial export report shapes.

## Self-Check: PASSED

- FOUND: `server/services/fixtures/spotify-match-corpus.json`
- FOUND: `server/services/spotifyMatchService.test.js`
- FOUND: `server/services/spotifyMatchCorpus.test.js`
- FOUND: `mobile/tool/assert_red_spotify_tests.dart`
- FOUND: `client/src/lib/spotifyContracts.ts`
- FOUND: `client/src/lib/spotifyContracts.test.ts`
- FOUND: commit `75d2754`
- FOUND: commit `5db6387`
- FOUND: commit `9846f49`
