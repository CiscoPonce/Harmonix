# Harmonix Android releases

| File | Type | Notes |
|------|------|-------|
| [Harmonix-debug.apk](./Harmonix-debug.apk) | Debug APK | Capacitor wrapper (Option B). Loads live app via ngrok. |
| [Harmonix-flutter-debug.apk](./Harmonix-flutter-debug.apk) | Release APK (unsigned debug-named) | Flutter native (Option C). Light + dark-green Learn UI. |

Also attached to each [GitHub Release](https://github.com/CiscoPonce/Harmonix/releases) (v0.0.1+).

## Install on Android

1. Transfer the APK to the device (Flutter and Capacitor can coexist for A/B).
2. Enable **Install unknown apps** for your file manager or browser.
3. Open the APK and install.

Requires internet. The server must be running — see [MOBILE-B-CAPACITOR.md](../docs/MOBILE-B-CAPACITOR.md) and [mobile/README.md](../mobile/README.md).

## Build Capacitor (Option B)

```bash
cd client
npm install
npm run android:sync
export JAVA_HOME="$HOME/android-studio/jbr"
npm run android:build
```

Output: `client/android/app/build/outputs/apk/debug/app-debug.apk`

## Build Flutter (Option C)

```bash
cd mobile
export PATH="/tmp/flutter/bin:$PATH"   # or your Flutter SDK
export JAVA_HOME="$HOME/android-studio/jbr"
flutter build apk --debug \
  --dart-define=API_BASE=https://moral-sparrow-nationally.ngrok-free.app/api
```

Output: `mobile/build/app/outputs/flutter-apk/app-debug.apk`  
Copy to: `releases/Harmonix-flutter-debug.apk`
