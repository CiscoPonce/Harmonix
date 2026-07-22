---
phase: 12-spotify-api-integration
plan: "02"
subsystem: testing
tags: [spotify, oauth, pkce, aes-gcm, sqlite, mocha, controlled-red]

requires:
  - phase: 12-spotify-api-integration
    provides: Fixed HTTPS callback, encryption key custody, match-cache policy (12-01)
provides:
  - Green OAuth state + AES-256-GCM crypto primitives with adversarial unit tests
  - Idempotent spotify_oauth_transactions and user_spotify_tokens schema
  - Controlled-RED foundation/list/detail/export contracts with assert-red-contracts runner
  - Node 24 better-sqlite3 ABI baseline proven via npm test
affects: [12-03, 12-04, 12-07, 12-08]

tech-stack:
  added: []
  patterns:
    - one-time hashed OAuth state with S256 PKCE
    - versioned AES-256-GCM token envelopes (no key fallback)
    - controlled RED via sentinel + non-zero mocha exit

key-files:
  created:
    - server/services/spotifyCrypto.js
    - server/services/spotifyOAuthService.js
    - server/services/spotifyCrypto.test.js
    - server/services/spotifyOAuthService.test.js
    - server/services/spotifyService.test.js
    - server/routes/spotify.test.js
    - server/services/spotifyPlaylistList.test.js
    - server/routes/spotifyPlaylistList.test.js
    - server/services/spotifyPlaylistDetail.test.js
    - server/routes/spotifyPlaylistDetail.test.js
    - server/services/spotifyExportService.test.js
    - server/routes/spotifyExport.test.js
    - server/scripts/assert-red-contracts.js
  modified:
    - server/db.js
    - server/package.json

key-decisions:
  - "OAuth state stored as SHA-256 hex only; plaintext state returned once from createOAuthTransaction"
  - "Client kinds limited to web|android with fixed env destinations; caller returnUrl rejected"
  - "Controlled-RED Spotify slice tests excluded from npm test until owning implementation plans"
  - "ABI repair via npm rebuild better-sqlite3 on Node 24.13.0 — no dependency version change"

patterns-established:
  - "Lazy-require missing Spotify modules inside RED tests so assert-red rejects only true loader failures"
  - "SPOTIFY_TOKEN_ENCRYPTION_KEY must be 32-byte base64; missing/malformed fails closed"

requirements-completed: [PHASE-12-MVP, D-12-01, D-12-05, D-12-11]

coverage:
  - id: D1
    description: better-sqlite3 loads under Node 24 and pre-Spotify npm test completes
    requirement: PHASE-12-MVP
    verification:
      - kind: integration
        ref: cd server && npm rebuild better-sqlite3 && npm test
        status: pass
    human_judgment: false
  - id: D2
    description: PKCE/state consume-once and AES-GCM encrypt/decrypt primitives green
    requirement: D-12-01
    verification:
      - kind: unit
        ref: npx mocha services/spotifyCrypto.test.js services/spotifyOAuthService.test.js
        status: pass
    human_judgment: false
  - id: D3
    description: Token ciphertext never stores plaintext sentinels; no encryption key fallback
    requirement: D-12-11
    verification:
      - kind: unit
        ref: services/spotifyCrypto.test.js#never persists plaintext token sentinels
        status: pass
    human_judgment: false
  - id: D4
    description: Foundation/list/detail/export controlled RED groups fail only for named missing behavior
    requirement: D-12-05
    verification:
      - kind: unit
        ref: node scripts/assert-red-contracts.js … --sentinel NOT_IMPLEMENTED_SPOTIFY_*
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-20
status: complete
---

# Phase 12 Plan 02: Wave 0 Security Foundation Summary

**Repaired the Node 24 SQLite ABI, shipped green OAuth/crypto primitives, and locked controlled-RED contracts for the Spotify MVP journey slices.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T23:26:40Z
- **Completed:** 2026-07-19T23:33:00Z
- **Tasks:** 3/3
- **Files modified:** 15

## Accomplishments

- Rebuilt `better-sqlite3` for Node v24.13.0 (`npm rebuild better-sqlite3`); `require('./db')` and full `npm test` complete under the active ABI.
- Implemented D-12-01 / D-12-11 storage primitives: hashed one-time OAuth transactions, S256 PKCE, AES-256-GCM envelopes with unique IVs, external versioned key, no fallback.
- Established independently proven controlled-RED groups for foundation routes, playlist list, detail, and export with `assert-red-contracts.js` sentinels.

## Task Commits

1. **Task 1: Repair SQLite ABI / prove baseline** — no tracked commit (native rebuild only; verified by `npm rebuild` + `npm test`)
2. **Task 2 (RED):** `d9aa3ae` — `test(12-02): add failing OAuth and AES-GCM contracts`
3. **Task 2 (GREEN):** `418062d` — `feat(12-02): implement OAuth state and AES-GCM token primitives`
4. **Task 3:** `02d34aa` — `test(12-02): establish controlled-RED Spotify MVP journey contracts`

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `server/services/spotifyCrypto.js` — `loadEncryptionKey`, `encryptToken`, `decryptToken`
- `server/services/spotifyOAuthService.js` — `generatePkce`, `createOAuthTransaction`, `consumeOAuthTransaction`, `invalidateOAuthTransactionsForUser`, `resolveReturnUrl`
- `server/db.js` — idempotent `spotify_oauth_transactions` and `user_spotify_tokens` tables + indexes
- `server/services/spotifyCrypto.test.js`, `spotifyOAuthService.test.js` — green adversarial unit suites
- `server/services/spotifyService.test.js`, `routes/spotify.test.js` — foundation RED
- `server/services/spotifyPlaylistList.test.js`, `routes/spotifyPlaylistList.test.js` — list RED
- `server/services/spotifyPlaylistDetail.test.js`, `routes/spotifyPlaylistDetail.test.js` — detail RED
- `server/services/spotifyExportService.test.js`, `routes/spotifyExport.test.js` — export RED
- `server/scripts/assert-red-contracts.js` — controlled RED runner
- `server/package.json` — exclude Wave-0 RED files from normal `npm test`

## Decisions Made

- Exclude foundation/list/detail/export (and future match) RED files from `npm test` so the baseline stays green until 12-04 / 12-07 / 12-08 promote them.
- OAuth TTL default 600s; tests inject `now` / `ttlSeconds` for expiry cases.
- Encryption key version required via `SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION` (v1 from 12-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Exclude controlled-RED files from `npm test`**
- **Found during:** Task 3
- **Issue:** Mocha globs would execute deliberately failing RED contracts and break the backend baseline.
- **Fix:** Added `--ignore` entries for Spotify RED (and future match) test files in `server/package.json`.
- **Files modified:** `server/package.json`
- **Verification:** `npm test` exit 0 after Task 3
- **Committed in:** `02d34aa`

## TDD Gate Compliance

- RED commit present: `d9aa3ae` (`test(12-02): …`)
- GREEN commit present: `418062d` (`feat(12-02): …`)
- Task 3 is controlled-RED only (no GREEN implementation by design)

## Known Stubs

None that block this plan's goal. Production `spotifyService.js` / `routes/spotify.js` / export modules intentionally absent until 12-04+; RED contracts assert `NOT_IMPLEMENTED_SPOTIFY_*` sentinels.

## Threat Flags

None beyond the plan threat model — no new network endpoints shipped in this plan.

## Self-Check: PASSED

- All listed key files present on disk
- Commits `d9aa3ae`, `418062d`, `02d34aa` present in git log
- Schema markers present in `server/db.js`
