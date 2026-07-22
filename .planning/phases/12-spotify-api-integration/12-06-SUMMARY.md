---
phase: 12-spotify-api-integration
plan: "06"
subsystem: ui
tags: [spotify, oauth, android, flutter, app-links, settings, library]

requires:
  - phase: 12-spotify-api-integration
    provides: Fixed Android success/error App Link URLs on ngrok host (12-01)
  - phase: 12-spotify-api-integration
    provides: Authenticated status/start/disconnect/playlists Express APIs (12-04)
  - phase: 12-spotify-api-integration
    provides: Web Settings/Library journey parity reference (12-05)
provides:
  - Android HomeNavigationController with one-shot Library/Settings App Link routing
  - Settings SpotifyConnectionCard with Connect/Connected/Reconnect/Disconnect lifecycle
  - Provider-separated Flutter Library with isolated Spotify failure recovery
affects: [12-07, 12-09, 12-10]

tech-stack:
  added: [app_links, flutter_svg]
  patterns:
    - Verified HTTPS App Links only on approved ngrok host/paths; secret query params ignored
    - Backend-owned OAuth start with accounts.spotify.com host validation before url_launcher
    - Independent Harmonix/Spotify/Recent settlement so provider errors never clear local Library

key-files:
  created:
    - mobile/lib/state/home_navigation_controller.dart
    - mobile/lib/widgets/spotify_connection_card.dart
    - mobile/lib/widgets/spotify_library_list.dart
    - mobile/lib/spotify/spotify_contracts.dart
    - mobile/assets/spotify-logo.svg
    - client/public/.well-known/assetlinks.json
  modified:
    - mobile/lib/main.dart
    - mobile/lib/screens/home_shell.dart
    - mobile/lib/screens/settings_screen.dart
    - mobile/lib/screens/library_screen.dart
    - mobile/lib/services/api_client.dart
    - mobile/android/app/src/main/AndroidManifest.xml
    - mobile/pubspec.yaml
    - mobile/test/spotify_deep_link_test.dart
    - mobile/test/spotify_settings_test.dart
    - mobile/test/spotify_library_list_test.dart

key-decisions:
  - "Development-only App Links on moral-sparrow-nationally.ngrok-free.app; release association blocked until production domain + release cert"
  - "assetlinks.json uses debug keystore SHA-256 for sandbox verification"
  - "Spotify playlist taps open safe external URL until 12-07 in-app detail"
  - "Provider credentials never written to FlutterSecureStorage"

patterns-established:
  - "HomeNavigationController.selectLibraryOnce / selectSettingsOnce for one-shot cold/warm routing"
  - "ApiClient.spotifyAuthStart(client: android) + safeSpotifyAuthorizationUrl before launchUrl"
  - "Library Open Settings recovery only — never primary Connect CTA in Library"

requirements-completed: [PHASE-12-MVP, D-12-02, D-12-03, D-12-04, D-12-05, D-12-06, D-12-07, D-12-08, D-12-10, D-12-15]

coverage:
  - id: D1
    description: Verified App Link success selects Library once; error selects Settings once; ordinary Learn default
    requirement: D-12-04
    verification:
      - kind: unit
        ref: cd mobile && flutter test test/spotify_deep_link_test.dart
        status: pass
    human_judgment: true
    rationale: "Physical/emulated signed App Link round-trip validated in plan 12-10"
  - id: D2
    description: Settings Spotify connection card under profile with full connection state machine
    requirement: D-12-03
    verification:
      - kind: unit
        ref: cd mobile && flutter test test/spotify_settings_test.dart
        status: pass
    human_judgment: false
  - id: D3
    description: Auth launch and disconnect use authenticated backend methods; no provider tokens in secure storage
    requirement: D-12-05
    verification:
      - kind: unit
        ref: spotify_settings_test.dart#auth start and disconnect
        status: pass
    human_judgment: false
  - id: D4
    description: Provider-separated Library preserves Harmonix when Spotify fails; no Library Connect CTA
    requirement: D-12-06
    verification:
      - kind: unit
        ref: cd mobile && flutter test test/spotify_library_list_test.dart
        status: pass
    human_judgment: false
  - id: D5
    description: Spotify shelf capped at 20 with API-provided onward link only
    requirement: D-12-08
    verification:
      - kind: unit
        ref: spotify_library_list_test.dart#caps Spotify cards at 20
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-07-20
status: complete
---

# Phase 12 Plan 06: Android Settings OAuth → App Link → Library Parity Summary

**Shipped native Android parity for the Settings → system-browser OAuth → verified App Link → provider-separated Library journey, with backend-owned tokens and one-shot cold/warm Library selection.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-19T23:52:31Z
- **Completed:** 2026-07-19T23:59:15Z
- **Tasks:** 3/3
- **Files modified:** 16

## Accomplishments

- Added `HomeNavigationController` and `app_links` wiring so approved HTTPS success App Links select Library once and cancellation/error App Links select Settings once; ordinary launches stay on Learn.
- Configured Android `autoVerify` intent filters for `/app/library` and `/app/settings` on the 12-01 ngrok host, plus `assetlinks.json` with package `com.harmonix.app` and the debug SHA-256 fingerprint (release association blocked).
- Built Settings `SpotifyConnectionCard` under profile with Connect/Connected/Reconnect/Disconnect, destructive confirmation, and `url_launcher` OAuth to validated `accounts.spotify.com` URLs only.
- Refactored Library into Harmonix → Spotify → Recent Discoveries with independent loads, scoped skeletons, Open Settings recovery (no primary Connect), 20-card cap, and rate-limit refresh gating.

## Task Commits

1. **Task 1:** `8ece06a` — `feat(12-06): wire verified Android App Link outcomes to tab navigation`
2. **Task 2:** `1639798` — `feat(12-06): build Android Settings Spotify connection card`
3. **Task 3:** `881df9f` — `feat(12-06): render Android Library Spotify parity with isolated recovery`

**Plan metadata:** skipped (`commit_docs: false`)

## Files Created/Modified

- `mobile/lib/state/home_navigation_controller.dart` — One-shot Library/Settings App Link routing
- `mobile/lib/main.dart` — Provider + cold/warm `app_links` binding
- `mobile/lib/screens/home_shell.dart` — Controller-driven four-tab shell
- `mobile/android/app/src/main/AndroidManifest.xml` — Verified VIEW/BROWSABLE filters
- `client/public/.well-known/assetlinks.json` — Debug Digital Asset Links statement
- `mobile/lib/widgets/spotify_connection_card.dart` — Settings connection UI
- `mobile/lib/screens/settings_screen.dart` — Card placement + OAuth/disconnect lifecycle
- `mobile/lib/widgets/spotify_library_list.dart` — Provider-separated Library list
- `mobile/lib/screens/library_screen.dart` — Independent Spotify/Harmonix/Recent loads
- `mobile/lib/services/api_client.dart` — `spotifyStatus` / `spotifyAuthStart` / `disconnectSpotify` / `spotifyPlaylists`
- `mobile/lib/spotify/spotify_contracts.dart` — URL allowlists and list/error mappers
- `mobile/assets/spotify-logo.svg` — Official unmodified Spotify mark
- `mobile/test/spotify_*.dart` — Deep link, Settings, and Library widget contracts

## Decisions Made

- Development-only App Link host matches 12-01; production custom-domain association remains a 12-10/12-11 release gate.
- Spotify card taps open safe `open.spotify.com` URLs until plan 12-07 delivers in-app detail.
- Onward “Open more playlists in Spotify” renders only when the API provides a validated `onward_url` and the shelf was capped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Avoid notifyListeners during HomeShell build**
- **Found during:** Task 1
- **Issue:** Constructor OAuth override called `selectLibraryOnce` from `didChangeDependencies`, triggering setState-during-build.
- **Fix:** Apply constructor overrides in a post-frame callback.
- **Files modified:** `mobile/lib/screens/home_shell.dart`
- **Commit:** `8ece06a`

**2. [Rule 2 - Missing critical functionality] Parse Spotify `retry_after` for 429 UX**
- **Found during:** Task 3
- **Issue:** ApiClient only read `retryAfterSec`, but Spotify routes return `retry_after`.
- **Fix:** Accept both fields so Library rate-limit countdown/refresh gating works.
- **Files modified:** `mobile/lib/services/api_client.dart`
- **Commit:** `881df9f`

## Issues Encountered

None beyond the auto-fixes above. Controlled-RED `spotify_playlist_detail_test.dart` and `spotify_export_test.dart` remain excluded until 12-07/12-09.

## User Setup Required

None beyond existing 12-01 Spotify Dashboard Client ID / redirect URI registration. Physical App Link verification is deferred to plan 12-10.

## Next Phase Readiness

- Ready for 12-07 provider-aware playlist detail on web and Android.
- Android export/resilience (12-09) and release App Link matrix (12-10) can consume this navigation and Library shell.

## TDD Gate Compliance

Controlled-RED sentinel tests from earlier Wave 0 were expanded and turned green in this plan’s feat commits (pre-existing RED baseline from 12-03). Separate RED-only commits were not recreated for each task because the failing contracts already existed on disk.

## Self-Check: PASSED

- Created files verified present
- Commits `8ece06a`, `1639798`, `881df9f` verified in git log
- SUMMARY written; STATE/ROADMAP progress updated; docs commit skipped (`commit_docs: false`)

---
*Phase: 12-spotify-api-integration*
*Completed: 2026-07-20*
