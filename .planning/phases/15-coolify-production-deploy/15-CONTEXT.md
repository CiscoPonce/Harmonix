# Phase 15 — Coolify production deploy

**Status:** Complete (2026-07-23); re-verified 2026-07-24  
**Milestone:** v1.8

## Goal

Run Harmonix under Coolify Traefik on `harmonixinstance` with a real domain; stop relying on host `run_env.sh` + ngrok for production.

## Done

- Coolify + Traefik healthy (`:8000` UI redirects to login)
- `docker-compose.yml`, Dockerfiles, `SQLITE_PATH` / `FRONTEND_PROXY_TARGET` / host TTS
- Domain: **https://harmonix.peeporunclub.co.uk** → `79.72.79.7` (Let’s Encrypt CN matches)
- Coolify service **Harmonix** (`api` + `web`) healthy
- Host systemd `harmonix-tts` on `:3002` (unit template: `scripts/systemd/harmonix-tts.service`)
- SQLite seeded into Coolify volume `rxwdj1k3qu51fqf8uwtal389_harmonix-data`
- Spotify redirect / success / error URLs on `.co.uk`
- Old VPS `agent-midas` Harmonix stopped; host Node/Next/ngrok not serving production
- GitHub Actions push → `scripts/coolify-redeploy.sh` (zero-downtime)
- Docs: `docs/COOLIFY-DEPLOY.md`, runbook, README, ROADMAP/STATE

## DNS gate (2026-07-24)

| Host | Public DNS | Notes |
|------|------------|-------|
| `harmonix.peeporunclub.com` | **NXDOMAIN** | Plan hostname; zone not delegated — out of scope to buy/fix |
| `harmonix.peeporunclub.co.uk` | `79.72.79.7` | **Live** production hostname |

## Cutover smoke (2026-07-24)

| Check | Result |
|-------|--------|
| `GET /` HTTPS | 200 |
| `GET /discover`, `/login`, `/settings` | 200 |
| `POST /api/auth/login` (empty body) | 401 JSON (API up) |
| `GET /api/search?q=despacito` | 200 (Deezer) |
| `GET /api/daily-word` / pronounce | 401 without auth (route mounted) |
| `GET /callback` | 302 (Spotify alias) |
| `GET /.well-known/assetlinks.json` | 200 |
| Public `:3002` TTS | filtered (host-only; Docker uses `10.0.0.15`) |
| Deploy workflow | **Deploy Harmonix (Coolify VPS)** success on recent `main` pushes |

## Follow-ups (optional)

- Containerize Pocket-TTS
- Native Coolify Git webhook (vs GitHub Actions SSH) if desired
- If `peeporunclub.com` is ever registered: A record + Coolify Traefik host + Spotify redirects (keep `.co.uk` until proven)

## Rollback

Stop Coolify Harmonix containers, then `bash run_env.sh` (emergency only).
