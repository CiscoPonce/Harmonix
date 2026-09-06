# Changelog

All notable changes to Harmonix are documented here. Releases are managed by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Bug Fixes

* daily word: one song per card — extras from the same track are last-resort only, and Next prefers a new song when the queue has one
* gloss: stem/dictionary hits stay provisional (`gloss_v` 1) so AI polish can replace noun/verb mix-ups (`wondering` → preguntándose, not maravilla)

### Features

* Flutter: tap a search result to learn a word from that song (`POST /api/daily-word/from-track`, web parity); Spotify stays as a trailing icon
* Flutter: lyric line translation on the card back; Discover/Settings/nav fully translated (6 languages, `{var}` interpolation, plurals)
* Web: every visible string on Discover, the Word card, shelf cards and Settings is translated; ~90 new keys per language
* Daily word: three preview-window picks are tried before accepting a lyric outside the 30s clip; extras prefer preview lines so "Hear it" plays the word
* Ops: nightly SQLite backup (`scripts/backup-sqlite.sh`, systemd timer 03:30 UTC, 14-day retention)
* CI: deploy waits for server, web and Flutter test jobs; in-flight deploys are queued, not cancelled
* Settings: change password while signed in (`POST /api/auth/change-password`)
* Public `/privacy` and `/terms`; `/library` redirects to `/playlists`
* Play Store path is Flutter only (`mobile/`)
* unify Discover and Learn into one home (`/discover`; Learn nav removed)
* Settings music style (genre) for daily-word personalization
* Settings voice gender for Pocket-TTS pronunciation
* Flutter Settings: music style chips + voice gender (Phase 16 parity with web)
* Flutter Discover: practice strip, review, shelf, labeled Hear it / Open in Spotify
* Flutter WOTD: 3D flip cards + Add to playlist sheet; Capacitor production smoke script
* theme-aware Harmonix logos (light / dark / mark)
* Library header shows Spotify account when connected (`Spotify · {name}`)
* player: Open in Spotify when Web Playback SDK is unavailable
* public word postcards with rich WhatsApp / OG share
* Deezer album art on Harmonix playlists and songs
* Phase 14 production parity (popup OAuth, Flutter Settings languages, release runbook)

### Bug Fixes

* security: CORS no longer reflects every Origin with credentials — allowlist of same-origin, dev hosts and `CORS_ORIGINS`
* security: hardening headers (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, HSTS over TLS); `X-Powered-By` removed from Express and Next
* security: rate limits on login/register/refresh (20 per 15 min per IP), public Deezer/LRCLib proxies and `/pronounce`; register validates email and 8-char passwords; 256 kB JSON body limit
* ai: OpenRouter circuit breaker — after a 429 it is skipped for 2 minutes instead of 200+ consecutive failures; the fast gloss path fails instantly when both providers are cooling down
* tts: Pocket-TTS is tried first when the host daemon already serves the language; Kokoro remembers a missing Python runtime instead of spawning on every request
* web: Next 16.2.9 → 16.3.4 (security release); dead "Pro Plan / Upgrade" card and bell removed; footer Privacy/Terms are links
* tests: playlist route tests await async handlers; Kokoro integration test skips without `KOKORO_INTEGRATION=1`; web i18n test runnable under `node --test`
* security: unauthenticated password reset disabled (410)
* security: admin gate uses `is_admin` only (no email substring, no NODE_ENV bypass)
* security: production refuses default JWT secrets
* ops: healthcheck GET /api/health instead of fake logins
* deploy: attach Coolify standbys to compose `${uuid}_default` network (not a missing UUID network)
* deploy: copy live API env for standby (repo-root `.env` has no JWT; production refuses to boot)
* daily-word: persist accepted glosses (`gloss_cache`) so a later 429 storm still shows a meaning
* daily-word: pause MyMemory after its daily quota warning instead of treating the warning as a translation
* daily-word: English plurals hit the curated table (`nights` → `noches`) instead of a blank card
* web: Word of the Day shows “Meaning on its way…” and re-fetches until the gloss arrives
* planning: Phase 17 Play Store listing — remaining steps in `.planning/phases/17-play-store-listing/17-CHECKLIST.md`
* store: privacy/terms/footer use hello@peeporunclub.co.uk; Play listing pack + 1024×500 feature graphic
* tracks: iTunes metadata uses the artist name (not `[object Object]`) and opening-30s preview offset
* daily-word: hand → mano (offline dict had the junk sense cacho); same for skin/arms/ear/neck/chest
* daily-word: skip proper names in lyrics (Jude, Eleanor) and pick a translatable hook word instead
* search: Discover song search falls back to iTunes when Deezer 403s the VPS (same path as Word of the Day)
* daily-word: lyric-line sense (late→tarde, gets hard→se pone) plus an “in this line” gloss
* Discover: search a song and tap it to generate a Word of the Day from those lyrics
* Discover: song search never opens karaoke; Enter uses the first result; Discover HTML is not cached
* daily-word: keep batching after the first word so Next Word stays instant; search stocks extra words from the same song
* daily-word: skip failed AI song-pick when the catalog is used up; stock extra words from the first hit so Next word is instant
* daily-word: first card uses the dictionary table (world→mundo), rejects junk glosses like "las", and does not wait on Muse to stock the batch
* daily-word: overwrite software/geometry first-hits (home→hogar, planes→aviones, time→tiempo, rule→gobernar)
* ai: default NIM to Muse Glimmer (live ~0.7s gloss); OpenRouter to Nemotron 3.5 Lightning free; drop 410'd llama/nano/step models
* deploy: overlay rotated OpenRouter/NIM keys from Coolify .env so inspect-copy does not keep stale secrets
* daily-word: relax reuse when unused catalog keys collide on used Deezer IDs (`song_already_used`)
* daily-word: after true on-style exhaustion, widen honestly (`style_relaxed`) instead of 503
* daily-word: never show raw generation codes (e.g. `song_already_used`) on web or Flutter
* Discover: home-language chip separated from translation gloss (no more “when EN”)
* Flutter Hear-it: honor live `X-Harmonix-Preview-Provider` (iTunes fallback seek)
* daily-word: reject wrong-word glosses (e.g. COLOR→hope) and fall back to curated/dictionary translations
* daily-word: reject encyclopedic MyMemory junk (Genus Lama, Imam, int) and prefer lyric senses
* TTS: never speak English through the host Spanish Pocket-TTS model; do not cache silent WAVs
* TTS: pass Word of the Day `language_code` from web and Flutter; fix mercoledì / esta accent map
* daily-word: Settings music style hard-gates song picks (no mixed-catalog fallback; cache/queue honor genre)
* daily-word: stop forging AI/curated genre stamps; catalog genre is source of truth
* daily-word: Hear-it seeks the real preview window (provider-aware) on web + Flutter
* Discover: reload Word of the Day when Settings music style changes
* daily-word: prefer a new song for every new word (no same-track repeats until catalog exhausted)
* Library: keep Spotify status in header only (no duplicate Connected CTA)
* sidebar: pin full height and restore Pro Plan card
* player: fall back to Deezer 30s when Spotify SDK times out
* daily-word: Hear-it seek / Spotify admission / cold-generate reliability
* Spotify export: Deezer duration units and mobile match-report titles

### Documentation

* sync ROADMAP, STATE, README, PROJECT, REQUIREMENTS, and ops docs with v1.7 + post-ship polish
* Phase 15 Coolify cutover re-verified on `harmonix.peeporunclub.co.uk`; add host TTS systemd unit template

## [0.0.2](https://github.com/CiscoPonce/Harmonix/compare/harmonix-v0.0.1...harmonix-v0.0.2) (2026-07-21)


### Features

* **01-01:** implement auth endpoints ([ebad018](https://github.com/CiscoPonce/Harmonix/commit/ebad0189a187ab1ada10b3fabe1c356a0039ad0c))
* **01-01:** implement auth logic ([9f6a3f5](https://github.com/CiscoPonce/Harmonix/commit/9f6a3f50cb0d76c05fab02e8d1bebe0580846592))
* **01-01:** initialize backend and database ([e77aa06](https://github.com/CiscoPonce/Harmonix/commit/e77aa0639a1c726b6ac3434d3f60f4ee3ef53fa4))
* **01-02:** complete frontend scaffolding ([d150870](https://github.com/CiscoPonce/Harmonix/commit/d150870e73fafca570d47473dbae843e9fd60e2d))
* **01-02:** create minimalist base UI components ([36b5f7c](https://github.com/CiscoPonce/Harmonix/commit/36b5f7c2381abeae1cffdbde0cdbce5500f229b4))
* **01-02:** initialize frontend with high-contrast dark theme ([6b842b4](https://github.com/CiscoPonce/Harmonix/commit/6b842b4a804343cacb59d4c955ca09919b4ea135))
* **01-03:** implement API client, Auth Context, and useAuth hook ([34398c3](https://github.com/CiscoPonce/Harmonix/commit/34398c391063840de107951a73505b02a190c74b))
* **01-03:** implement login, register, and home pages ([580577e](https://github.com/CiscoPonce/Harmonix/commit/580577e9272cf7a4d0937a8d46cb4b42264200ca))
* **02-01:** implement Deezer and LRCLib proxy endpoints ([243d50f](https://github.com/CiscoPonce/Harmonix/commit/243d50f1089452a4c43013aa2d50514b0d85ae77))
* **02-02:** export seekTo with offset awareness and 30s clamping ([60aa3bb](https://github.com/CiscoPonce/Harmonix/commit/60aa3bbaf3aab8e4ff9bab63393d3b65f29b15d8))
* **02-02:** implement requestAnimationFrame sync loop with latency compensation ([969e303](https://github.com/CiscoPonce/Harmonix/commit/969e3036ca031e43a77a19084a6ce379ae341d28))
* **02-02:** setup useSyncEngine hook and install lrc-file-parser ([25542b3](https://github.com/CiscoPonce/Harmonix/commit/25542b32d6ab4ec0cfabb3e223a175261b83ff1f))
* **02-03:** build interactive LyricList component ([16f51e4](https://github.com/CiscoPonce/Harmonix/commit/16f51e40f115d1fe3f9203c15e14eb65944d52ac))
* **02-03:** build player page integration ([eff4558](https://github.com/CiscoPonce/Harmonix/commit/eff4558777eebe9bf252c06f3b0276cfcb28ad0e))
* **03-01:** finalize alignment utility and tests ([af55465](https://github.com/CiscoPonce/Harmonix/commit/af554655a9c5ca419247bab28d9ae8949d2f8aa3))
* **03-01:** implement NVIDIA NIM extraction service ([36a3411](https://github.com/CiscoPonce/Harmonix/commit/36a34114b40df16319a50fa65d7d09d27b293d10))
* **03-01:** update schema and install openai SDK ([9e1d489](https://github.com/CiscoPonce/Harmonix/commit/9e1d489c2e2a54bbf517e6b38e5aa050a7c23996))
* **03-02:** implement vocab api and persistence ([5837627](https://github.com/CiscoPonce/Harmonix/commit/583762701c8839288bc85a9478e6ad2ec53a8b8c))
* **03-03:** implement vocabulary popover, proficiency selector, and lyric highlighting ([13061b2](https://github.com/CiscoPonce/Harmonix/commit/13061b2dd67dbfa47133dab7364f1d20f29a8f46))
* **03-03:** integrate vocabulary and sidebar into Player page ([f223983](https://github.com/CiscoPonce/Harmonix/commit/f223983a4a0104897fc7cd680d665ea6629c3464))
* **07-01:** implement daily word flow and mark Phase 7 complete ([89dd723](https://github.com/CiscoPonce/Harmonix/commit/89dd723419e77d6696fa628e5aa453282d7b871f))
* **09-01A:** add badges route with per-user unlock status ([145d5a4](https://github.com/CiscoPonce/Harmonix/commit/145d5a497f1b7b2c95101b40d64816d0857f4371))
* **09-01A:** add playlist CRUD routes with ownership enforcement ([1268ff4](https://github.com/CiscoPonce/Harmonix/commit/1268ff4fd5d89ef758c93213c03038cc6c98d6ce))
* **09-01A:** add playlist/badge tables, native_language column, seed badges ([2f1b114](https://github.com/CiscoPonce/Harmonix/commit/2f1b114945889033a35392a90dcb7c033620de98))
* **09-01A:** add user preferences routes (GET/PATCH) ([9c8a68a](https://github.com/CiscoPonce/Harmonix/commit/9c8a68acc723eb5b311d625638fe84b1fce7651d))
* **09-01A:** create badge detection service with 5 badge checks ([33878d9](https://github.com/CiscoPonce/Harmonix/commit/33878d9c4ccf1286db7b75147ec6294381413bb9))
* **09-01B:** add badge detection to study finish, fix hardcoded language, add tests ([c96e67c](https://github.com/CiscoPonce/Harmonix/commit/c96e67c049ba9e96d46f2b2b7ca9cb1009397116))
* **09-01B:** extend User interface with language preference fields ([5c3087a](https://github.com/CiscoPonce/Harmonix/commit/5c3087ae0084a7a4590fffce16dad04e6c9c6701))
* **09-02:** add onboarding, SRS review, playlists list, and playlist detail pages ([07fc7c7](https://github.com/CiscoPonce/Harmonix/commit/07fc7c7b9daa5f2f272393c150e20b7147dc5b02))
* **09-03:** add badge grid, language badge, review count, and dashboard integration ([08aeacb](https://github.com/CiscoPonce/Harmonix/commit/08aeacb13b144412fa3297a2e529bf8f7dd440b0))
* **11-01:** add /pronounce route, pre-cache hooks, and tests ([71233ff](https://github.com/CiscoPonce/Harmonix/commit/71233ffb34a1523abc6fd4af7185760d8dae60c1))
* **11-01:** create DB migration, TTS daemon, and TTS service ([07c84ef](https://github.com/CiscoPonce/Harmonix/commit/07c84efcd5ab401a1b183c38190138da30e92d6f))
* **11-02:** add pronunciation button with audio playback to DailyWordCard ([dff8fea](https://github.com/CiscoPonce/Harmonix/commit/dff8fea2188115dbbaad38c986cc2a3e5c6795bf))
* **12-02:** implement OAuth state and AES-GCM token primitives ([418062d](https://github.com/CiscoPonce/Harmonix/commit/418062d6d4a25387ced16a18ec734b3f9cf8dbe1))
* **12-03:** add dependency-free web Spotify DTO contracts ([9846f49](https://github.com/CiscoPonce/Harmonix/commit/9846f4903aabf87d3a3197db86fac140630d01e2))
* **12-04:** implement Spotify OAuth status refresh and disconnect ([e7f66e5](https://github.com/CiscoPonce/Harmonix/commit/e7f66e5f9798567361bbf6b6590a5ca21c2895f7))
* **12-04:** sync user-scoped Spotify playlist snapshots ([04bf425](https://github.com/CiscoPonce/Harmonix/commit/04bf425c403cf9062866c739b9c04272ef3b4230))
* **12-05:** build web Settings Spotify connection journey ([b60c41e](https://github.com/CiscoPonce/Harmonix/commit/b60c41e99500fd2c1f64f99354be3baf0a01dbaf))
* **12-05:** render provider-separated Library with independent Spotify load ([5f5bd6b](https://github.com/CiscoPonce/Harmonix/commit/5f5bd6b98d8b74606d79fe9d8a4f6226d3bb4d11))
* **12-06:** build Android Settings Spotify connection card ([1639798](https://github.com/CiscoPonce/Harmonix/commit/1639798a3c949b15913ef7c51b5c5b30a4224bb5))
* **12-06:** render Android Library Spotify parity with isolated recovery ([881df9f](https://github.com/CiscoPonce/Harmonix/commit/881df9f3a2927c9b415ea220714ab2d15c398753))
* **12-06:** wire verified Android App Link outcomes to tab navigation ([8ece06a](https://github.com/CiscoPonce/Harmonix/commit/8ece06a4af40846f276cb596100a960d7391a1c4))
* **12-07:** add provider-aware Flutter Spotify playlist detail ([31c7252](https://github.com/CiscoPonce/Harmonix/commit/31c7252a6f3b8672c4ba7f243d568b247d41994f))
* **12-07:** add provider-aware web Spotify playlist detail ([c50f818](https://github.com/CiscoPonce/Harmonix/commit/c50f818e507863d40b54a6cdb9abca81d082fd03))
* **12-07:** implement Spotify playlist detail API with restricted handling ([13be00a](https://github.com/CiscoPonce/Harmonix/commit/13be00adeaf44d6d545261c49f60530bc82b3ffd))
* **12-08:** add web Spotify export dialog and match report ([73682f6](https://github.com/CiscoPonce/Harmonix/commit/73682f6a263bb8f86cc8582a3f771a59fd9cc4d3))
* **12-08:** implement validation-first Spotify match engine ([97d4e07](https://github.com/CiscoPonce/Harmonix/commit/97d4e076ad2078b4a060cda83aa65e0b816ec7e0))
* **12-08:** persist ownership-checked Spotify export jobs ([734906f](https://github.com/CiscoPonce/Harmonix/commit/734906fd0b86b6d0191e28bfd66dcdc16a8ac5b9))
* **12-09:** Android Spotify export sheet, report, and restore ([6d72e80](https://github.com/CiscoPonce/Harmonix/commit/6d72e800379b47da0693f8f37777181707cda1d8))
* add Phase 12 - Spotify API Integration ([4b3a21a](https://github.com/CiscoPonce/Harmonix/commit/4b3a21a0ccf17c90c1b1a04bf132090d208a5bc0))
* **daily-word:** verified song pool, queue reuse, and flip-card UI ([397218a](https://github.com/CiscoPonce/Harmonix/commit/397218a4072d72fc0c4f3d453d1cd9f3875e8bb0))
* Flutter mobile app, language reliability, and HQ pronunciation TTS ([a67eaa9](https://github.com/CiscoPonce/Harmonix/commit/a67eaa9d050eb5b04e60924b667180cb2bbb8946))
* harden daily word flow, improve auth UX, and refresh repo docs ([f485379](https://github.com/CiscoPonce/Harmonix/commit/f4853791f6738707ae2d3b33718b35126a261afe))
* implement model fallback catalog and optimize word generation using single-prompt multi-candidate validation ([7d1d682](https://github.com/CiscoPonce/Harmonix/commit/7d1d68200167e1bfe37d43d93d0018ea63c0988d))
* interactive dashboard cards and user stats preservation on login ([94aa9d9](https://github.com/CiscoPonce/Harmonix/commit/94aa9d989f7ba7ec5ae2ff972922e12d474e4db0))
* Italian language, multi-lang song catalogs, and Android APK update ([6270ad0](https://github.com/CiscoPonce/Harmonix/commit/6270ad04586e26040e29d1825b4a1bd716351aac))
* **mobile:** Flutter 001 — dark mode, louder TTS, Play Store prep ([5ac874d](https://github.com/CiscoPonce/Harmonix/commit/5ac874d7b165d808f9ad84c01f7dc0ee5c0c311f))


### Bug Fixes

* **02-02:** fix TypeScript types in useSyncEngine hook ([b4626e4](https://github.com/CiscoPonce/Harmonix/commit/b4626e4aed5652a4899ade636ca2fdb856cffb44))
* **02-02:** handle malformed LRC strings gracefully ([c2af7c0](https://github.com/CiscoPonce/Harmonix/commit/c2af7c0b2f7ea40c077a09dddb8a956f3710c2bd))
* **android:** restore vertical scrolling in Capacitor WebView ([e849d3d](https://github.com/CiscoPonce/Harmonix/commit/e849d3d8355a15b46a2d6da3fcd21cd0efee7f32))
* catch audio play rejections and handle geo-blocked preview errors gracefully ([0432ef9](https://github.com/CiscoPonce/Harmonix/commit/0432ef94c18e4e41a3d496bc3734a407828d9526))
* **daily-word:** clear stuck stocking-queue state and coalesce batch requests ([b0b1b9e](https://github.com/CiscoPonce/Harmonix/commit/b0b1b9e105834b191c1ff9877e2f75cc2b7fcc8f))
* **daily-word:** fail-fast LRCLib lookups and enforce target language ([6e768e4](https://github.com/CiscoPonce/Harmonix/commit/6e768e40e5ff4056ab4f5f5d34de510decf1bdc6))
* **daily-word:** improve German and multi-language generation reliability ([070d95b](https://github.com/CiscoPonce/Harmonix/commit/070d95ba4d86ed29cb4ff1f1819e46710c8c9629))
* keep German (and other) WOTD songs/words in the target language ([143b75d](https://github.com/CiscoPonce/Harmonix/commit/143b75dd89a7336920dfd6ea5f91ce1ce976bd1a))
* LanguageBadge link, AI model order, audio preview validation, learned vocab endpoint ([51a861e](https://github.com/CiscoPonce/Harmonix/commit/51a861eb68e51c3b7162c80a727eed06c9b140ed))
* **spotify:** add short /callback redirect alias for Dashboard matching ([22eb37e](https://github.com/CiscoPonce/Harmonix/commit/22eb37eb83c5f68f4d3ba8c93358b83c4201846e))
* **ui:** remove wordy hero copy from mobile dashboard ([b6883a1](https://github.com/CiscoPonce/Harmonix/commit/b6883a12c6e915f47eb1a5a842fafce67fe03b14))
* **web:** expose Settings in AppHeader so /settings is reachable ([4ce7419](https://github.com/CiscoPonce/Harmonix/commit/4ce7419168f537c716a27f134c15356e7105fb66))
* **web:** resolve Next.js playlist route slug conflict ([33eab61](https://github.com/CiscoPonce/Harmonix/commit/33eab61aa1e011aa4e2c1e89fd3f799254410164))


### Performance Improvements

* **daily-word:** deliver first valid word without waiting for full batch ([53f9017](https://github.com/CiscoPonce/Harmonix/commit/53f9017eb0443ea588fd4b768aa4d6c03ddc2236))
* **daily-word:** use curated hits first and unblock user from background refill ([d9ccaf2](https://github.com/CiscoPonce/Harmonix/commit/d9ccaf2ab7d7b900eb146e3b04958821fcd33872))


### Documentation

* **02-01:** complete Backend Media Proxy plan ([5edd40f](https://github.com/CiscoPonce/Harmonix/commit/5edd40f072ec63f9150a24134f9cf2e84aa8b7e3))
* **02-02:** complete Lyric Sync Engine Hook plan ([b35b524](https://github.com/CiscoPonce/Harmonix/commit/b35b524bbf05f2a1a703ceae10164cf97dbd9746))
* **02-03:** complete Karaoke UI Integration plan ([5898397](https://github.com/CiscoPonce/Harmonix/commit/58983972280410691b51dcede3146bfe2d2e1fca))
* **03-03:** complete Task 1 & 2 of Frontend Interactive Lyrics plan ([be86128](https://github.com/CiscoPonce/Harmonix/commit/be86128fcf1888b326e15fe1ad7ebbc317387e25))
* **03:** create implementation plan for AI vocabulary extraction ([319c3c4](https://github.com/CiscoPonce/Harmonix/commit/319c3c497841948ed39d8ebe316e12885f37f4b1))
* **03:** create implementation plan for AI vocabulary extraction ([7f4eee8](https://github.com/CiscoPonce/Harmonix/commit/7f4eee8e1a738199d0def7e718cd7fec8e16ac0b))
* **09-01A:** complete plan 01A summary ([4fa747c](https://github.com/CiscoPonce/Harmonix/commit/4fa747c8acef9ab204383bd439ef773ed7e27a81))
* **09-01B:** complete plan 01B summary ([fe2e5b9](https://github.com/CiscoPonce/Harmonix/commit/fe2e5b96e5ae941afb699eb65c62c8057ed82aa4))
* **09-02:** complete plan 02 summary ([fb73499](https://github.com/CiscoPonce/Harmonix/commit/fb73499ef5ab70bcb0e6b431eb88b040f4cbc122))
* **09-03:** complete plan 03 summary ([b987ec6](https://github.com/CiscoPonce/Harmonix/commit/b987ec656505f85db3fbae10f66e790ea02a325c))
* **09:** capture phase 9 context ([18831a6](https://github.com/CiscoPonce/Harmonix/commit/18831a65dc94d2f1760a7686d3302b8bd1115ad5))
* **09:** UI design contract ([9eb5a41](https://github.com/CiscoPonce/Harmonix/commit/9eb5a41c1e1acfa5a4a44844650c75235be1de54))
* **11:** create phase plan — backend TTS service + frontend pronunciation button ([2c101d7](https://github.com/CiscoPonce/Harmonix/commit/2c101d7311fb5653967da558e076d933e3835a51))
* **12-10:** add Spotify operations and release runbook ([2bcae51](https://github.com/CiscoPonce/Harmonix/commit/2bcae51188ffc13e17b67f7c6792743ddeabaf0a))
* **12.5:** plan Spotify popup OAuth and Library connect UX ([ba238e2](https://github.com/CiscoPonce/Harmonix/commit/ba238e2c6d1c05a22503988bce4230b0f7414cc4))
* **architecture:** refresh app-flow and backend diagrams ([d1b5834](https://github.com/CiscoPonce/Harmonix/commit/d1b583474a9f691c4cae37e58aede14d547d4b8b))
* complete project research ([3efa340](https://github.com/CiscoPonce/Harmonix/commit/3efa3403ad402972418a5efadb3efab34179d7e3))
* create project instructions ([9bf3c5e](https://github.com/CiscoPonce/Harmonix/commit/9bf3c5e87a68871aceeb03ae158fb70c5289c367))
* initialize project ([680b9e1](https://github.com/CiscoPonce/Harmonix/commit/680b9e10c733d48f9c694c9a05b3a2243261690c))
* mark Phase 8 and all phases as completed ([670cd06](https://github.com/CiscoPonce/Harmonix/commit/670cd06f0d1e1b942fc700cc583e5467603f3e3a))
* rename to WordWave and add MIT license ([fa96284](https://github.com/CiscoPonce/Harmonix/commit/fa9628425aaece699d5a44e284b0f91f2401ecfe))
* update STATE.md and ROADMAP.md for Phase 9 completion ([93892a2](https://github.com/CiscoPonce/Harmonix/commit/93892a2e02fb1f237c3ce7f77416ec8eee6523cd))

## [0.0.1](https://github.com/CiscoPonce/Harmonix/releases/tag/v0.0.1) (2026-06-28)

Initial release (v0.01).

### Features

* Word of the Day with song lyric context and audio previews
* Song search with AI vocabulary extraction validated against LRCLib and Deezer
* Progress tracking, streaks, and badge system
* Light and dark minimalist UI (Next.js PWA)
* Capacitor Android app (Option B) with sideload debug APK

### Bug Fixes

* Mobile login over ngrok (API headers and secure auth cookies)
* Mobile text layout overflow and clipping on small screens
