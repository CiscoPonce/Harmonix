# Phase 17 — remaining steps (do these)

Operator checklist. Copy and Data safety text live in
[`docs/PLAY-CONSOLE-LISTING.md`](../../../docs/PLAY-CONSOLE-LISTING.md).
Tick in this file or in Play Console as you go.

JDK on this PC (2026-09-06):

```bash
export JAVA_HOME="$HOME/.local/jdk/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"
java -version   # OpenJDK 17.0.20.1
```

---

## A. One-time on this PC — signing (17-01)

You only do this once. Back up the `.jks` and both passwords **offline**.

- [ ] `cd mobile/android`
- [ ] Create the upload keystore (it will prompt for name / org / passwords):

```bash
export JAVA_HOME="$HOME/.local/jdk/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"
cd mobile/android
keytool -genkey -v \
  -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias upload
```

- [ ] `cp key.properties.example key.properties` and fill `storePassword`, `keyPassword`, `keyAlias=upload`, `storeFile=../upload-keystore.jks`
- [ ] Confirm both files are **not** staged (`git status` — `.jks` and `key.properties` are gitignored)
- [ ] Build the Play upload:

```bash
export JAVA_HOME="$HOME/.local/jdk/jdk-17"
export PATH="$JAVA_HOME/bin:$HOME/flutter/bin:$PATH"
cd mobile
flutter pub get
flutter build appbundle --release \
  --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```

- [ ] Artifact exists: `mobile/build/app/outputs/bundle/release/app-release.aab`
- [ ] Optional sideload QA APK (not for Play):

```bash
flutter build apk --release \
  --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```

If `flutter doctor` still complains about missing **cmdline-tools**, install them from Android Studio → SDK Manager → SDK Tools → Android SDK Command-line Tools, then `flutter doctor --android-licenses`.

---

## B. Play Console — create the app (17-02)

- [ ] Google Play developer account paid ($25) — [play.google.com/console](https://play.google.com/console)
- [ ] **Create app:** name `Harmonix` · language English (UK) · type App · price Free
- [ ] Store listing — paste from `docs/PLAY-CONSOLE-LISTING.md`
- [ ] Upload `mobile/store/app-icon-512.png` (512×512)
- [ ] Upload `mobile/store/feature-graphic.png` (1024×500)
- [ ] Upload **2–4 phone screenshots** (you take these): Discover card, search results, flipped card, Settings
- [ ] Privacy policy URL: `https://harmonix.peeporunclub.co.uk/privacy`
- [ ] Contact email: `hello@peeporunclub.co.uk` (change `client/src/lib/contact.ts` if the mailbox name is different)
- [ ] Data safety form — answers in the listing pack
- [ ] Content rating questionnaire — target **13+**, no ads, no IAP
- [ ] App category: Education (or Music & Audio if Console prefers)

---

## C. Internal testing (17-03)

- [ ] Register a **reviewer** account on the live site (or in-app). Save email + password.
- [ ] Play Console → **App content → App access** → add those credentials + the note in the listing pack
- [ ] **Testing → Internal testing** → create a release → upload `app-release.aab` (version `1.0.8`, code `11`)
- [ ] Add tester Gmail addresses
- [ ] Each tester opens the Internal testing link and installs from Play (not a random APK)
- [ ] On a phone, confirm:
  - [ ] Login / register works and lands on Discover
  - [ ] Word card shows a real Spanish (or native) meaning — not junk like `cacho`
  - [ ] Search “Hey Jude” returns tracks
  - [ ] Hear-it plays a ~30s preview
  - [ ] Flip card shows the lyric line
- [ ] Spotify Connect: only testers on the Spotify developer allowlist, until Extended Quota is approved. Reviewers can skip Connect.

---

## D. Production (only after C is green)

- [ ] Complete any remaining Console declarations (ads, news, government, target audience)
- [ ] Promote the Internal testing release to **Production** (or upload the same AAB to Production)
- [ ] Store listing is public
- [ ] Watch for Play review questions at `hello@peeporunclub.co.uk`

Do **not** start D if Hear-it or login failed in C.

---

## E. After the first upload (later updates)

1. Bump `mobile/pubspec.yaml` version (`1.0.9+12`, then `1.0.10+13`, …).
2. Rebuild the AAB with the same keystore.
3. Upload a new Internal testing / Production release.

Application ID `com.harmonix.app` must never change.
