# Harmonix Flutter (Android)

Native Android client for Harmonix. Consumes the same Express `/api/*` as the web app.

**Roadmap:** Android Play Store first → production domain live → iOS / App Store.

## Setup

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE=https://moral-sparrow-nationally.ngrok-free.app/api
```

When your domain is live:

```bash
flutter run --dart-define=API_BASE=https://YOUR_DOMAIN/api
```

## Build debug APK

```bash
flutter build apk --debug \
  --dart-define=API_BASE=https://moral-sparrow-nationally.ngrok-free.app/api
```

## Build Play Store release (AAB)

See **[PLAY-STORE.md](PLAY-STORE.md)** for keystore setup, Data safety answers, and Console checklist.

```bash
# Requires android/key.properties + upload-keystore.jks
flutter build appbundle --release --dart-define=API_BASE=https://YOUR_DOMAIN/api
```

## QA checklist

- [ ] Register / login / session restore after kill
- [ ] Onboarding: 6 languages, genre, difficulty → prefs saved
- [ ] Language switch clears stale queue (no wrong-language WOTD)
- [ ] Learn: hero word, definition, IPA, lyric highlight, Play preview, Share, Next word
- [ ] Speaker uses Pocket-TTS `/daily-word/pronounce` (fallback device TTS only on failure)
- [ ] Queue badge updates (`N ready`)
- [ ] Discover search returns tracks; tap opens player
- [ ] Library: create playlist; open playlist detail
- [ ] Settings: stats, badges, edit prefs, logout
- [ ] Offline / API error shows retry (not hang)

## Design

Light + dark green (`#006432`) — team WOTD mockup + `.planning/phases/10-mobile-dual-frontend/10-UI-SPEC.md`.
