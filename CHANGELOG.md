# Changelog

All notable changes to Harmonix are documented here. Releases are managed by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/).

## [0.0.2](https://github.com/CiscoPonce/Harmonix/compare/harmonix-v0.0.1...harmonix-v0.0.2) (2026-07-02)


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
* **daily-word:** verified song pool, queue reuse, and flip-card UI ([397218a](https://github.com/CiscoPonce/Harmonix/commit/397218a4072d72fc0c4f3d453d1cd9f3875e8bb0))
* harden daily word flow, improve auth UX, and refresh repo docs ([f485379](https://github.com/CiscoPonce/Harmonix/commit/f4853791f6738707ae2d3b33718b35126a261afe))
* implement model fallback catalog and optimize word generation using single-prompt multi-candidate validation ([7d1d682](https://github.com/CiscoPonce/Harmonix/commit/7d1d68200167e1bfe37d43d93d0018ea63c0988d))
* interactive dashboard cards and user stats preservation on login ([94aa9d9](https://github.com/CiscoPonce/Harmonix/commit/94aa9d989f7ba7ec5ae2ff972922e12d474e4db0))
* Italian language, multi-lang song catalogs, and Android APK update ([6270ad0](https://github.com/CiscoPonce/Harmonix/commit/6270ad04586e26040e29d1825b4a1bd716351aac))


### Bug Fixes

* **02-02:** fix TypeScript types in useSyncEngine hook ([b4626e4](https://github.com/CiscoPonce/Harmonix/commit/b4626e4aed5652a4899ade636ca2fdb856cffb44))
* **02-02:** handle malformed LRC strings gracefully ([c2af7c0](https://github.com/CiscoPonce/Harmonix/commit/c2af7c0b2f7ea40c077a09dddb8a956f3710c2bd))
* **android:** restore vertical scrolling in Capacitor WebView ([e849d3d](https://github.com/CiscoPonce/Harmonix/commit/e849d3d8355a15b46a2d6da3fcd21cd0efee7f32))
* catch audio play rejections and handle geo-blocked preview errors gracefully ([0432ef9](https://github.com/CiscoPonce/Harmonix/commit/0432ef94c18e4e41a3d496bc3734a407828d9526))
* **daily-word:** clear stuck stocking-queue state and coalesce batch requests ([b0b1b9e](https://github.com/CiscoPonce/Harmonix/commit/b0b1b9e105834b191c1ff9877e2f75cc2b7fcc8f))
* **daily-word:** fail-fast LRCLib lookups and enforce target language ([6e768e4](https://github.com/CiscoPonce/Harmonix/commit/6e768e40e5ff4056ab4f5f5d34de510decf1bdc6))
* **daily-word:** improve German and multi-language generation reliability ([070d95b](https://github.com/CiscoPonce/Harmonix/commit/070d95ba4d86ed29cb4ff1f1819e46710c8c9629))
* LanguageBadge link, AI model order, audio preview validation, learned vocab endpoint ([51a861e](https://github.com/CiscoPonce/Harmonix/commit/51a861eb68e51c3b7162c80a727eed06c9b140ed))
* **ui:** remove wordy hero copy from mobile dashboard ([b6883a1](https://github.com/CiscoPonce/Harmonix/commit/b6883a12c6e915f47eb1a5a842fafce67fe03b14))


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
