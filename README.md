# Harmonix

**Learn words through music.**

Harmonix teaches vocabulary from the lyrics of songs people already listen to. Each word comes from a real line, is checked against the recording, and can be heard in a 30-second preview. The web app is live. The Android app has completed internal testing and is in Google Play closed testing, with a public launch to follow.

![Harmonix Logo](./logoharmonix.png)

**Web** — [harmonix.peeporunclub.co.uk](https://harmonix.peeporunclub.co.uk)  
**Android** — `1.0.13` (version code 16) · `uk.co.peeporunclub.harmonix`  
**Google Play** — Closed testing is submitted. Public release follows 12 opted-in testers for 14 days.

<!-- x-release-please-start-version -->
**Platform release:** 0.0.6
<!-- x-release-please-end -->

The Word tab is the home: a word of the day, practice, and song search. Library keeps Harmonix and Spotify playlists, and a recent word opens its full card. On Android, Account is Settings, and the last word stays readable offline.

## Features

- **Word of the Day** — Personalized word in a real lyric, buffered queue for fast next words
- **Hear it** — 30-second Deezer preview, with iTunes when Deezer is blocked. Spotify Premium plays in the app when connected, and Open in Spotify is always available
- **Pronunciation** — Pocket-TTS for English and fallback; Kokoro for Spanish; the phone speaks the word if the server voice is missing. Settings chooses voice gender
- **Music style** — any / pop / rock / hip-hop / reggaeton (Settings; changing style refreshes the word queue)
- **Song search** — Find a song and learn a word from its lyric
- **Library** — Harmonix playlists and Spotify playlists; export Harmonix → Spotify. A recent word opens its card
- **Practice** — SRS review + streak/goal chips on the Word tab
- **Web shell** — Word · Library · Settings (forest-green design system + theme-aware logos)
- **Android** — Flutter app (`mobile/`) is the Play Store app: Word, Library, and Account. Recent words reopen their cards. The last word stays available offline. The Capacitor wrapper under `client/android/` is not shipped.

## Stack

| Layer | Tech |
|-------|------|
| API | Node.js, Express, SQLite |
| Web | Next.js App Router, Tailwind v4 |
| Mobile | Flutter (`mobile/`) — Play Store. Capacitor is not shipped. |
| AI | NVIDIA NIM + OpenRouter fallback |
| Music | Deezer, iTunes, LRCLib, Spotify Web API / Web Playback SDK |
| TTS | Pocket-TTS `:3002` (English and fallback), Kokoro `:3003` (Spanish) |

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

Pushes to `main` run GitHub Actions: tests, then SSH to the VPS and `scripts/coolify-redeploy.sh` (Coolify Traefik, zero-downtime). Pocket-TTS stays on the host (`:3002`, systemd `harmonix-tts`). Kokoro stays on the host (`:3003`) and speaks Spanish. A deploy does not restart those voices.

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

Phases 1–18 are complete. Production is Coolify Traefik. The Android app is Flutter only and is in Google Play closed testing, with the public listing to follow. Privacy URL is `/privacy`.

## Releases

Two numbers, on purpose:

| Track | Version | Where |
|-------|---------|--------|
| Android on Play | **1.0.13** (versionCode **16**), id `uk.co.peeporunclub.harmonix` | `mobile/pubspec.yaml` — bump this for every Play upload |
| Platform changelog | The **Platform changelog** line at the top of this file | `CHANGELOG.md`, [GitHub Releases](https://github.com/CiscoPonce/Harmonix/releases) |

The website has no store version. It ships from `main`.

[release-please](https://github.com/googleapis/release-please) opens the changelog pull request from [Conventional Commits](https://www.conventionalcommits.org/). Do not commit APKs. Testers install from the Play closed test. The APK attached to a GitHub release is built in CI and uses a different signature, so it does not update the Play install. See [docs/PLAY-CONSOLE-LISTING.md](docs/PLAY-CONSOLE-LISTING.md).

## License

MIT — see [LICENSE](LICENSE).
