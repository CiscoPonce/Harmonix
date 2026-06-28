# Harmonix Android — Capacitor (Option B)

Wraps the live Harmonix web app in a native Android shell. The WebView loads the VPS via ngrok — no custom domain required for debug/testing.

**Phase:** 10-00A / 10-01  
**Package:** `com.harmonix.app`

---

## Architecture

```text
Android APK (Capacitor WebView)
        │
        ▼
https://moral-sparrow-nationally.ngrok-free.app  (ngrok)
        │
        ▼
Express :3001  ──proxy──►  Next.js :3009
        │
        └── /api/*  (auth, daily word, player, etc.)
```

Same-origin cookies and `/api` calls work because ngrok hits Express, which proxies the frontend and serves the API.

---

## Prerequisites

| Tool | Notes |
|------|-------|
| **Android Studio** | Hedgehog or newer; install SDK Platform 34+ |
| **JDK 17+** | Bundled with Android Studio (`Settings → Build → Gradle JDK`) |
| **Node.js 20+** | For Capacitor CLI |
| **Physical Android phone** | USB debugging enabled (recommended over emulator for audio) |
| **VPS running** | `bash run_env.sh` on server — ngrok must be up |

---

## Environment variables

| Variable | Client | Purpose |
|----------|--------|---------|
| `CAPACITOR_SERVER_URL` | `client/env.capacitor.example` | Remote URL the WebView loads |
| `NEXT_PUBLIC_API_URL` | unset in Capacitor mode | Defaults to `/api` (same origin) |

When ngrok URL changes, update `client/capacitor.config.ts` or set `CAPACITOR_SERVER_URL` before `npm run cap:sync`.

---

## First-time setup (dev machine)

```bash
cd client
npm install
npm run android:sync
npm run android:open    # opens Android Studio
```

In Android Studio:

1. Wait for Gradle sync to finish.
2. Select a device (physical phone or emulator).
3. **Run** (green play) or **Build → Build APK(s) → Debug**.

---

## Build debug APK from CLI

Requires `JAVA_HOME` pointing to Android Studio's JDK:

```bash
export JAVA_HOME=$HOME/android-studio/jbr   # Linux — adjust for macOS/Windows
cd client
npm run android:build
```

**Pre-built APK:** [`releases/Harmonix-debug.apk`](../releases/Harmonix-debug.apk) — for testers without Android Studio.

APK output (when building locally):

```text
client/android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected phone:

```bash
npm run android:install
# or: adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Sideload on team phones (no Play Store)

1. Build debug APK (above).
2. Transfer `Harmonix-debug.apk` from [`releases/`](../releases/) (or your local build) via USB, Drive, WhatsApp, email, etc..
3. On the phone: **Settings → Security → Install unknown apps** (allow your file manager).
4. Open the APK and install.
5. Launch **Harmonix** — should load the ngrok URL automatically.

**Note:** Debug APKs expire after 7 days on some OEMs; rebuild as needed.

---

## ngrok interstitial

Free ngrok shows a browser warning page. `MainActivity.java` reloads with the `ngrok-skip-browser-warning` header automatically. If you still see the warning, tap **Visit Site** once.

---

## Regenerate icons / splash

Source assets live in `client/resources/`. After replacing `icon.png` or `splash.png`:

```bash
cd client
npx capacitor-assets generate --android
npm run android:sync
```

---

## VPS production frontend

`run_env.sh` serves a **production** Next.js build (`next build && next start`) instead of dev mode — more stable for WebView.

Restart after deploy:

```bash
bash /home/ubuntu/lyric/run_env.sh
```

---

## Smoke test checklist

- [ ] App opens to Harmonix landing / login
- [ ] Register or login
- [ ] Daily word loads (first may be slow ~60s)
- [ ] "Next word" instant when queue stocked
- [ ] Search → open player → audio preview plays
- [ ] Logout

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank white screen | Confirm ngrok URL loads in phone browser first |
| API 401 loop | Clear app data; cookies require same ngrok origin |
| Gradle sync fails | Set JDK 17 in Android Studio Gradle settings |
| `adb` not found | Add `~/Android/Sdk/platform-tools` to PATH |
| ngrok URL changed | Update `capacitor.config.ts`, run `npm run android:sync`, rebuild |

---

## Next steps (Phase 10-02)

- Internal Play Store track (requires Plan 10-00B domain)
- QA test matrix in `.planning/phases/10-mobile-dual-frontend/10-02-PLAN.md`
- Flutter MVP (Option C) after B test gate
