# Fresh-start migration (Phase 14 ops) — ngrok or domain

Use this when you want a **clean Harmonix ship** and **do not need to copy** the old SQLite database.

You can run **without a custom domain** by choosing **ngrok** and pointing the API at that public HTTPS host.

Script: [`scripts/fresh-start-migrate.sh`](../scripts/fresh-start-migrate.sh)

---

## Choose your public surface

| Mode | When | Public API |
|------|------|------------|
| **ngrok** (default) | No domain access yet | `https://YOUR_NGROK_HOST/api` |
| **domain** | You own HTTPS DNS later | `https://YOUR_DOMAIN/api` |

Current reserved ngrok host on the VPS: `moral-sparrow-nationally.ngrok-free.app`

---

## One-command dry run

From the repo root (local or VPS):

```bash
bash scripts/fresh-start-migrate.sh --mode=ngrok
```

This prints the URLs and Spotify redirect URIs **without changing files**.

---

## Apply fresh start on the VPS (ngrok + empty DB)

```bash
cd /home/ubuntu/lyric   # or your clone path
git pull origin main

# Interactive prompts, or fully non-interactive:
bash scripts/fresh-start-migrate.sh \
  --mode=ngrok \
  --host=moral-sparrow-nationally.ngrok-free.app \
  --fresh-db \
  --write \
  --restart \
  --yes
```

What this does:

1. Archives `server/harmonix.db` (does **not** import it into the new DB)
2. Writes public URL fields into `server/.env` and `client/.env`
3. Aligns `run_env.sh` `NGROK_URL` when mode is ngrok
4. Restarts backend + Next prod + ngrok via `run_env.sh`

Secrets already in `.env` (JWT, Spotify client id, encryption key, AI keys) are **kept**. Only URL-related keys are upserted.

---

## Spotify Dashboard (required after URL write)

Add redirect URI(s) exactly:

1. `https://YOUR_HOST/callback` ← preferred (Express aliases to OAuth callback)
2. Optional: `https://YOUR_HOST/api/spotify/oauth/callback`

Then reconnect Spotify from **Settings** after you register a new account (fresh DB = new users).

---

## Wire the API for each client

| Client | Setting |
|--------|---------|
| Web (Next) | `NEXT_PUBLIC_API_URL=https://YOUR_HOST/api` (script writes this) |
| Flutter | `--dart-define=API_BASE=https://YOUR_HOST/api` |
| Capacitor (legacy) | Same public `/api` base as web |

Example Flutter release APK:

```bash
cd mobile
flutter build apk --release \
  --dart-define=API_BASE=https://moral-sparrow-nationally.ngrok-free.app/api
```

---

## Later: switch to a real domain

When you have DNS + TLS:

```bash
bash scripts/fresh-start-migrate.sh \
  --mode=domain \
  --host=app.yourdomain.com \
  --write \
  --restart \
  --yes
```

Update Spotify Dashboard redirects to the new host, then reconnect Spotify accounts.

You can keep the same DB this time (omit `--fresh-db`) if you are only changing the public hostname.

---

## Smoke checklist

1. `https://YOUR_HOST/login` → register fresh user  
2. Discover → Word of the Day loads (or queues)  
3. Settings → Connect Spotify (popup)  
4. Library → header shows `Spotify · {name}` when connected  
5. Hear it / player works (Spotify or Deezer fallback)  

---

## Safety notes

- `--fresh-db` **archives** the old file as `harmonix.db.archived-TIMESTAMP` under `server/` — it does not delete forever immediately.
- Never commit `.env` files.
- ngrok free interstitial can affect first WebView load; fine for team/dev, less ideal for public store users (domain later).
