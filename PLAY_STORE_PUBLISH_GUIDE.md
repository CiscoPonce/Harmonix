# 🚀 Play Store Publishing & Release Guide for Harmonix

Step-by-step checklist to prepare, build, and publish **Harmonix** (`com.harmonix.app`) to the Google Play Store.

---

## 1. Prerequisites & Android Studio Setup

Before building the Play Store App Bundle (`.aab`), ensure your Android Studio toolchain is configured:

1. **Install Android SDK Command-line Tools**:
   - Open **Android Studio**.
   - Go to **Tools > SDK Manager** (or `Settings > Languages & Frameworks > Android SDK`).
   - Click the **SDK Tools** tab.
   - Check **Android SDK Command-line Tools (latest)** and click **Apply** / **OK**.
2. **Accept Android Licenses**:
   - Open your terminal and run:
     ```bash
     flutter doctor --android-licenses
     ```
     *(Press `y` to accept all licenses)*.
3. **Google Play Developer Account**:
   - Register at [play.google.com/console](https://play.google.com/console) ($25 one-time fee).
4. **Privacy Policy URL**:
   - `https://harmonix.peeporunclub.co.uk/privacy`

---

## 2. Build Release Artifacts

### Option A: Build Release APK (For Direct Testing / Sideloading)
```bash
cd mobile
flutter build apk --release --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```
*(Output: `mobile/build/app/outputs/flutter-apk/app-release.apk`)*

---

### Option B: Build Signed Release App Bundle (For Play Store Upload)

1. **Generate Upload Keystore (One-time setup)**:
   ```bash
   cd mobile/android
   keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. **Configure `key.properties`**:
   Create or edit `mobile/android/key.properties`:
   ```ini
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=upload
   storeFile=../upload-keystore.jks
   ```

3. **Build the App Bundle (`.aab`)**:
   ```bash
   cd mobile
   flutter build appbundle --release --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
   ```
   *(Output: `mobile/build/app/outputs/bundle/release/app-release.aab`)*

---

## 3. Google Play Console Submission Checklist

1. **Create Application**:
   - Open [Google Play Console](https://play.google.com/console) -> Click **Create app**.
   - App Name: `Harmonix` | Default Language: `English (UK)` | Type: `App` | Price: `Free`.

2. **Main Store Listing Assets**:
   - **App Icon**: Upload `mobile/assets/app_icon.png` (512x512 PNG, transparent background).
   - **Feature Graphic**: Upload 1024x500 banner image.
   - **Phone Screenshots**: Upload 2–4 phone screenshots from your emulator/device.
   - **Short Description**: Learn languages through song lyrics & music.
   - **Full Description**: Harmonix is an AI-powered language learning platform that teaches vocabulary through song lyrics, interactive flashcards, SRS reviews, and TTS pronunciation.

3. **Data Safety Answers**:
   - **Data Collected**: Email (Account login) & App activity (Word progress).
   - **Encrypted in Transit**: Yes (HTTPS).
   - **Data Sold / Shared**: No.
   - **Contains Ads**: No.
   - **Target Age**: 13+.

4. **Upload & Release**:
   - Navigate to **Testing > Internal testing**.
   - Upload `app-release.aab`.
   - Add testers, test on device, and promote to **Production** when ready!
