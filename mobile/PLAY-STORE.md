# Google Play — Harmonix Android handoff

This app is Android-first. Build a **signed App Bundle (AAB)** for Play Console upload.
iOS comes after the production domain is live (separate phase).

## Prerequisites

1. Google Play Developer account
2. Production HTTPS API (or staging HTTPS). Do **not** ship ngrok in a store build.
3. Privacy policy: `https://harmonix.peeporunclub.co.uk/privacy`  
   Support: `hello@peeporunclub.co.uk`  
   Listing copy: [`docs/PLAY-CONSOLE-LISTING.md`](../docs/PLAY-CONSOLE-LISTING.md)
4. Release keystore (one-time; back up securely)

## One-time: create the upload keystore

```bash
cd mobile/android
keytool -genkey -v \
  -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload

cp key.properties.example key.properties
# Edit key.properties — storeFile should be ../upload-keystore.jks
```

## Build release artifacts

```bash
export JAVA_HOME="$HOME/.local/jdk/jdk-17"
export PATH="$JAVA_HOME/bin:$HOME/flutter/bin:$PATH"
cd mobile

export API_BASE=https://harmonix.peeporunclub.co.uk/api

flutter pub get
flutter build appbundle --release --dart-define=API_BASE=$API_BASE
flutter build apk --release --dart-define=API_BASE=$API_BASE
```

Outputs:

- AAB: `build/app/outputs/bundle/release/app-release.aab` ← upload to Play
- APK: `build/app/outputs/flutter-apk/app-release.apk` ← team sideload QA

Copy the APK to `../releases/Harmonix-android-release.apk` if desired.

## Application ID

`com.harmonix.app` — do not change after the first Play upload.

## Play Console checklist

- [ ] Create app “Harmonix”
- [ ] Upload AAB to Internal testing → promote later
- [ ] Store listing: title, short/full description, screenshots (phone)
- [ ] App icon 512×512 + feature graphic 1024×500
- [ ] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] **Data safety** (see below)
- [ ] Target audience / news apps declarations as applicable
- [ ] Demo account for reviewers (email/password) in App access

## Data safety answers (draft)

| Data | Collected? | Notes |
|------|------------|--------|
| Email | Yes | Account login |
| App activity (words learned) | Yes | Progress / WOTD on our servers |
| Audio files | Ephemeral | Pronunciation TTS; not sold |
| Device IDs | No (unless you add analytics later) | — |

- Encrypted in transit: **Yes** (HTTPS)
- Users can request deletion: document via support email / privacy policy
- Data sold: **No**
- Ads: **No** (unless you add them later)

## Music / copyright note for reviewers

Audio is limited to **30-second Deezer previews** for language learning context. Full tracks open in an external player/browser.

## After domain acquisition

```bash
flutter build appbundle --release \
  --dart-define=API_BASE=https://YOUR_NEW_DOMAIN/api
```

Re-upload AAB (bump `version` in `pubspec.yaml`, e.g. `1.0.1+2`).

## iOS (later)

See plan follow-up: Apple Developer Program, Mac/Xcode, TestFlight, App Store Connect.
Do not start iOS until Android + production domain are stable.
