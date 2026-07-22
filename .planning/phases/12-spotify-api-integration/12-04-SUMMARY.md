---
phase: 12-spotify-api-integration
plan: "04"
subsystem: api
tags: [spotify, oauth, pkce, aes-gcm, playlists, rate-limit, sqlite, mocha]

requires:
  - phase: 12-spotify-api-integration
    provides: Fixed HTTPS callback, encryption key custody, scopes (12-01)
  - phase: 12-spotify-api-integration
    provides: OAuth/crypto primitives and controlled-RED foundation/list contracts (12-02)
provides:
  - Runnable authenticated Spotify status/start/disconnect and public OAuth callback
  - Encrypted token lifecycle with pre-expiry refresh serialization and invalid_grant reconnect
  - Rate-aware Spotify request wrapper (timeout, per-user admission, exact Retry-After)
  - User-scoped user_spotify_playlists complete-sync upsert/prune API
affects: [12-05, 12-06, 12-07, 12-08, 12-09]

tech-stack:
  added: []
  patterns:
    - backend-owned PKCE callback with fixed client-kind destinations
    - injectable fetch/clock/sleep Spotify client factory
    - complete-sync-only playlist prune inside SQLite transaction

key-files:
  created:
    - server/services/spotifyService.js
    - server/routes/spotify.js
    - server/.env.example
  modified:
    - .gitignore
    - server/db.js
    - server/index.js
    - server/package.json
    - server/services/spotifyService.test.js
    - server/routes/spotify.test.js
    - server/services/spotifyPlaylistList.test.js
    - server/routes/spotifyPlaylistList.test.js

key-decisions:
  - "Public callback mounted at /api/spotify/oauth/callback before authenticated /api/spotify"
  - "Status allowlist uses disconnected|connected|reconnect_required|provider_error; tokens never returned"
  - "Playlist metadata TTL follows 7-day match-cache policy; prune only after full /me/playlists pagination"
  - "createSpotifyClient resolves global fetch at call time so route tests can inject fakes"

patterns-established:
  - "protectedRouter + callbackRouter split exports for JWT vs state authorization"
  - "safeLog redacts code/state/token material from callback/error logs"

requirements-completed: [PHASE-12-MVP, D-12-01, D-12-04, D-12-05, D-12-06, D-12-08, D-12-11, D-12-14, D-12-15]

coverage:
  - id: D1
    description: Authenticated start/status/callback/disconnect OAuth journey with fixed redirects
    requirement: D-12-01
    verification:
      - kind: unit
        ref: npx mocha services/spotifyOAuthService.test.js services/spotifyCrypto.test.js services/spotifyService.test.js routes/spotify.test.js
        status: pass
    human_judgment: false
  - id: D2
    description: Pre-expiry refresh serialization, rotation retention, invalid_grant reconnect_required
    requirement: D-12-11
    verification:
      - kind: unit
        ref: services/spotifyService.test.js#serializes pre-expiry refresh
        status: pass
    human_judgment: false
  - id: D3
    description: Exact Retry-After, capped retries, and per-user admission on Spotify requests
    requirement: D-12-15
    verification:
      - kind: unit
        ref: services/spotifyService.test.js#waits exact Retry-After seconds
        status: pass
    human_judgment: false
  - id: D4
    description: User-scoped playlist list sync with upsert/prune and cross-user isolation
    requirement: D-12-08
    verification:
      - kind: unit
        ref: npx mocha services/spotifyPlaylistList.test.js routes/spotifyPlaylistList.test.js
        status: pass
    human_judgment: false
  - id: D5
    description: Idempotent disconnect removes tokens, OAuth transactions, and playlist rows only for that user
    requirement: D-12-05
    verification:
      - kind: unit
        ref: routes/spotify.test.js#disconnect is idempotent
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-20
status: complete
---

# Phase 12 Plan 04: Backend OAuth/Status/List Foundation Summary

**Shipped a runnable backend Spotify linking journey: PKCE start/callback, safe status, encrypted refresh, rate-aware provider calls, and user-scoped playlist list sync with green Mocha contracts.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T23:39:51Z
- **Completed:** 2026-07-19T23:45:54Z
- **Tasks:** 2/2
- **Files modified:** 11

## Accomplishments

- Implemented `spotifyService` with injectable fetch/clock/sleep, AES-GCM token upsert/decrypt, 60s pre-expiry refresh serialization, six-month `authorized_at` expiry, and `invalid_grant` → credential deletion.
- Mounted public `GET /api/spotify/oauth/callback` separately from authenticated status/start/disconnect/playlists routes; success/error redirects use only 12-01 fixed env destinations.
- Added `user_spotify_playlists` persistence and complete-sync upsert/prune that preserves prior rows on timeout/429/partial failure; disconnect cleans user-scoped rows transactionally.
- Turned foundation and list controlled-RED contracts into normal green Mocha suites; detail/export/match remain ignored.

## Task Commits

1. **Task 1:** `e7f66e5` — `feat(12-04): implement Spotify OAuth status refresh and disconnect`
2. **Task 2:** `04bf425` — `feat(12-04): sync user-scoped Spotify playlist snapshots`

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `server/services/spotifyService.js` — token lifecycle, provider wrapper, playlist sync
- `server/routes/spotify.js` — `protectedRouter` + `callbackRouter`
- `server/db.js` — `user_spotify_playlists` + indexes
- `server/index.js` — mount public callback then authenticated Spotify routes
- `server/.env.example` — names-only Spotify env template
- `.gitignore` — protect `.env*` while allowing `*.env.example`
- Foundation/list `*.test.js` — behavioral green contracts
- `server/package.json` — stop ignoring foundation/list suites

## Decisions Made

- Callback errors after state consume carry `clientKind` so Android/web error URLs stay correct.
- Followed playlists are stored with `detail_access=restricted`; external URLs must be `https://open.spotify.com/*`.
- `SPOTIFY_CLIENT_ID` / redirect are read from env and fail closed with `spotify_misconfigured` when missing (unit tests set fakes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Resolve global fetch at call time**
- **Found during:** Task 1 verification
- **Issue:** Default client captured `fetch` at module load, so route tests patching `global.fetch` could not drive token exchange.
- **Fix:** `createSpotifyClient` wraps `globalThis.fetch` lazily when no injected fetch is provided.
- **Files modified:** `server/services/spotifyService.js`
- **Verification:** callback OAuth success test green
- **Committed in:** `e7f66e5`

**2. [Rule 2 - Missing critical functionality] Pull `user_spotify_playlists` schema into Task 1 disconnect path**
- **Found during:** Task 1
- **Issue:** T-12-20 / D-12-05 require transactional deletion of normalized personal metadata; Task 2 schema was required for honest disconnect tests.
- **Fix:** Created `user_spotify_playlists` in `db.js` during Task 1 commit; Task 2 greened sync contracts against it.
- **Files modified:** `server/db.js`, `server/services/spotifyService.js`
- **Verification:** disconnect + list isolation tests
- **Committed in:** `e7f66e5` / `04bf425`

**Total deviations:** 2 auto-fixed (Rule 2 ×2). **Impact:** Correctness for disconnect cleanup and testable callback exchange; no scope expansion beyond plan goals.

## Authentication Gates

None — unit tests use fake Client ID / fetch; live Dashboard Client ID remains an open human prerequisite from 12-01.

## Known Stubs

- `GET /api/spotify/playlists/:id` returns non-disclosing 404 for ownership boundary checks only; full detail payload is owned by plan 12-07.
- `searchTracks` / `assertAddBatchSize` enforce limit contracts for later export (12-08) but do not yet mutate Spotify playlists.

## Threat Flags

None beyond the plan register — mitigations for T-12-15..T-12-20 are covered by foundation/list tests (state consume-before-exchange, redaction, fixed redirects, refresh serialization, Retry-After/admission, disconnect cleanup).

## Next

Ready for **12-05** (web Settings linking and provider-separated Library).

## Self-Check: PASSED

- FOUND: `server/services/spotifyService.js`
- FOUND: `server/routes/spotify.js`
- FOUND: `server/.env.example`
- FOUND: `server/db.js`
- FOUND: commits `e7f66e5`, `04bf425`
- FOUND: foundation + list mocha suites exit 0
