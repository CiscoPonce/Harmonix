# Harmonix

Learn Words Through Music. AI-first language learning through real music lyrics. Validated vocabulary extraction + spaced repetition tied to actual songs.

![Harmonix Logo](./logoharmonix2.png)

## Features

- **Word of the Day**: Get one personalized word, hear it in a real song lyric, then dive deeper.
- **Song Search**: Search any song or artist to extract and learn vocabulary from its lyrics.
- **Audio Previews**: Hear the exact moment in the song where the word is sung.
- **Progress Tracking**: Keep your streaks alive and track your daily vocabulary progress.
- **Dynamic Themes**: Minimalist UI with full support for Light and Dark modes.
- **Android App (beta)**: Installable APK wrapping the web app via Capacitor — same backend, real-device testing.

## Stack

- **Backend:** Node.js + Express + SQLite
- **Frontend:** Next.js 16 App Router (React)
- **Mobile (Option B):** Capacitor Android (`com.harmonix.app`)
- **Styling:** Tailwind CSS v4
- **AI:** NVIDIA NIM (Kimi K2.6)
- **Data:** LRCLib, Deezer

## Repo Layout

- `server/`: Express API, SQLite DB (`harmonix.db`), business logic
- `client/`: Next.js frontend + Capacitor Android project (`client/android/`)
- `releases/`: Pre-built debug APK for sideload testing
- `docs/`: Runbooks including [MOBILE-B-CAPACITOR.md](./docs/MOBILE-B-CAPACITOR.md)
- `.planning/`: Roadmap and phase plans (Phase 10 mobile)

## Quickstart

### Backend
```bash
cd server
cp .env.example .env
npm install
npm start
```

### Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Then open the client URL (default Next.js `:3009`) and the backend (default `:3001`).

Production on VPS: `bash run_env.sh` (backend + Next.js production + ngrok).

## Android APK (test on other devices)

**Pre-built debug APK** (no Android Studio required):

1. Download or copy [`releases/Harmonix-debug.apk`](./releases/Harmonix-debug.apk)
2. On the phone: allow **Install unknown apps**, then open the APK
3. Requires internet — app loads from the live Harmonix server (ngrok)

Full build and sideload guide: [docs/MOBILE-B-CAPACITOR.md](./docs/MOBILE-B-CAPACITOR.md)

**Build from source:**
```bash
cd client
npm install
npm run android:sync
export JAVA_HOME="$HOME/android-studio/jbr"   # adjust for your OS
npm run android:build
```

APK output: `client/android/app/build/outputs/apk/debug/app-debug.apk`

## Tests

```bash
cd server
npm test
```

## Key Rules

- **Validation First:** AI output is verified against external metadata before the UI sees it.
- **Audio Previews:** Stay short due to copyright limitations.
- **UI:** Dynamic Light/Dark-mode minimalist design.
- **Mobile:** Option B (Capacitor) = web UI in WebView; Option C (Flutter mockup) planned in Phase 10.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
