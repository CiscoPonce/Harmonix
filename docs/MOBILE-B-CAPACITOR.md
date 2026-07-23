# Harmonix Android — Capacitor (Option B)

Wraps the live Harmonix web app in a native Android shell. The WebView loads production HTTPS — no custom Capacitor API layer required for debug/testing.

**Production URL:** https://harmonix.peeporunclub.co.uk  
**Phase:** 10-00A / 10-01 (legacy Capacitor path)  
**Package:** `com.harmonix.app`

---

## Architecture

```text
Android APK (Capacitor WebView)
        │
        ▼
https://harmonix.peeporunclub.co.uk  (Coolify Traefik)
        │
        ▼
Express api  ──proxy──►  Next.js web
        │
        └── /api/*  (auth, daily word, player, etc.)
```

Same-origin cookies and `/api` calls work because the public URL hits Express, which proxies the frontend and serves the API.

---

## Prerequisites

| Tool | Notes |
|------|-------|
| **Android Studio** | Hedgehog or newer; install SDK Platform 34+ |
| **JDK 17+** | Bundled with Android Studio (`Settings → Build → Gradle JDK`) |
| **Node.js 20+** | For Capacitor CLI |
| **Physical Android phone** | USB debugging enabled (recommended over emulator for audio) |
| **Production up** | https://harmonix.peeporunclub.co.uk reachable |

---

## Environment variables

| Variable | Client | Purpose |
|----------|--------|---------|
| `CAPACITOR_SERVER_URL` | `client/env.capacitor.example` | Remote URL the WebView loads |
| `NEXT_PUBLIC_API_URL` | unset in Capacitor mode | Defaults to `/api` (same origin) |

Default server URL is the production domain. Override `CAPACITOR_SERVER_URL` only for local experiments.

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
5. Launch **Harmonix** — should load https://harmonix.peeporunclub.co.uk automatically.

**Note:** Debug APKs expire after 7 days on some OEMs; rebuild as needed.

---

## Legacy ngrok interstitial

Only relevant if you temporarily point Capacitor at an ngrok URL. Free ngrok shows a browser warning; `MainActivity.java` may reload with `ngrok-skip-browser-warning`. Prefer the production domain.

---

## Regenerate icons / splash

Source assets live in `client/resources/`. After replacing `icon.png` or `splash.png`:

```bash
cd client
npx capacitor-assets generate --android
npm run android:sync
```

---

## Production frontend

Production is Coolify (Traefik → api → web). Redeploy:

```bash
bash /home/ubuntu/lyric/scripts/coolify-redeploy.sh
# or: git push origin main
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
| Blank white screen | Confirm https://harmonix.peeporunclub.co.uk loads in phone browser first |
| API 401 loop | Clear app data; cookies require same HTTPS origin |
| Gradle sync fails | Set JDK 17 in Android Studio Gradle settings |
| `adb` not found | Add `~/Android/Sdk/platform-tools` to PATH |
| Wrong host | Update `capacitor.config.ts` / `CAPACITOR_SERVER_URL`, `npm run android:sync`, rebuild |

---

## Wear OS preview (Samsung / Wear OS 6)

Minimal watch UI at **`/watch`** — Daily Word only, large tap targets, round-screen safe layout.

### On the watch

1. Enable **Developer options** + **Wireless debugging** (you already did this).
2. Sideload `Harmonix-debug.apk` (Easy Fire Tools / Bugjaeger / `adb install`).
3. Open **Harmonix** on the watch — very small screens auto-redirect to `/watch`.
4. Or open directly: `https://harmonix.peeporunclub.co.uk/watch` in the watch browser.
5. Sign in at `/watch/login`, then use **Hear it** / **Next word**.

### What you get

| Screen | Content |
|--------|---------|
| Login | Email + password only |
| Daily word | Word, translation, lyric snippet, audio at timestamp |

This is a **preview**, not the final Flutter Wear companion (Phase 10+).

### adb open URL (optional)

```bash
adb connect <watch-ip>:<port>
adb shell am start -a android.intent.action.VIEW -d "https://harmonix.peeporunclub.co.uk/watch"
```

---

## Next steps (Phase 10-02)

- Internal Play Store track (requires Plan 10-00B domain)
- QA test matrix in `.planning/phases/10-mobile-dual-frontend/10-02-PLAN.md`
- Flutter MVP (Option C) after B test gate
