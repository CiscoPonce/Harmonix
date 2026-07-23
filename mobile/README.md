# Harmonix Flutter (Android)

Native Android client for Harmonix. Consumes the same Express `/api/*` as the web app.

**Nav:** Discover · Library · Settings (Learn folded into Discover)  
**API (production):** https://harmonix.peeporunclub.co.uk/api  
**Roadmap:** Android Play Store · [`.planning/ROADMAP.md`](../.planning/ROADMAP.md)

## Setup

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```

## Build debug APK

```bash
flutter build apk --debug \
  --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```

## Build Play Store release (AAB)

See **[PLAY-STORE.md](PLAY-STORE.md)** for keystore setup, Data safety answers, and Console checklist.

```bash
# Requires android/key.properties + upload-keystore.jks
flutter build appbundle --release --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```

## QA checklist

- [ ] Register / login / session restore after kill
- [ ] Onboarding: languages, genre, difficulty → prefs saved
- [ ] Language / genre switch clears stale queue (no wrong-language WOTD)
- [ ] Discover: Word of the Day, definition, IPA, lyric highlight, Play preview, Share, Next word
- [ ] Speaker uses Pocket-TTS `/daily-word/pronounce` (fallback device TTS only on failure)
- [ ] Queue badge updates (`N ready`)
- [ ] Discover search returns tracks; tap opens player
- [ ] Library: create playlist; open playlist detail; Spotify section when connected
- [ ] Settings: stats, badges, languages, Spotify Connect, logout
- [ ] Spotify: OAuth via external browser + deep link return
- [ ] Playback: Deezer 30s preview + Open in Spotify (no in-app Spotify SDK on Android)
- [ ] Offline / API error shows retry (not hang)

## Design

Light + dark green (`#006432`) — team WOTD mockup + `.planning/phases/10-mobile-dual-frontend/10-UI-SPEC.md`.
Align with web forest tokens where practical; web is source of truth for Discover · Library · Settings IA.
