# Harmonix Android releases

| File / build | Type | Notes |
|--------------|------|-------|
| **[Harmonix-001](https://github.com/CiscoPonce/Harmonix/releases/tag/v1.0.1-android)** | Flutter debug APK | **Current** — dark mode, Pocket-TTS pronounce, language filters, Play Store prep |
| [Harmonix-flutter-debug.apk](./Harmonix-flutter-debug.apk) | Older Flutter debug | Superseded by Harmonix-001 |
| [Harmonix-debug.apk](./Harmonix-debug.apk) | Capacitor (Option B) | WebView wrapper |

Download the latest APK from the GitHub Release (recommended):  
**https://github.com/CiscoPonce/Harmonix/releases/tag/v1.0.1-android**

## Install on Android

1. Download `Harmonix-001.apk` from the release page (or copy from this folder if present locally).
2. Enable **Install unknown apps** for your file manager or browser.
3. Open the APK and install.

Requires internet. API default for new builds: `https://harmonix.peeporunclub.co.uk/api`.

## Build Flutter (Option C)

```bash
cd mobile
export PATH="$HOME/flutter/bin:$PATH"
flutter build apk --debug \
  --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```

Copy output to `releases/Harmonix-001.apk` (or bump the name for the next build).

### Play Store release AAB

See [mobile/PLAY-STORE.md](../mobile/PLAY-STORE.md). Application ID: `com.harmonix.app`.
