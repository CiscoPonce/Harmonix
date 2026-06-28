# Harmonix Android releases

| File | Type | Notes |
|------|------|-------|
| [Harmonix-debug.apk](./Harmonix-debug.apk) | Debug APK | Capacitor wrapper (Option B). Loads live app via ngrok. |

Also attached to each [GitHub Release](https://github.com/CiscoPonce/Harmonix/releases) (v0.0.1+).

## Install on Android

1. Transfer `Harmonix-debug.apk` to the device.
2. Enable **Install unknown apps** for your file manager or browser.
3. Open the APK and install.

Requires internet. The server must be running — see [MOBILE-B-CAPACITOR.md](../docs/MOBILE-B-CAPACITOR.md).

## Build your own

```bash
cd client
npm install
npm run android:sync
export JAVA_HOME="$HOME/android-studio/jbr"
npm run android:build
```

Output: `client/android/app/build/outputs/apk/debug/app-debug.apk`
