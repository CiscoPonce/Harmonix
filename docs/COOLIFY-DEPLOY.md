# Coolify / Docker Compose deploy for Harmonix

**Last updated:** 2026-07-24  
**VPS:** `harmonixinstance` (`79.72.79.7`) — Coolify Traefik on `:80`/`:443`, UI on `:8000`.  
**Live:** https://harmonix.peeporunclub.co.uk (Docker Compose `api`+`web` + Traefik labels; host Pocket-TTS).

> **Domain note:** `harmonix.peeporunclub.com` is still **NXDOMAIN** on public DNS. Production uses **`harmonix.peeporunclub.co.uk`** → `79.72.79.7` (Let’s Encrypt via Coolify Traefik). Do not cut traffic to `.com` until that zone is registered and delegated.

---

## Current vs target

| Legacy (`run_env.sh`) | Now (Compose + Traefik) |
|-----------------------|-------------------------|
| Host Node + Next + ngrok | Coolify Compose → Traefik → `api:3001` |
| SQLite `server/harmonix.db` | Volume `rxwdj1k3qu51fqf8uwtal389_harmonix-data` (`SQLITE_PATH=/data/harmonix.db`) |
| Express → `127.0.0.1:3009` | `FRONTEND_PROXY_TARGET=http://web:3009` |
| TTS spawned by API | Host TTS systemd `harmonix-tts` (`TTS_BASE_URL=http://10.0.0.15:3002`) |
| ngrok URL | **https://harmonix.peeporunclub.co.uk** |

Ports `80`/`443` stay with Coolify Traefik. Host Node/Next/ngrok must stay stopped on production.

---

## Prerequisites

1. Code with `docker-compose.yml`, `server/Dockerfile`, `client/Dockerfile` on the branch Coolify builds (usually `main`).
2. Secrets ready (same as `server/.env`): `JWT_SECRET`, Spotify, NIM/OpenRouter, etc.
3. Pocket-TTS on the host via systemd (see below) — bind `0.0.0.0:3002` so Docker can reach it (`TTS_BASE_URL=http://10.0.0.15:3002`).
4. **Domain:** A record `harmonix.peeporunclub.co.uk` → `79.72.79.7`, attached in Coolify with HTTPS.

### Host Pocket-TTS (systemd)

Unit file in-repo: [`scripts/systemd/harmonix-tts.service`](../scripts/systemd/harmonix-tts.service).

```bash
sudo cp /home/ubuntu/lyric/scripts/systemd/harmonix-tts.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now harmonix-tts
curl -sf http://127.0.0.1:3002/health   # expect 200
# From a test container / api: curl -sf http://10.0.0.15:3002/health
```

Keep `TTS_SKIP_SPAWN=true` on the Coolify `api` service so containers never fight the host daemon.

### SQLite seed (one-time cutover)

```bash
# Brief write pause: stop Coolify api (or use a maintenance window)
sudo cp -a /home/ubuntu/lyric/server/harmonix.db /home/ubuntu/backups/harmonix.db.$(date +%Y%m%d)
# Copy into the Coolify volume as /data/harmonix.db (UID 999), then start api
```

Production volume: `rxwdj1k3qu51fqf8uwtal389_harmonix-data` (already seeded).

---

## Coolify UI steps

1. Open Coolify: `http://79.72.79.7:8000` (or your Coolify `APP_URL` if configured).
2. **New Resource → Docker Compose**.
3. Connect the Git repo (GitHub) **or** deploy from the server path `/home/ubuntu/lyric` if using a local source.
4. Select `docker-compose.yml` at the repo root.
5. Set environment variables in Coolify (mirror production `server/.env`). Important:

| Variable | Example / notes |
|----------|-----------------|
| `JWT_SECRET` | required |
| `SPOTIFY_*` | update redirect URIs to the new public URL |
| `NEXT_PUBLIC_API_URL` | `/api` (same-origin via Express proxy) |
| `FRONTEND_PROXY_TARGET` | `http://web:3009` (already in compose) |
| `TTS_SKIP_SPAWN` | `true` |
| `TTS_BASE_URL` | `http://host.docker.internal:3002` |
| `FORCE_SECURE_COOKIES` | `true` behind HTTPS |

6. Mark **`api`** as the public service; assign domain (or leave port `3001` published for ngrok).
7. Deploy. Confirm healthchecks pass for `api` and `web`.

### Cut over from `run_env.sh`

```bash
# On the VPS — stop host Node/Next/ngrok (keep TTS if using host daemon)
# Option A: stop only Harmonix ports
fuser -k 3001/tcp 3009/tcp || true
pkill -f 'ngrok http' || true

# Option B: after Coolify is healthy, point ngrok at Coolify's published port:
ngrok http 3001 --url=moral-sparrow-nationally.ngrok-free.app
```

Update Spotify Dashboard redirect URIs if the public hostname changes.

---

## Local / VPS compose smoke (without Coolify UI)

Verified 2026-07-23 on `harmonixinstance`: `api` → login **401**, `/` → **200** (Express→Next proxy) on port `3011` while the live `run_env` stack stayed on `3001`/`3009`.

```bash
cd /home/ubuntu/lyric
export HARMONIX_API_PORT=3011   # avoid clashing with live stack
docker compose build
docker compose up -d            # reads secrets from server/.env
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:3011/api/auth/login \
  -H 'Content-Type: application/json' -d '{}'
# expect 401/400
docker compose down
```

Expect `401`/`400` (API up). Browser via Express proxy: Discover should load.

---

## What stays on the host (for now)

- **Pocket-TTS** models/venv (heavy) — Phase 15 follow-up can containerize later
- **Coolify** itself (`coolify`, `coolify-proxy`, db, redis, sentinel)
- Optional: keep `run_env.sh` as emergency fallback documented in the release runbook

---

## Rollback

```bash
docker compose down
bash run_env.sh    # legacy host stack + ngrok
```

---

## Git push → auto-deploy?

**Yes (GitHub Actions).** Pushing to `main` runs [`.github/workflows/deploy-harmonix.yml`](../.github/workflows/deploy-harmonix.yml), which SSHs to the production VPS and runs [`scripts/coolify-redeploy.sh`](../scripts/coolify-redeploy.sh):

1. Sync `/home/ubuntu/lyric` to `origin/main`
2. Build images while live traffic stays on current containers
3. Start a Traefik **standby** API so the public URL stays up during API cutover
4. Roll **api**, then start a **web** standby (DNS alias `web`) and roll **web**
5. Remove standbys and health-check `https://harmonix.peeporunclub.co.uk`

This is zero-downtime for push deploys (proxy 502/503 during recreate should not happen).

**Deploy rules**

| Do | Don’t |
|----|--------|
| `git push origin main` (GitHub Actions) | Coolify UI **Restart** / stop-before-start |
| `bash /home/ubuntu/lyric/scripts/coolify-redeploy.sh` on the VPS | Manual `docker compose down` on the live project |
| Use Coolify UI for env, domain, and health status | Rely on a Coolify “Deploy on push” webhook (Actions already owns deploys) |

Repo secrets: `HARMONIX_DEPLOY_HOST`, `HARMONIX_DEPLOY_USER`, `HARMONIX_DEPLOY_SSH_KEY`.

**Production topology**

- **Edge:** Coolify Traefik → `harmonix.peeporunclub.co.uk`
- **App:** Coolify service UUID `rxwdj1k3qu51fqf8uwtal389` → containers `api-rxwdj…` / `web-rxwdj…`
- **Volume:** `rxwdj1k3qu51fqf8uwtal389_harmonix-data` (SQLite, UID 999)
- **TTS:** host systemd `harmonix-tts` (`:3002`, `TTS_BASE_URL=http://10.0.0.15:3002`)
- **Old VPS (`agent-midas`):** Harmonix stopped

Manual: `bash /home/ubuntu/lyric/scripts/coolify-redeploy.sh` on the VPS.

---

## Related

- [RELEASE-RUNBOOK.md](./RELEASE-RUNBOOK.md)
- [FRESH-START-MIGRATION.md](./FRESH-START-MIGRATION.md)
- Phase **15** in [`.planning/ROADMAP.md`](../.planning/ROADMAP.md)
