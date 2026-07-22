# Harmonix Release Runbook

**Version:** 1.7  
**Last Updated:** 2026-07-22  

---

## 1. Production VPS Deployment

### Environment Variables (.env)
Required in `server/.env`:
- `PORT=3001`
- `JWT_SECRET` (min 32 chars)
- `ENCRYPTION_KEY` (32-byte hex for Spotify token encryption)
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI` (`https://moral-sparrow-nationally.ngrok-free.app/callback`)
- `NVIDIA_NIM_API_KEY` / `OPENROUTER_API_KEY`

### Service Start
```bash
git pull origin main
bash run_env.sh
```

`run_env.sh` manages 4 processes:
- Express API (`:3001`)
- Pocket-TTS Daemon (`:3002`)
- Next.js Production Build (`:3009`)
- ngrok Public Tunnel (`https://moral-sparrow-nationally.ngrok-free.app`)

### Fast Restart
To restart services without re-running unit tests:
```bash
./deploy.sh --skip-tests
```

---

## 2. Standalone Android APK Build

### Prerequisites
- Flutter SDK 3.x
- Java 17 / Android SDK API 34

### Build Command
```bash
cd mobile
flutter pub get
flutter build apk --release --dart-define=API_BASE=https://moral-sparrow-nationally.ngrok-free.app/api
```

### Output Artifact
`mobile/build/app/outputs/flutter-apk/app-release.apk`
Distribute directly to learners for sideloading.

---

## 3. Post-Deploy Smoke Test
1. Open `https://moral-sparrow-nationally.ngrok-free.app/login`
2. Test Login & Daily Word queue refill
3. Click "Connect Spotify" to verify Popup OAuth flow
4. Verify 30s Deezer preview audio playback
