---
phase: 12-spotify-api-integration
plan: "08"
subsystem: api
tags: [spotify, matching, export, song_cache, web, mocha]

requires:
  - phase: 12-spotify-api-integration
    provides: OAuth tokens, spotifyRequest wrapper, and playlist ownership patterns (12-02/12-04)
  - phase: 12-spotify-api-integration
    provides: Controlled-RED match corpus and export mutation contracts (12-03)
  - phase: 12-spotify-api-integration
    provides: Approved match-cache policy ttl=7d;revalidate_on_export;delete_on_disconnect (12-01)
provides:
  - Validation-first Spotify matcher with >90% labeled corpus precision
  - Persisted user-owned export jobs with match-before-create and ≤100 URI batches
  - Web Harmonix playlist export dialog, progress restore, and factual match report
affects: [12-09, 12-10, 12-11]

tech-stack:
  added: []
  patterns:
    - Deterministic rankCandidates/selectMatch with hard rejection (no popularity)
    - song_cache Spotify evidence keyed by source identity + market with 7d TTL
    - Export job identity owned by backend latest/by-id routes, not dialog state

key-files:
  created:
    - server/services/spotifyMatchService.js
    - server/services/spotifyExportService.js
    - client/src/components/SpotifyExportDialog.tsx
    - client/src/components/SpotifyMatchReport.tsx
  modified:
    - server/db.js
    - server/routes/spotify.js
    - server/services/spotifyService.js
    - server/services/spotifyMatchService.test.js
    - server/services/spotifyMatchCorpus.test.js
    - server/services/spotifyExportService.test.js
    - server/routes/spotifyExport.test.js
    - server/package.json
    - client/src/lib/spotifyContracts.ts
    - client/src/lib/spotifyContracts.test.ts
    - client/src/lib/api.ts
    - client/src/app/playlists/[id]/page.tsx

key-decisions:
  - "Duration hard-reject only when title+artist already identify the work; otherwise soft penalty → weak_candidate"
  - "Export runs match→create→add inline then returns 202 so polls restore factual completed/partial state"
  - "Disconnect clears match evidence for the user's playlist songs and deletes that user's export jobs"

patterns-established:
  - "resolveSpotifyMatch: same-market fresh cache hit; cross-market/expired revalidate via GET /tracks/{id}?market="
  - "Private create via POST /me/playlists; adds via POST /playlists/{id}/items in chunks of 100"
  - "Web detail queries latest on mount then polls by-id; dialog never owns job identity"

requirements-completed: [PHASE-12-MVP, D-12-05, D-12-11, D-12-12, D-12-13, D-12-14, D-12-15]

coverage:
  - id: D1
    description: Labeled matcher with >90% accepted-match precision and market-keyed cache
    requirement: D-12-13
    verification:
      - kind: unit
        ref: cd server && NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= npx mocha services/spotifyMatchService.test.js services/spotifyMatchCorpus.test.js
        status: pass
    human_judgment: false
  - id: D2
    description: Ownership-checked export jobs with match-before-create and ≤100 batches
    requirement: D-12-12
    verification:
      - kind: unit
        ref: cd server && NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= npx mocha services/spotifyExportService.test.js routes/spotifyExport.test.js
        status: pass
    human_judgment: false
  - id: D3
    description: Web export dialog/report with latest/by-id restore and factual outcomes
    requirement: D-12-13
    verification:
      - kind: unit
        ref: cd client && npm run test:spotify && npm run build
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-20
status: complete
---

# Phase 12 Plan 08: Validation-First Matching and Web Export Summary

**Deterministic Spotify matching (>90% corpus precision) with policy-bounded URI cache, ownership-checked private playlist export, and an honest web match report.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-20T00:07:13Z
- **Completed:** 2026-07-20T00:12:53Z
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Implemented `spotifyMatchService` with conservative normalization, edition/tie/duration rejection, and 100% labeled corpus precision (9/9 accepts, 11/11 rejections).
- Persisted `spotify_export_jobs` and orchestrated match-all → private create → ≤100 URI adds with durable partial/rate/zero-match states.
- Wired Harmonix web playlist detail to restore latest/by-id jobs and render an accessible export dialog plus factual `SpotifyMatchReport`.

## Task Commits

1. **Task 1: Make the labeled validation-first matcher pass** - `97d4e07` (feat)
2. **Task 2: Persist and expose user-owned export jobs** - `734906f` (feat)
3. **Task 3: Render and restore the web export report** - `73682f6` (feat)

**Plan metadata:** skipped (commit_docs disabled)

## Files Created/Modified

- `server/services/spotifyMatchService.js` - `normalizeTrackIdentity`, `rankCandidates`, `selectMatch`, `resolveSpotifyMatch`, cache helpers
- `server/services/spotifyExportService.js` - `exportPlaylist` / `startExport`, job persistence, mutation ordering
- `server/db.js` - Spotify match columns on `song_cache`; `spotify_export_jobs` table
- `server/routes/spotify.js` - `POST /exports`, `GET /exports/latest`, `GET /exports/:id`
- `client/src/components/SpotifyExportDialog.tsx` - accessible confirmation + determinate progress
- `client/src/components/SpotifyMatchReport.tsx` - matched/unmatched/failed report with safe Open in Spotify
- `client/src/app/playlists/[id]/page.tsx` - export CTA, restore-on-mount, connection-aware gating
- `client/src/lib/spotifyContracts.ts` / `api.ts` - export job DTO parsing and API helpers

## Decisions Made

- Duration conflicts are hard rejects only when title and artists already agree; weak wrong-work candidates fall through to `weak_candidate`.
- Export completion is synchronous inside `startExport` but still returns HTTP 202 so clients can treat the job as durable and restore via latest/by-id.
- Disconnect deletes the user's export jobs and clears Spotify match columns for songs on that user's Harmonix playlists (TTL still bounds shared catalog evidence).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Outer exported count stayed 0 after mid-add 429**
- **Found during:** Task 2
- **Issue:** `addUriBatches` threw on rate limit before returning, so the catch path reported `exported_count: 0` even after a successful first batch of 100.
- **Fix:** Update outer `exported` inside the per-batch callback before persisting.
- **Files modified:** `server/services/spotifyExportService.js`
- **Verification:** rate-interruption export service test passes
- **Committed in:** `734906f`

**2. [Rule 2 - Missing critical functionality] Full-repo `npm run lint` still fails on pre-existing unrelated errors**
- **Found during:** Task 3
- **Issue:** Plan verify lists `npm run lint`; repo-wide eslint reports pre-existing errors outside this plan’s files.
- **Fix:** Verified new/changed client files with scoped eslint (exit 0); full lint not fixed (out of scope).
- **Verification:** `npx eslint` on Task 3 paths exit 0; `npm run build` pass
- **Committed in:** `73682f6`

## Known Stubs

None — matcher, export orchestration, and web report are wired end-to-end for owned Harmonix playlists.

## Self-Check: PASSED

- FOUND: `server/services/spotifyMatchService.js`
- FOUND: `server/services/spotifyExportService.js`
- FOUND: `client/src/components/SpotifyExportDialog.tsx`
- FOUND: `client/src/components/SpotifyMatchReport.tsx`
- FOUND: `97d4e07`
- FOUND: `734906f`
- FOUND: `73682f6`
