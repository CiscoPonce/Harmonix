# Harmonix

<!-- x-release-please-start-version -->
**Version:** 0.0.2
<!-- x-release-please-end -->

AI-first language learning through real music lyrics — validated against Deezer + LRCLib, with Spotify connect/export and web in-app playback.

![Harmonix Logo](./logoharmonix.png)

**Tagline:** Learn Words Through Music  
**Live:** https://harmonix.peeporunclub.co.uk  
**Default branch:** `main` (all product work lands here)

## Status

| Item | State |
|------|--------|
| Roadmap phases 1–16 | **Complete** (v1.9 Flutter web parity) |
| Phase 15 Coolify deploy | **Live** — Traefik HTTPS + GH Actions zero-downtime deploy on `main` push |
| Web home | Unified **Discover** (Word of the Day + practice + search) |
| Nav | Discover · Library (`/playlists`) · Settings |
| Settings | Languages · music style · voice gender · Spotify · password |
| Mobile | **Flutter only** for Play Store (`mobile/`). Capacitor is not a release path. |
| Branches | Product work is on `main` only |

See [`.planning/ROADMAP.md`](./.planning/ROADMAP.md) and [`.planning/STATE.md`](./.planning/STATE.md).

## Features

- **Word of the Day** — Personalized word in a real lyric, buffered queue for fast next words
- **Hear it** — Spotify Premium in-app clip when connected; Deezer 30s preview fallback + Open in Spotify
- **Pronunciation** — Pocket-TTS cached WAV; Settings voice gender (female/male)
- **Music style** — any / pop / rock / hip-hop / reggaeton (Settings; changing style refreshes the word queue)
- **Song search & player** — Synced lyrics + vocabulary extraction
- **Library** — Harmonix playlists + Spotify playlists; export Harmonix → Spotify; connected account shown in the header (`Spotify · {name}`)
- **Practice** — SRS review + streak/goal chips on Discover
- **Web shell** — Discover · Library · Settings (forest-green design system + theme-aware logos)
- **Android** — Flutter native app (`mobile/`) is the Play Store app. The Capacitor wrapper under `client/android/` is archived and not shipped.

## Stack

| Layer | Tech |
|-------|------|
| API | Node.js, Express, SQLite |
| Web | Next.js App Router, Tailwind v4 |
| Mobile | Flutter (`mobile/`) — Play Store. Capacitor is not shipped. |
| AI | NVIDIA NIM + OpenRouter fallback |
| Music | Deezer, LRCLib, Spotify Web API / Web Playback SDK |
| TTS | Pocket-TTS (local daemon) |

## Repo layout

```text
server/          Express API + SQLite + Spotify/TTS/daily-word services
client/          Next.js web
mobile/          Flutter Android app (Play Store path)
releases/        Sideload debug APKs
docs/            Runbooks (Coolify, Spotify, mobile, releases)
.planning/       ROADMAP, STATE, phase contexts & plans
docker-compose.yml  Coolify/Docker: api + web (Phase 15)
logoharmonix.png Brand logo (web: client/public/logo-{light,dark,mark}.png)
run_env.sh       Legacy VPS: backend + Next prod + TTS + ngrok
deploy.sh        pull → tests → run_env (tests may block; prefer run_env after pull)
```

## Quickstart

### Backend
```bash
cd server
cp .env.example .env   # fill JWT_*, AI keys, Spotify as needed
npm install
npm start              # :3001
```

### Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev            # :3009
```

### Production (VPS)

**Public:** https://harmonix.peeporunclub.co.uk  

Primary path: Docker Compose on the VPS behind Coolify Traefik (see [docs/COOLIFY-DEPLOY.md](./docs/COOLIFY-DEPLOY.md)).

```bash
# On the VPS (manual / current ops)
cd /home/ubuntu/lyric
git pull origin main
docker compose build && docker compose up -d
# Pocket-TTS stays on the host (:3002); systemd unit harmonix-tts
```

Legacy rollback: `bash run_env.sh` (host Node + Next + ngrok).

**Git → production deploy:** pushes to `main` trigger GitHub Actions → SSH → `scripts/coolify-redeploy.sh` (rebuild images + restart Coolify **Harmonix**).

## Security

- Never commit `.env` — only `.env.example` placeholders
- Spotify tokens encrypted at rest; refresh stays server-side
- OAuth uses PKCE; short `/callback` alias for Dashboard redirect matching
- See [SECURITY.md](./SECURITY.md)

## Tests

```bash
cd server && npm test
```

Known env-sensitive failures: Pocket-TTS not running; Spotify `/status` contract drift — see ops notes in `.planning/STATE.md`.

## Planning

Milestone **v1.9** (Phase 16 Flutter web parity) is complete. Production is Coolify Traefik. Android Play Store path is **Flutter only**. Remaining ops: Play Store listing, privacy URL is `/privacy`, AI provider hardening, Extended Spotify Quota.

## Releases

Versioning via [release-please](https://github.com/googleapis/release-please). Commits on `main` use [Conventional Commits](https://www.conventionalcommits.org/).

## License

MIT — see [LICENSE](LICENSE).
