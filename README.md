# Harmonix

**Play Store app:** `1.0.13` (versionCode `16`), application id `uk.co.peeporunclub.harmonix`, in [`mobile/pubspec.yaml`](mobile/pubspec.yaml)  
**Live site:** https://harmonix.peeporunclub.co.uk — every push to `main` deploys  
<!-- x-release-please-start-version -->
**Platform changelog:** 0.0.5
<!-- x-release-please-end -->

**Google Play:** closed testing for 1.0.13 is submitted. Harmonix is launching on the Play Store soon, after 12 testers have stayed opted in for 14 days.

AI-first language learning through real music lyrics. Words are checked against Deezer, iTunes, and LRCLib. Spotify connects for library export and in-app playback. Previews stay at 30 seconds.

![Harmonix Logo](./logoharmonix.png)

**Tagline:** Learn Words Through Music  
**Live:** https://harmonix.peeporunclub.co.uk  
**Default branch:** `main` (all product work lands here)

## Status

| Item | State |
|------|--------|
| Roadmap phases 1–16 | **Complete** (v1.9 Flutter web parity) |
| Phase 17 Play Store | **Closed testing** — 1.0.13 is with Google. Public launch is soon. [17-CHECKLIST.md](.planning/phases/17-play-store-listing/17-CHECKLIST.md) |
| Phase 18 Learner reliability | **Complete** — [18-CONTEXT.md](.planning/phases/18-learner-reliability/18-CONTEXT.md) |
| Phase 15 Coolify deploy | **Live** — Traefik HTTPS + GH Actions zero-downtime deploy on `main` push |
| Home | **Word** tab: Word of the Day, practice, and song search |
| Nav | Word · Library (`/playlists`) · Settings. On Android, Account opens Settings. |
| Library | Recent words open the full word card (preview, Spotify, playlist, share) |
| Android offline | The last word and recent words stay readable without a network |
| Settings | Languages · music style · voice gender · Spotify · password |
| Mobile | **Flutter only** for Play Store (`mobile/`). Capacitor is not a release path. |
| Branches | Product work is on `main` only |

See [`.planning/ROADMAP.md`](./.planning/ROADMAP.md) and [`.planning/STATE.md`](./.planning/STATE.md).

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

Milestone **v1.9** (Phase 16 Flutter web parity) is complete. Production is Coolify Traefik. Android Play Store path is **Flutter only**. The Play app is in closed testing and launching soon. Privacy URL is `/privacy`.

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
