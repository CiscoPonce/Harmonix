# Harmonix Android releases

| File / build | Type | Notes |
|--------------|------|-------|
| **[Harmonix-1.0.8.apk](./Harmonix-1.0.8.apk)** | Flutter **release** (signed) | **Current** — production API, one-song-per-card, Play listing build `1.0.8+11` |
| [Harmonix-flutter-debug.apk](./Harmonix-flutter-debug.apk) | Older Flutter debug | Sideload only; superseded |
| [Harmonix-debug.apk](./Harmonix-debug.apk) | Capacitor (not shipped) | WebView wrapper — do not give testers |

Download (recommended):  
**https://github.com/CiscoPonce/Harmonix/releases/tag/harmonix-v0.0.3**

Play upload is the **AAB**, not this APK: `mobile/build/app/outputs/bundle/release/app-release.aab` (local, not in git).

## Install on Android

1. Download `Harmonix-1.0.8.apk` from the release page (or this folder).
2. Enable **Install unknown apps** for your file manager or browser.
3. Open the APK and install.

Requires internet. API: `https://harmonix.peeporunclub.co.uk/api`.

## Build

```bash
export JAVA_HOME="$HOME/.local/jdk/jdk-17"
export PATH="$JAVA_HOME/bin:$HOME/flutter/bin:$PATH"
cd mobile
flutter build apk --release \
  --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
cp build/app/outputs/flutter-apk/app-release.apk ../releases/Harmonix-1.0.8.apk
```

### Play Store AAB

See [mobile/PLAY-STORE.md](../mobile/PLAY-STORE.md). Application ID: `com.harmonix.app`.
