---
phase: 12-spotify-api-integration
plan: "07"
subsystem: ui
tags: [spotify, playlist-detail, restricted, web, flutter, express]

requires:
  - phase: 12-spotify-api-integration
    provides: user_spotify_playlists ownership and freshness contract (12-04)
  - phase: 12-spotify-api-integration
    provides: Web Library provider-aware Spotify cards linking to /playlists/spotify/:id (12-05)
  - phase: 12-spotify-api-integration
    provides: Android Library Spotify shelf with provider IDs (12-06)
provides:
  - GET /api/spotify/playlists/:id normal and restricted detail with /items pagination
  - Web provider route /playlists/[provider]/[id] with safe Open in Spotify
  - Flutter PlaylistDetailScreen provider-aware Spotify detail parity
affects: [12-08, 12-09, 12-10]

tech-stack:
  added: []
  patterns:
    - Restricted detail requires user-scoped user_spotify_playlists row with expiry revalidation via /me/playlists sync
    - Spotify items via GET /playlists/{id}/items only; 403 maps to detail_state=restricted without fake empty lists
    - Open in Spotify only from API-provided HTTPS open.spotify.com URLs after client validation

key-files:
  created:
    - client/src/app/playlists/[provider]/[id]/page.tsx
  modified:
    - server/services/spotifyService.js
    - server/routes/spotify.js
    - server/services/spotifyPlaylistDetail.test.js
    - server/routes/spotifyPlaylistDetail.test.js
    - server/package.json
    - client/src/lib/spotifyContracts.ts
    - client/src/lib/api.ts
    - mobile/lib/services/api_client.dart
    - mobile/lib/screens/library_screen.dart
    - mobile/lib/screens/playlist_detail_screen.dart
    - mobile/lib/spotify/spotify_contracts.dart
    - mobile/test/spotify_playlist_detail_test.dart

key-decisions:
  - "Restricted metadata from cache is trusted only when expires_at is future; stale rows trigger full syncUserPlaylists before use"
  - "Invalid Spotify IDs and not_found both return non-disclosing 404 from the route"
  - "PlaylistDetailScreen requires provider + providerId; previewDetail supports widget tests without network"

patterns-established:
  - "detail_state + restricted flag shared across Express, web contracts, and Flutter parsers"
  - "20-item display cap with Open in Spotify as the only continuation"
  - "Harmonix local playlist IDs hitting /api/spotify/playlists/:id return 404 namespace guard"

requirements-completed: [PHASE-12-MVP, D-12-06, D-12-08, D-12-09, D-12-10, D-12-15]

coverage:
  - id: D1
    description: Backend returns normal/restricted detail with /items, freshness revalidation, and cross-user non-disclosure
    requirement: D-12-09
    verification:
      - kind: unit
        ref: cd server && NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= npx mocha services/spotifyPlaylistDetail.test.js routes/spotifyPlaylistDetail.test.js
        status: pass
    human_judgment: false
  - id: D2
    description: Web provider-aware Spotify detail with restricted explanation and validated Open in Spotify
    requirement: D-12-09
    verification:
      - kind: unit
        ref: cd client && npm run test:spotify && npm run build
        status: pass
    human_judgment: false
  - id: D3
    description: Flutter provider-aware detail with equal-raw-ID isolation and restricted followed playlists
    requirement: D-12-08
    verification:
      - kind: unit
        ref: cd mobile && flutter test test/spotify_playlist_detail_test.dart && flutter analyze
        status: pass
    human_judgment: false
  - id: D4
    description: Browser/device policy verification of deep links and App Links
    requirement: D-12-10
    verification: []
    human_judgment: true
    rationale: "Physical/browser policy verification deferred to plan 12-10"

duration: 6min
completed: 2026-07-20
status: complete
---

# Phase 12 Plan 07: Spotify Playlist Detail Summary

**In-app Spotify playlist detail on web and Android with owner/collaborator item access, restricted followed handling, and safe Open in Spotify deep links.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-20T00:00:15Z
- **Completed:** 2026-07-20T00:06:04Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Express `getPlaylistDetail` loads metadata, calls `/playlists/{id}/items`, maps 403 to restricted detail with complete header metadata, and revalidates stale `user_spotify_playlists` rows before use.
- Web route `/playlists/spotify/:id` rejects non-Spotify providers, renders normal/empty/restricted/recovery states, caps rows at 20, and only exposes validated API external URLs.
- Flutter `PlaylistDetailScreen` requires provider + providerId; Library navigates in-app for Spotify; restricted followed playlists show explanation rather than a fake empty list.

## Task Commits

1. **Task 1: Implement complete normal and restricted detail API** - `13be00a` (feat)
2. **Task 2: Render provider-aware Spotify detail on web** - `c50f818` (feat)
3. **Task 3: Extend provider-aware detail to Flutter Android** - `31c7252` (feat)

**Plan metadata:** skipped (commit_docs disabled)

## Files Created/Modified

- `server/services/spotifyService.js` - `getPlaylistDetail` / `getPlaylistItems` with freshness and restriction mapping
- `server/routes/spotify.js` - `GET /playlists/:id` detail handler + local ID namespace guard
- `server/services/spotifyPlaylistDetail.test.js` / `server/routes/spotifyPlaylistDetail.test.js` - green behavioral contracts
- `server/package.json` - detail tests removed from controlled-RED ignore list
- `client/src/app/playlists/[provider]/[id]/page.tsx` - provider-aware web detail UI
- `client/src/lib/spotifyContracts.ts` / `api.ts` - detail DTO parsing and fetch helper
- `mobile/lib/screens/playlist_detail_screen.dart` - provider-aware Harmonix/Spotify detail
- `mobile/lib/screens/library_screen.dart` - in-app Spotify navigation
- `mobile/lib/services/api_client.dart` / `spotify/spotify_contracts.dart` - detail API + parsers
- `mobile/test/spotify_playlist_detail_test.dart` - widget/contract coverage

## Decisions Made

- Stale restricted cache never serves fields on revalidation failure; sync errors surface as provider/unavailable states.
- Route maps `invalid_request` playlist IDs to non-disclosing 404 to match foundation ownership tests.
- Flutter tests inject `previewDetail` so UI contracts are verified without network while production uses `spotifyPlaylistDetail`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved local playlist namespace guard on Spotify detail route**
- **Found during:** Task 1
- **Issue:** After wiring real detail, Harmonix local IDs (e.g. cross-user `owned-by-b`) hit Spotify token checks and returned 409 instead of non-disclosing 404.
- **Fix:** Reintroduced `playlists` table ID namespace guard before calling `getPlaylistDetail`.
- **Files modified:** `server/routes/spotify.js`
- **Verification:** `routes/spotify.test.js` cross-user local access case passes
- **Committed in:** `13be00a`

**2. [Rule 2 - Missing critical functionality] Full-repo `npm run lint` still fails on pre-existing unrelated errors**
- **Found during:** Task 2 verification
- **Issue:** Plan verify lists `npm run lint`; repo-wide eslint reports pre-existing errors outside this plan’s files.
- **Fix:** Verified new/changed client files with scoped eslint (exit 0); full lint not “fixed” (out of scope).
- **Files modified:** none beyond plan files
- **Verification:** `npx eslint` on Task 2 paths exit 0; `npm run build` pass
- **Committed in:** `c50f818`

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 documented verification scope)
**Impact on plan:** Required for correct namespace isolation; lint scope note does not block detail delivery.

## Issues Encountered

None blocking. Flutter ListView lazy-build required scrolling assertions for the 20-item cap widget test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Browse journey complete for Spotify cards → in-app detail on web and Android.
- Ready for 12-08 validation-first matching and web export report.
- Browser/device deep-link policy checks remain for 12-10.

## Self-Check: PASSED

- FOUND: `client/src/app/playlists/[provider]/[id]/page.tsx`
- FOUND: `server/services/spotifyService.js` (`getPlaylistDetail`)
- FOUND: `mobile/lib/screens/playlist_detail_screen.dart`
- FOUND: commits `13be00a`, `c50f818`, `31c7252`

---
*Phase: 12-spotify-api-integration*
*Completed: 2026-07-20*
