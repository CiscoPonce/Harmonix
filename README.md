# Harmonix

<!-- x-release-please-start-version -->
**Version:** 0.0.2
<!-- x-release-please-end -->

AI-first language learning through real music lyrics — validated against Deezer + LRCLib, with Spotify connect/export and web in-app playback.

![Harmonix Logo](./logoharmonix2.png)

## Features

- **Word of the Day** — Personalized word in a real lyric, buffered queue for fast next words
- **Hear it** — Spotify Premium in-app clip when connected; Deezer 30s preview fallback
- **Pronunciation** — Pocket-TTS cached WAV for supported languages
- **Song search & player** — Synced lyrics + vocabulary extraction
- **Library** — Harmonix playlists + Spotify playlists; export Harmonix → Spotify
- **Web shell** — Discover · Library · Learn · Settings (forest-green design system)
- **Android** — Flutter native app (`mobile/`) + temporary Capacitor WebView APK

## Stack

| Layer | Tech |
|-------|------|
| API | Node.js, Express, SQLite |
| Web | Next.js App Router, Tailwind v4 |
| Mobile | Flutter (Option C) · Capacitor (Option B bridge) |
| AI | NVIDIA NIM + OpenRouter fallback |
| Music | Deezer, LRCLib, Spotify Web API / Web Playback SDK |
| TTS | Pocket-TTS (local daemon) |

## Repo layout

```text
server/          Express API + SQLite + Spotify/TTS/daily-word services
client/          Next.js web + Capacitor Android (`client/android/`)
mobile/          Flutter Android app (Play Store path)
releases/        Sideload debug APKs
docs/            Runbooks (Spotify, mobile, language reliability, releases)
.planning/       ROADMAP, STATE, phase contexts & plans
run_env.sh       VPS: backend + Next prod + TTS + ngrok
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
```bash
git pull origin main
bash run_env.sh
```
Public tunnel (current): `https://moral-sparrow-nationally.ngrok-free.app`

## Security

- Never commit `.env` — only `.env.example` placeholders
- Spotify tokens encrypted at rest; refresh stays server-side
- OAuth uses PKCE; short `/callback` alias for Dashboard redirect matching
- See [SECURITY.md](./SECURITY.md)

## Tests

```bash
cd server && npm test
```

Known env-sensitive failures: Pocket-TTS not running; Spotify `/status` contract drift — tracked in Phase 14-07.

## Planning

Active milestone: **v1.7 Phase 14 — Production Parity & Ship**  
See [`.planning/ROADMAP.md`](./.planning/ROADMAP.md) and [`.planning/STATE.md`](./.planning/STATE.md).

## Releases

Versioning via [release-please](https://github.com/googleapis/release-please). Commits on `main` use [Conventional Commits](https://www.conventionalcommits.org/).

## License

MIT — see [LICENSE](LICENSE).
