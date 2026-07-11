# Harmonix Flutter (Android)

Native Android client for Harmonix. Consumes the same Express `/api/*` as the web app.

## Setup

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE=https://moral-sparrow-nationally.ngrok-free.app/api
```

Override API at build time with `--dart-define=API_BASE=...`.

## Build debug APK

```bash
flutter build apk --debug \
  --dart-define=API_BASE=https://moral-sparrow-nationally.ngrok-free.app/api
```

Output: `build/app/outputs/flutter-apk/app-debug.apk`

## QA checklist

- [ ] Register / login / session restore after kill
- [ ] Onboarding: 6 languages, genre, difficulty → prefs saved
- [ ] Language switch clears stale queue (no wrong-language WOTD)
- [ ] Learn: hero word, lyric highlight, Play preview, Share, Next word
- [ ] Queue badge updates (`N ready`)
- [ ] Discover search returns tracks
- [ ] Library: create playlist + recent words
- [ ] Settings: stats, badges, edit prefs, logout
- [ ] Offline / API error shows retry (not hang)

## Design

Light + dark green (`#006432`) — see `.planning/phases/10-mobile-dual-frontend/10-UI-SPEC.md`.
