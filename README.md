<p align="center">
  <img src="client/public/logo-mark.png" alt="Harmonix" width="112">
</p>

<h1 align="center">Harmonix</h1>

<p align="center">
  Learn vocabulary from the lyrics of songs people already listen to.
</p>

<p align="center">
  <a href="https://harmonix.peeporunclub.co.uk">Website</a>
  ·
  <a href="https://harmonix.peeporunclub.co.uk/privacy">Privacy</a>
  ·
  <a href="https://harmonix.peeporunclub.co.uk/terms">Terms</a>
  ·
  <a href="./CHANGELOG.md">Changelog</a>
</p>

Harmonix picks a word from a real lyric line, checks it against the recording, and plays a 30-second preview. The website is live. The Android app is in Google Play closed testing. A public listing follows once 12 testers have stayed opted in for 14 days.

The Word screen is home: a word of the day, practice, and song search. Library holds Harmonix and Spotify playlists. On Android, the last word stays readable offline.

## Features

- **Word of the Day.** A word from a real lyric, with the next few words ready so moving on stays fast.
- **Hear it.** A 30-second Deezer preview, or iTunes when Deezer is blocked. Spotify Premium can play in the app. Open in Spotify is always available.
- **Pronunciation.** Pocket-TTS for English and the fallback languages, Kokoro for Spanish. The phone speaks the word if the server voice is missing. Settings chooses voice gender.
- **Music style.** Any, pop, rock, hip-hop, or reggaeton. Changing style refreshes the word queue.
- **Song search.** Find a song and learn a word from its lyric.
- **Library.** Harmonix playlists and Spotify playlists, with export from Harmonix to Spotify. A recent word opens its card.
- **Practice.** Spaced review, with the streak and the daily goal on the Word screen.

## Stack

| Layer | Technology |
|-------|------------|
| API | Node.js, Express, SQLite |
| Web | Next.js App Router, Tailwind v4 |
| Android | Flutter (`mobile/`) |
| AI | NVIDIA NIM, with OpenRouter as fallback |
| Music | Deezer, iTunes, LRCLib, Spotify Web API and Web Playback SDK |
| Voice | Pocket-TTS on `:3002`, Kokoro on `:3003` for Spanish |

## Repository

```text
server/     Express API, SQLite, Spotify, voice, and daily-word services
client/     Next.js website
mobile/     Flutter Android app, the Play Store build
docs/       Runbooks for deploy, Spotify, mobile, and releases
.planning/  Roadmap and phase notes
```

Brand files live in `client/public/` (`logo-mark.png`, `logo-light.png`, `logo-dark.png`). The Play Store app is the Flutter project. The Capacitor project under `client/android/` is not shipped.

## Develop

API:

```bash
cd server
cp .env.example .env
npm install
npm start
```

The API listens on port 3001. Fill `JWT_*`, the AI keys, and Spotify in `.env` as needed.

Website:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

The dev server listens on port 3009.

## Deploy

Pushes to `main` run GitHub Actions: tests, then a deploy to the VPS with `scripts/coolify-redeploy.sh`. The public site is [harmonix.peeporunclub.co.uk](https://harmonix.peeporunclub.co.uk).

Pocket-TTS 4.0.1 stays on the host at `:3002`. Kokoro stays at `:3003` and speaks Spanish. A deploy restarts Pocket-TTS and leaves Kokoro running.

If Actions is unavailable:

```bash
cd /home/ubuntu/lyric
git fetch origin main && git reset --hard origin/main
HARMONIX_REDEPLOY_BOOTED=1 bash scripts/coolify-redeploy.sh
```

See [docs/COOLIFY-DEPLOY.md](./docs/COOLIFY-DEPLOY.md). The older host script is `bash run_env.sh`.

## Security

Do not commit `.env`. Only `.env.example` belongs in git. Spotify tokens are encrypted at rest, and refresh stays on the server. OAuth uses PKCE. See [SECURITY.md](./SECURITY.md).

## Tests

GitHub Actions runs these on every push to `main`:

```bash
cd server && npm test
cd client && node --experimental-strip-types --test 'src/lib/*.test.ts'
cd mobile && flutter analyze --fatal-infos && flutter test
```

## Releases

The website has no store version. It ships from `main`. The Android build on Play closed testing is 1.0.18 (version code 21). Version code 22 is in this repo and is not on Play.

<!-- x-release-please-start-version -->
**Platform release:** 0.0.6
<!-- x-release-please-end -->

| Track | Version | Where |
|-------|---------|--------|
| Android on Play | 1.0.18 (version code 21) | Closed testing, tested 7 November 2026 |
| Android in this repo | 1.0.19 (version code 22) | `mobile/pubspec.yaml`. Bump this for every Play upload |
| Platform changelog | The platform release line above | `CHANGELOG.md` and [GitHub Releases](https://github.com/CiscoPonce/Harmonix/releases) |

The package id is `uk.co.peeporunclub.harmonix`. [release-please](https://github.com/googleapis/release-please) opens the changelog pull request from [Conventional Commits](https://www.conventionalcommits.org/). Do not commit APKs. Testers install from the Play closed test. An APK attached to a GitHub release is signed in CI and does not update a Play install. See [docs/PLAY-CONSOLE-LISTING.md](docs/PLAY-CONSOLE-LISTING.md).

## License

MIT. See [LICENSE](LICENSE).
