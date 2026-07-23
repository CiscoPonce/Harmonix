# Harmonix Release Runbook

**Version:** 1.8  
**Last Updated:** 2026-07-23  

**Production URL:** https://harmonix.peeporunclub.co.uk  
**VPS:** `harmonixinstance` (`79.72.79.7`) — Coolify Traefik + Compose  
**Old VPS:** `agent-midas` — Harmonix **retired** (do not restart lyric stack there)

---

## 0. Primary deploy (Coolify)

→ Full guide: **[COOLIFY-DEPLOY.md](./COOLIFY-DEPLOY.md)**

### Automatic (preferred)
Push to `main` on GitHub. Workflow **Deploy Harmonix (Coolify VPS)** rebuilds images and restarts the Coolify **Harmonix** service.

### Manual on VPS
```bash
ssh ubuntu@79.72.79.7   # or Tailscale 100.97.39.101
bash /home/ubuntu/lyric/scripts/coolify-redeploy.sh
```

### Required env (Coolify UI or `server/.env`)
- `JWT_SECRET` / `JWT_REFRESH_SECRET`
- `SPOTIFY_CLIENT_ID` (+ secret if used)
- `SPOTIFY_REDIRECT_URI=https://harmonix.peeporunclub.co.uk/callback`
- `SPOTIFY_WEB_SUCCESS_URL=https://harmonix.peeporunclub.co.uk/playlists?spotify=connected`
- `SPOTIFY_WEB_ERROR_URL=https://harmonix.peeporunclub.co.uk/settings?spotify=error`
- `SPOTIFY_TOKEN_ENCRYPTION_KEY`
- `PUBLIC_BASE_URL=https://harmonix.peeporunclub.co.uk`
- `TTS_SKIP_SPAWN=true` / `TTS_BASE_URL=http://10.0.0.15:3002`
- `NVIDIA_NIM_API_KEY` / `OPENROUTER_API_KEY`

Host TTS: systemd `harmonix-tts` on `:3002`.

---

## 0b. Fresh start / empty DB

If you need a clean SQLite + URL rewrite without Coolify UI:

→ **[FRESH-START-MIGRATION.md](./FRESH-START-MIGRATION.md)** — prefer `--mode=domain --host=harmonix.peeporunclub.co.uk`.

---

## 1. Legacy host stack (rollback only)

Only if Coolify is broken and you must restore traffic quickly:

```bash
cd /home/ubuntu/lyric
# Stop Coolify Harmonix containers in UI, or:
# docker stop api-rxwdj1k3qu51fqf8uwtal389 web-rxwdj1k3qu51fqf8uwtal389
bash run_env.sh   # API + Next + TTS + optional ngrok
```

Do **not** run `run_env.sh` alongside the Coolify stack on `:3001`.

Fast legacy restart (tests optional):
```bash
./deploy.sh --skip-tests   # still calls run_env.sh — rollback path only
```

---

## 2. Standalone Android APK Build

```bash
cd mobile
flutter pub get
flutter build apk --release --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api
```

Artifact: `mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## 3. Post-Deploy Smoke Test

1. Open https://harmonix.peeporunclub.co.uk/login  
2. **Discover** — Word of the Day loads  
3. **Settings** — Connect Spotify (redirect must be `…/callback`)  
4. **Library / Playlists** — Spotify chip when connected  
5. Hear it — Spotify clip or Deezer 30s fallback  
6. Pronounce — TTS WAV  
7. Coolify UI (`:8000`) — Harmonix **Running (healthy)**
