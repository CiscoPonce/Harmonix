---
phase: 12-spotify-api-integration
plan: "05"
subsystem: ui
tags: [spotify, oauth, settings, library, nextjs, provider-identity]

requires:
  - phase: 12-spotify-api-integration
    provides: Web Spotify DTO contracts and test:spotify (12-03)
  - phase: 12-spotify-api-integration
    provides: Authenticated status/start/disconnect/playlists Express APIs (12-04)
provides:
  - Web Settings Spotify connection card with Connect/Connected/Reconnect/Disconnect states
  - Validated accounts.spotify.com OAuth navigation and allowlisted callback recovery
  - Provider-separated Library (Harmonix → Spotify → Recent Discoveries) with isolated failures
affects: [12-07, 12-08, 12-09, 12-10]

tech-stack:
  added: []
  patterns:
    - Backend-owned OAuth start with client-side accounts.spotify.com host validation before navigation
    - Independent Harmonix/Spotify/Recent fetch settlement so provider errors never clear local Library
    - Allowlisted ?spotify= callback outcomes only (connected|error); never parse code/state/tokens

key-files:
  created:
    - client/src/app/settings/page.tsx
    - client/src/components/SpotifyConnectionCard.tsx
    - client/public/spotify-logo.svg
  modified:
    - client/src/lib/spotifyContracts.ts
    - client/src/lib/spotifyContracts.test.ts
    - client/src/lib/api.ts
    - client/src/app/playlists/page.tsx

key-decisions:
  - "Success callback lands on /playlists?spotify=connected; error returns to /settings with safe recovery copy"
  - "Disconnect removes provider UI only after DELETE /api/spotify/connection succeeds"
  - "Spotify shelf capped at 20; onward link rendered only from validated API onward_url"
  - "Official Spotify icon mark stored unmodified with source/date provenance for policy review"

patterns-established:
  - "parseSpotifyAuthStartResponse + safeSpotifyAuthorizationUrl guard browser navigation trust boundary"
  - "mapSpotifyListError maps 409/429/offline into UI-SPEC recovery copy without exposing HTTP/secrets"

requirements-completed: [PHASE-12-MVP, D-12-02, D-12-03, D-12-04, D-12-05, D-12-06, D-12-07, D-12-08]

coverage:
  - id: D1
    description: Settings Spotify connection card under profile with full connection state machine
    requirement: D-12-03
    verification:
      - kind: unit
        ref: cd client && npm run test:spotify
        status: pass
      - kind: integration
        ref: cd client && npm run build
        status: pass
    human_judgment: false
  - id: D2
    description: Connect starts via authenticated Express and navigates only to validated accounts.spotify.com
    requirement: D-12-02
    verification:
      - kind: unit
        ref: spotifyContracts.test.ts#safeSpotifyAuthorizationUrl
        status: pass
    human_judgment: false
  - id: D3
    description: Success callback lands in Library; cancellation/error recovers in Settings with allowlisted outcomes
    requirement: D-12-04
    verification:
      - kind: unit
        ref: spotifyContracts.test.ts#parseSpotifyCallbackOutcome
        status: pass
    human_judgment: true
    rationale: "Browser OAuth round-trip and visual Settings/Library landing verified in plan 12-10"
  - id: D4
    description: Provider-separated Library preserves Harmonix when Spotify fails; no Library Connect CTA
    requirement: D-12-06
    verification:
      - kind: unit
        ref: spotifyContracts.test.ts#mapSpotifyListError
        status: pass
      - kind: integration
        ref: cd client && npm run build
        status: pass
    human_judgment: false
  - id: D5
    description: Stable provider IDs and Spotify shelf cap with safe onward URL only
    requirement: D-12-08
    verification:
      - kind: unit
        ref: spotifyContracts.test.ts#capSpotifyPlaylistShelf
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-20
status: complete
---

# Phase 12 Plan 05: Web Settings OAuth → Provider-Separated Library Summary

**Shipped the browser Settings → Spotify OAuth → Library journey: prominent Settings connection card, validated authorize navigation, allowlisted callback recovery, and an honest provider-separated Library that never hides Harmonix when Spotify fails.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-19T23:46:42Z
- **Completed:** 2026-07-19T23:51:37Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Created `/settings` with profile block and `SpotifyConnectionCard` for Connect, Connecting, Connected, Reconnect, Disconnecting, Disconnected, and provider-error states, including destructive disconnect confirmation.
- Wired Connect through `POST /api/spotify/auth/start`, validating `accounts.spotify.com` before `window.location.assign`; disconnect waits for backend acknowledgement before clearing provider UI.
- Rebuilt Library as Harmonix Playlists → Spotify Playlists → Recent Discoveries with independent fetches, scoped skeletons, Settings recovery links (no Library Connect CTA), and a 20-card Spotify shelf.
- Extended dependency-free web contracts (`safeSpotifyAuthorizationUrl`, callback allowlist, status/auth/list parsers, `mapSpotifyListError`) covered by `npm run test:spotify`.

## Task Commits

1. **Task 1 (RED):** `b1b9d44` — `test(12-05): add failing web Settings/Library Spotify contracts`
2. **Task 1 (GREEN):** `b60c41e` — `feat(12-05): build web Settings Spotify connection journey`
3. **Task 2 (RED):** `267baac` — `test(12-05): add failing Library Spotify error-mapping contracts`
4. **Task 2 (GREEN):** `5f5bd6b` — `feat(12-05): render provider-separated Library with independent Spotify load`

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `client/src/app/settings/page.tsx` — Settings destination; profile + Spotify card + appearance + logout
- `client/src/components/SpotifyConnectionCard.tsx` — Settings-owned connection state machine UI
- `client/public/spotify-logo.svg` — Official unmodified Spotify icon mark (source/date in file comment)
- `client/src/lib/spotifyContracts.ts` — Auth URL validation, callback allowlist, list/error helpers
- `client/src/lib/spotifyContracts.test.ts` — Node 24 contract coverage for 12-05 surfaces
- `client/src/lib/api.ts` — `fetchSpotifyStatus`, `startSpotifyAuth`, `disconnectSpotify`, `fetchSpotifyPlaylists`
- `client/src/app/playlists/page.tsx` — Provider-separated Library consumer

## Decisions Made

- Fixed return contract matches backend tests: success → `/playlists?spotify=connected`, error → `/settings?spotify=error`.
- Onward “Open more playlists in Spotify” renders only when API provides a validated `onward_url` and the shelf was capped; no client-invented Spotify URLs.
- Spotify playlist card hrefs use `/playlists/spotify/{encoded provider_id}` for plan 12-07 detail; Harmonix keeps `/playlists/{id}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Defer setState-in-effect for React Compiler lint**
- **Found during:** Task 1 verification
- **Issue:** New Settings page tripped `react-hooks/set-state-in-effect` on status load and callback handling.
- **Fix:** Derive error recovery from allowlisted search params; defer status fetch via `setTimeout(0)` so mutations are not synchronous in the effect body.
- **Files modified:** `client/src/app/settings/page.tsx`
- **Committed in:** `b60c41e`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Lint-safe fetch pattern only; no scope creep.

## Issues Encountered

- Project-wide `npm run lint` still reports pre-existing errors in unrelated files (`WatchDailyWord`, `ThemeToggle`, etc.). New 12-05 files lint clean via targeted eslint; production `npm run build` is green.

## User Setup Required

None for this plan — OAuth env URLs remain the 12-01/12-04 deployment configuration (`SPOTIFY_WEB_SUCCESS_URL` / `SPOTIFY_WEB_ERROR_URL`).

## Next Phase Readiness

- Web linking + Library list ready for 12-07 Spotify playlist detail and 12-08/12-09 export.
- Flutter Settings/Library implementation remains on later plans (12-06+).
- Plan 12-10 should UAT real browser callback, focus, and responsive layout.

## Threat Flags

None — authorization navigation validates `accounts.spotify.com`; clients consume only safe status/DTO fields; disconnect clears UI after backend acknowledgement; provider URLs go through `safeSpotifyUrl` / `safeSpotifyAuthorizationUrl`.

## Known Stubs

None that block plan goals. Spotify playlist detail route (`/playlists/spotify/[id]`) is intentionally owned by plan 12-07; cards link there for stable identity.

## Self-Check: PASSED

- Created files present: settings page, SpotifyConnectionCard, spotify-logo.svg, playlists page, contracts, api helpers, SUMMARY
- Commits present: b1b9d44, b60c41e, 267baac, 5f5bd6b

---
*Phase: 12-spotify-api-integration*
*Completed: 2026-07-20*
