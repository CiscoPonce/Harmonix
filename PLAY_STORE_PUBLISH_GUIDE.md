# 🚀 Play Store Publishing Guide for Harmonix

Quick step-by-step checklist to publish **Harmonix** (`com.harmonix.app`) to the Google Play Store.

---

## 1. Prerequisites
- [ ] **Google Play Developer Account** ($25 one-time registration fee at [play.google.com/console](https://play.google.com/console)).
- [ ] **Privacy Policy URL**: `https://harmonix.peeporunclub.co.uk/privacy`
- [ ] **Demo Account Credentials**: (For Google reviewers to log in during review, e.g., `demo@harmonix.app / Password123`).

---

## 2. Build the Signed Android App Bundle (`.aab`)

Open your terminal and run:

```bash
# Step A: Navigate to android folder & create upload keystore (one-time setup)
cd mobile/android
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload

# Step B: Create key.properties file
cp key.properties.example key.properties
```

Edit `key.properties` to set your keystore passwords:
```ini
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=upload
storeFile=../upload-keystore.jks
```

Build the signed release bundle:
```bash
cd mobile
flutter build appbundle --release --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```
*(Output location: `mobile/build/app/outputs/bundle/release/app-release.aab`)*

---

## 3. Google Play Console Steps

1. **Create App**:
   - Go to Google Play Console -> **Create app**.
   - App Name: `Harmonix`
   - Default language: `English (US)`
   - Type: `App` | Price: `Free`

2. **Main Store Listing Assets**:
   - **App Icon**: Upload `mobile/assets/app_icon.png` (512x512 PNG).
   - **Feature Graphic**: 1024x500 banner image.
   - **Screenshots**: 2–4 phone screenshots (taken from your Android emulator).
   - **Short Description**: Learn languages through song lyrics & music.
   - **Full Description**: Harmonix is an AI-powered language learning app that teaches vocabulary through song lyrics, interactive flashcards, SRS reviews, and TTS pronunciation.

3. **App Content & Data Safety Answers**:
   - **Data Collected**: Email (Account login) & App activity (Word progress).
   - **Encrypted in Transit**: Yes (HTTPS).
   - **Data Sold / Shared**: No.
   - **Contains Ads**: No.
   - **Target Age**: 13+ or 18+.

4. **Upload Bundle & Submit**:
   - Go to **Testing > Internal testing**.
   - Create a new release and upload `app-release.aab`.
   - Once tested, click **Promote release > Production** to submit for Google review!
