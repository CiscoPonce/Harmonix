# Harmonix

**Play Store app:** `1.0.8` (versionCode `11`) in [`mobile/pubspec.yaml`](mobile/pubspec.yaml)  
**Live site:** https://harmonix.peeporunclub.co.uk — every push to `main` deploys  
<!-- x-release-please-start-version -->
**Platform changelog:** 0.0.5
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
| Phase 17 Play Store | **In progress** — [17-CHECKLIST.md](.planning/phases/17-play-store-listing/17-CHECKLIST.md) |
| Phase 18 Learner reliability | **Complete** — [18-CONTEXT.md](.planning/phases/18-learner-reliability/18-CONTEXT.md) |
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
releases/        Release notes only. Play installs come from an AAB, not APKs in git.
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

### Production

**Public:** https://harmonix.peeporunclub.co.uk

Pushes to `main` run GitHub Actions: tests, then SSH to the VPS and `scripts/coolify-redeploy.sh` (Coolify Traefik, zero-downtime). Pocket-TTS stays on the host (`:3002`, systemd `harmonix-tts`).

Manual rebuild on the VPS, if Actions is unavailable:

```bash
cd /home/ubuntu/lyric
git fetch origin main && git reset --hard origin/main
HARMONIX_REDEPLOY_BOOTED=1 bash scripts/coolify-redeploy.sh
```

See [docs/COOLIFY-DEPLOY.md](./docs/COOLIFY-DEPLOY.md). Legacy host rollback only: `bash run_env.sh`.

## Security

- Never commit `.env` — only `.env.example` placeholders
- Spotify tokens encrypted at rest; refresh stays server-side
- OAuth uses PKCE; short `/callback` alias for Dashboard redirect matching
- See [SECURITY.md](./SECURITY.md)

## Tests

GitHub Actions runs these on every push to `main`:

```bash
cd server && npm test
cd client && node --experimental-strip-types --test 'src/lib/*.test.ts'
cd mobile && flutter analyze --fatal-infos && flutter test
```

## Planning

Milestone **v1.9** (Phase 16 Flutter web parity) is complete. Production is Coolify Traefik. Android Play Store path is **Flutter only**. Remaining ops: Play Store listing, privacy URL is `/privacy`, AI provider hardening, Extended Spotify Quota.

## Releases

Two numbers, on purpose:

| Track | Version | Where |
|-------|---------|--------|
| Android on Play | **1.0.8** (versionCode **11**) | `mobile/pubspec.yaml` — bump this for every Play upload |
| Platform changelog | **0.0.4** ([harmonix-v0.0.4](https://github.com/CiscoPonce/Harmonix/releases/tag/harmonix-v0.0.4)) | `CHANGELOG.md`, GitHub Releases |

The website has no store version. It ships from `main`.

[release-please](https://github.com/googleapis/release-please) opens the changelog pull request from [Conventional Commits](https://www.conventionalcommits.org/). Do not commit APKs. Testers install the signed AAB from Play Internal testing. See [docs/PLAY-CONSOLE-LISTING.md](docs/PLAY-CONSOLE-LISTING.md).

## License

MIT — see [LICENSE](LICENSE).
