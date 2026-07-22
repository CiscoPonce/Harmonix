# Phase 12 — Deferred Items

## Found during 12-03

### Pre-existing `npm run lint` failures (out of scope)

`cd client && npm run lint` exits non-zero due to errors in files untouched by Phase 12 Spotify work:

- `client/src/app/playlists/page.tsx` — `react-hooks/set-state-in-effect`
- `client/src/components/BadgeUnlockToast.tsx` — `react-hooks/set-state-in-effect`
- `client/src/components/DailyWordCard.tsx` — `react-hooks/set-state-in-effect`
- `client/src/components/SongSearch.tsx` — `react-hooks/set-state-in-effect` + `react/no-unescaped-entities`
- `client/src/components/ThemeToggle.tsx` — `react-hooks/set-state-in-effect`
- `client/src/components/watch/WatchDailyWord.tsx` — `react-hooks/set-state-in-effect`
- Capacitor `android/.../native-bridge.js` warnings under lint root

**Verification substitute:** `npx eslint` on Spotify contract/component paths (pass) and `npm run build` (pass). Full lint cleanup is deferred to a dedicated chore.

## Found during 12-10

### Full `npm test` Daily Word / Pocket-TTS failures (out of scope)

`NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=… npm test` reported **261 passing, 8 failing** on 2026-07-20. Failures are entirely outside Spotify:

- `services/dailyWordService.test.js` — multiple 2000ms timeouts; one assertion `expected undefined to equal 'Spanish'`
- `routes/dailyWord.test.js` — Pocket-TTS cache-hit timeout; daemon log: `ModuleNotFoundError: No module named 'uvicorn'`
- Ambient noise: NVIDIA NIM 429 and Deezer `deezer_not_found` during daily-word batch retries

**Spotify substitute:** focused Mocha Spotify suite — **69 passing**, exit 0. Tracked in `12-VALIDATION.md`. Do not claim `nyquist_compliant: true` until full suite is green.

### Flutter analyze info (out of scope)

`flutter analyze` exits non-zero on one **info** in `mobile/lib/screens/learn_screen.dart` (`use_build_context_synchronously`). Not Spotify-related.

**Substitute:** `flutter analyze --no-fatal-infos` (exit 0) + full `flutter test` (exit 0).
