# Changelog

All notable changes to Harmonix are documented here. Releases are managed by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/).

## [0.0.3](https://github.com/CiscoPonce/Harmonix/compare/harmonix-v0.0.2...harmonix-v0.0.3) (2026-09-06)


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
* **admin:** add Spotify profile personalization and project testing dashboard ([4c037c1](https://github.com/CiscoPonce/Harmonix/commit/4c037c17708b101c513424723a35f1870bdba57b))
* **admin:** set admin permissions for cisco and tomcruise accounts ([4ae0dfb](https://github.com/CiscoPonce/Harmonix/commit/4ae0dfb2111c2713efa0ab042820bc060aa0aa74))
* **audio:** Spotify-first playback with Deezer fallback ([363f501](https://github.com/CiscoPonce/Harmonix/commit/363f501f6c9686407f1921f1032d308d439468c7))
* **brand:** ship Harmonix logo across web and ready the repo ([24c22bd](https://github.com/CiscoPonce/Harmonix/commit/24c22bd0bdc593f079bbd03233e4b4d91b2831e1))
* Coolify deploy path, Hear-it fallbacks, and shelf flip cards ([8ab1b95](https://github.com/CiscoPonce/Harmonix/commit/8ab1b95c3a8a8301e11757e3ab52ef44bc130215))
* **covers:** show Deezer album art on Harmonix playlists and songs ([2df4056](https://github.com/CiscoPonce/Harmonix/commit/2df4056719ee19705ce9f9bf1daed7a0840c3e0b))
* **daily-word:** verified song pool, queue reuse, and flip-card UI ([397218a](https://github.com/CiscoPonce/Harmonix/commit/397218a4072d72fc0c4f3d453d1cd9f3875e8bb0))
* **dailyWord:** personalize word candidates with Spotify top listening artists and genres ([454d38e](https://github.com/CiscoPonce/Harmonix/commit/454d38e1cf91a37e36cd19671ee23879759dd353))
* **discover:** learn a word from a searched song, with lyric-line sense ([d47f8c6](https://github.com/CiscoPonce/Harmonix/commit/d47f8c69403392b51df2e9123d59aaaab5655f77))
* **discover:** prioritize Word of the Day and drop promo tiles ([dfa4954](https://github.com/CiscoPonce/Harmonix/commit/dfa49547829dc01df158dc754b57cc905d1d9b2e))
* **discover:** tighter music-style match and meaningful lyric words ([ea30482](https://github.com/CiscoPonce/Harmonix/commit/ea304824be8ec554447204e3888134d74529fff9))
* Flutter mobile app, language reliability, and HQ pronunciation TTS ([a67eaa9](https://github.com/CiscoPonce/Harmonix/commit/a67eaa9d050eb5b04e60924b667180cb2bbb8946))
* harden daily word flow, improve auth UX, and refresh repo docs ([f485379](https://github.com/CiscoPonce/Harmonix/commit/f4853791f6738707ae2d3b33718b35126a261afe))
* **i18n:** add full UI internationalization across 6 home languages for Web and Mobile ([4a82d67](https://github.com/CiscoPonce/Harmonix/commit/4a82d677137bb6e77826997873646d5329148ea3))
* implement model fallback catalog and optimize word generation using single-prompt multi-candidate validation ([7d1d682](https://github.com/CiscoPonce/Harmonix/commit/7d1d68200167e1bfe37d43d93d0018ea63c0988d))
* interactive dashboard cards and user stats preservation on login ([94aa9d9](https://github.com/CiscoPonce/Harmonix/commit/94aa9d989f7ba7ec5ae2ff972922e12d474e4db0))
* Italian language, multi-lang song catalogs, and Android APK update ([6270ad0](https://github.com/CiscoPonce/Harmonix/commit/6270ad04586e26040e29d1825b4a1bd716351aac))
* **mobile:** Discover practice strip, shelf, review, Spotify chip ([b0547ab](https://github.com/CiscoPonce/Harmonix/commit/b0547ab26006ef25eba648ff079f7fcb4dc30803))
* **mobile:** dynamic play/pause toggle for Hear It button on Discover screen ([c027e59](https://github.com/CiscoPonce/Harmonix/commit/c027e59c1989106c324792b3eef182fae5f15fba))
* **mobile:** Flutter 001 — dark mode, louder TTS, Play Store prep ([5ac874d](https://github.com/CiscoPonce/Harmonix/commit/5ac874d7b165d808f9ad84c01f7dc0ee5c0c311f))
* **mobile:** Phase 16 Flutter Settings + web parity kickoff ([cfc87f7](https://github.com/CiscoPonce/Harmonix/commit/cfc87f7f157649fe16015c2b6f3e6d086a6269de))
* **mobile:** Phase 16 Settings parity + start flutter web-parity milestone ([d0b3be3](https://github.com/CiscoPonce/Harmonix/commit/d0b3be366ea5e69c9ba227fcc013dca32c04e683))
* **mobile:** required Phase 16 — playlist, 3D flips, Capacitor smoke ([d06d602](https://github.com/CiscoPonce/Harmonix/commit/d06d602a1cf75e0cc338b3021b548f0f186d7531))
* **phase-14:** ship production parity and player share/playlist actions ([7bffe48](https://github.com/CiscoPonce/Harmonix/commit/7bffe48c11588ef5c2e56cc99f97549284be4dd2))
* **phase8:** add web landing page, 3-step onboarding profile wizard, and mobile welcome screen ([f5f8171](https://github.com/CiscoPonce/Harmonix/commit/f5f817181c06fe27ac899a8d2f6664e3a938223f))
* **settings:** add voice gender and tidy the settings page ([1339c55](https://github.com/CiscoPonce/Harmonix/commit/1339c555a7825cff3eb9fa04591ada3fd9146a6a))
* **settings:** change home and learning languages in Settings ([e2930c9](https://github.com/CiscoPonce/Harmonix/commit/e2930c933101b3211d31a73683f9137bd9ad443d))
* **settings:** let users pick music style for daily words ([e13f7d0](https://github.com/CiscoPonce/Harmonix/commit/e13f7d0b7ba73e18d44606df1620572c979c68a4))
* **share:** combine postcard PNG with classic phone and PC shares ([1cd74c9](https://github.com/CiscoPonce/Harmonix/commit/1cd74c9aeb120eeda5c28c69418f126ed62d07c8))
* **share:** public word postcards with Spotify open link ([c2ac068](https://github.com/CiscoPonce/Harmonix/commit/c2ac068a345bcdeae5cfaf665b887f87fcf8a0b3))
* ship Phase 15 domain cutover with Hear-it sync and snappier TTS ([d72ffc7](https://github.com/CiscoPonce/Harmonix/commit/d72ffc73213ebb6c3376498b66b98c4e51a00e73))
* **tts:** integrate Kokoro-82M ONNX ARM-optimized engine as primary TTS service ([471687c](https://github.com/CiscoPonce/Harmonix/commit/471687c504cde36616134a98de94c7ba2c8cb219))
* **tts:** return native IPA phonemes from Kokoro-82M ONNX service for daily word cards ([1dea7da](https://github.com/CiscoPonce/Harmonix/commit/1dea7da93f4ee9f6d5d823b64c57b00007de5c9e))
* unify Discover and Learn into one home ([98135e1](https://github.com/CiscoPonce/Harmonix/commit/98135e1581038c3e1be47d0aa85bbe6e77de624e))
* **web:** ship Linguistic Resonance AppShell and Discover ([981d5cb](https://github.com/CiscoPonce/Harmonix/commit/981d5cb6671427489566daeb2be066c003a9b388))


### Bug Fixes

* **02-02:** fix TypeScript types in useSyncEngine hook ([b4626e4](https://github.com/CiscoPonce/Harmonix/commit/b4626e4aed5652a4899ade636ca2fdb856cffb44))
* **02-02:** handle malformed LRC strings gracefully ([c2af7c0](https://github.com/CiscoPonce/Harmonix/commit/c2af7c0b2f7ea40c077a09dddb8a956f3710c2bd))
* **ai:** switch to Muse Glimmer and OpenRouter Lightning ([d4e9ca1](https://github.com/CiscoPonce/Harmonix/commit/d4e9ca18da9e47a1c5273ba276672e40d7af1579))
* **android:** restore vertical scrolling in Capacitor WebView ([e849d3d](https://github.com/CiscoPonce/Harmonix/commit/e849d3d8355a15b46a2d6da3fcd21cd0efee7f32))
* **api:** expose detailed error message in pronounce endpoint for diagnostic ([b12b944](https://github.com/CiscoPonce/Harmonix/commit/b12b94457f6bc7e809730bd752156724757526d6))
* **api:** fix TypeError in pronounce route when user is null ([efcc2db](https://github.com/CiscoPonce/Harmonix/commit/efcc2db8b8d22e6744802e84c7f012d3218dd0d4))
* **auth:** add JWT fallback keys and safe .env loading in deploy script ([a98dfae](https://github.com/CiscoPonce/Harmonix/commit/a98dfae6df649c443801da7885068a4dc216f9f3))
* **auth:** make /api/daily-word/pronounce accessible for instant audio playback ([9726ee6](https://github.com/CiscoPonce/Harmonix/commit/9726ee6cb95c3883c041d86eab3c7381b144b856))
* **brand:** transparent logo with light/dark theme variants ([c95583f](https://github.com/CiscoPonce/Harmonix/commit/c95583f382d8ddbdc1df21333272bdc0f3fa6fd9))
* catch audio play rejections and handle geo-blocked preview errors gracefully ([0432ef9](https://github.com/CiscoPonce/Harmonix/commit/0432ef94c18e4e41a3d496bc3734a407828d9526))
* **ci:** include [@emnapi](https://github.com/emnapi) 1.11.3 in the web lockfile ([8b07d00](https://github.com/CiscoPonce/Harmonix/commit/8b07d00a07402a8d750bf359f4b5cac97b2d70e3))
* **client:** fix TypeScript build error in admin page and lib/api ([772e5ca](https://github.com/CiscoPonce/Harmonix/commit/772e5cadca1105fe624deb007b059a141a115d21))
* **daily-word:** aim Hear it at the word inside the lyric line ([ac733e1](https://github.com/CiscoPonce/Harmonix/commit/ac733e14731f4b006219fe2e704cd361b686cb7e))
* **daily-word:** align Hear it seek with Deezer 30s preview cut ([0a067de](https://github.com/CiscoPonce/Harmonix/commit/0a067de72ec6b44d036565d062b39c258c822b7c))
* **daily-word:** always prefer a new song for each new word ([a965bf7](https://github.com/CiscoPonce/Harmonix/commit/a965bf750343c41bf72a0c4bff64ab5c329f891d))
* **daily-word:** clear stuck stocking-queue state and coalesce batch requests ([b0b1b9e](https://github.com/CiscoPonce/Harmonix/commit/b0b1b9e105834b191c1ff9877e2f75cc2b7fcc8f))
* **daily-word:** fail-fast LRCLib lookups and enforce target language ([6e768e4](https://github.com/CiscoPonce/Harmonix/commit/6e768e40e5ff4056ab4f5f5d34de510decf1bdc6))
* **daily-word:** fill blank stored words from the glossary on boot ([e3c0f71](https://github.com/CiscoPonce/Harmonix/commit/e3c0f714e5511a2ff2b03ec2c8596b02f9f77fba))
* **daily-word:** honor music style and fix Hear-it seek ([6cd2145](https://github.com/CiscoPonce/Harmonix/commit/6cd2145b30572bc3be4deb2e217822513b961a5e))
* **daily-word:** improve German and multi-language generation reliability ([070d95b](https://github.com/CiscoPonce/Harmonix/commit/070d95ba4d86ed29cb4ff1f1819e46710c8c9629))
* **daily-word:** keep lyric sense for 'cause after the offline dict ([91918fa](https://github.com/CiscoPonce/Harmonix/commit/91918fac2bff97e9900daa1ce550f78239708e94))
* **daily-word:** keep Next Word instant; polish gloss in background ([f0e8192](https://github.com/CiscoPonce/Harmonix/commit/f0e819234db2ad1ee805a0ef6df6ca6b5848fdd7))
* **daily-word:** lengthen Hear it clips to ~7s around the word ([96e47c8](https://github.com/CiscoPonce/Harmonix/commit/96e47c830397b7a6f65a9145a51d5b3928a60b27))
* **daily-word:** longer line-anchored Hear it clips ([149e356](https://github.com/CiscoPonce/Harmonix/commit/149e3560fe0ecee4d26844b8608177afebecc39b))
* **daily-word:** make Next word fast and actually stock a batch ([266d32f](https://github.com/CiscoPonce/Harmonix/commit/266d32f2c045282322f0107d997ebcc9595abe1b))
* **daily-word:** never block Hear it on Spotify SDK hang ([e6877fb](https://github.com/CiscoPonce/Harmonix/commit/e6877fb21f80f198dacbb1a3eb3159faa9bee566))
* **daily-word:** offline en→es glossary so cards like until keep a meaning ([29a3dc9](https://github.com/CiscoPonce/Harmonix/commit/29a3dc95a853b3d7c4129a6c11c01f0afafe9516))
* **daily-word:** one new song per card and provisional stem glosses ([2e010e2](https://github.com/CiscoPonce/Harmonix/commit/2e010e28e48e17a1d6b61128ec274467b37ee19d))
* **daily-word:** overwrite home/planes/time/rule first-hit glosses ([d384b5c](https://github.com/CiscoPonce/Harmonix/commit/d384b5c7c743cb771edf2245e778773b16f01870))
* **daily-word:** persist glosses so Word of the Day keeps a meaning ([b7f227e](https://github.com/CiscoPonce/Harmonix/commit/b7f227ee6f5d7727b2846fea20b8ea3ee0bff719))
* **daily-word:** replace broken Open full player with Share and playlist ([587b3e5](https://github.com/CiscoPonce/Harmonix/commit/587b3e5065bcc8342e7bf9d4367954d777142f99))
* **daily-word:** ship a 21k-word offline en→es dictionary ([f403bbe](https://github.com/CiscoPonce/Harmonix/commit/f403bbeaa2c18797f0d733a712cee793894ac88e))
* **daily-word:** skip lyric names and pick a translatable hook ([3f9735f](https://github.com/CiscoPonce/Harmonix/commit/3f9735f28671df530849360fd13352cb579a8468))
* **daily-word:** stock a batch again after the first word ([b25bcc1](https://github.com/CiscoPonce/Harmonix/commit/b25bcc118ee770456548f59ed15f56a457e567ba))
* **daily-word:** stop blocking Next word on Muse and reject junk glosses ([20faa04](https://github.com/CiscoPonce/Harmonix/commit/20faa041b83df4c7ce0e38f2e1dac6fb8773708b))
* **daily-word:** stop forging genre labels onto wrong songs ([f9ece95](https://github.com/CiscoPonce/Harmonix/commit/f9ece953f65fe1902e87715c2e5ec6252e094017))
* **daily-word:** stop idiom calques in word translations ([9e4c72e](https://github.com/CiscoPonce/Harmonix/commit/9e4c72ebf73c23892f9d79cefd700917585359e0))
* **daily-word:** stop shipping wrong WOTD translations ([24ea30b](https://github.com/CiscoPonce/Harmonix/commit/24ea30bd45817272be800cd26968dc1ee93145b0))
* **daily-word:** stop shipping wrong WOTD translations ([591bf82](https://github.com/CiscoPonce/Harmonix/commit/591bf82d4f0fbb17e7846ddc22973848f5f11255))
* **daily-word:** translate hand as mano, not cacho ([dc52506](https://github.com/CiscoPonce/Harmonix/commit/dc525069f2302da8831a6c5de7c69cf0cafaa0f3))
* **daily-word:** unblock Next, friendly errors, Hear-it provider ([2e3d9e3](https://github.com/CiscoPonce/Harmonix/commit/2e3d9e37e69af4fb2db9865bd78a22d130b232f8))
* **db:** add 10s SQLite busy_timeout and add container logs dump on deploy failure ([e3fd202](https://github.com/CiscoPonce/Harmonix/commit/e3fd2026fec51e281f24f3b640ba3eeb2c8227ce))
* **deploy:** accept redirect status codes in wait_https helper ([5a500af](https://github.com/CiscoPonce/Harmonix/commit/5a500af5628c643e9b6aac7a66deeec804927c39))
* **deploy:** add /api/health endpoint and update wait_container_http in coolify-redeploy.sh ([34eb7cb](https://github.com/CiscoPonce/Harmonix/commit/34eb7cb52c6a7d9135e2ee37262b6305678e6509))
* **deploy:** attach Coolify standbys to the compose default network ([17fe0b0](https://github.com/CiscoPonce/Harmonix/commit/17fe0b0fd0aab07b7f02af0a4fd021b7b164adb1))
* **deploy:** connect API_STANDBY to default network to allow proxying to web ([d5f2d75](https://github.com/CiscoPonce/Harmonix/commit/d5f2d756c4bf29d3699f9e1293fdf8ba6944499c))
* **deploy:** connect web standby to default network and refine deployment flow ([526067e](https://github.com/CiscoPonce/Harmonix/commit/526067ecc1a2c1eb7099c4572e3db315d18907ee))
* **deploy:** ensure db directory exists and simplify standby healthcheck ([04a2ceb](https://github.com/CiscoPonce/Harmonix/commit/04a2ceb9781838cacc4a01a821b76b7677992ff0))
* **deploy:** fix cp same file error when WORKDIR equals PROJECT ([dac08b6](https://github.com/CiscoPonce/Harmonix/commit/dac08b64b2e3bca0edc519180ffdebd18309cda6))
* **deploy:** force docker compose build api in coolify-redeploy.sh ([17bacf1](https://github.com/CiscoPonce/Harmonix/commit/17bacf1e46927532071104b9ecf2e6a19df50480))
* **deploy:** give Coolify standbys the live API secrets ([8108b6e](https://github.com/CiscoPonce/Harmonix/commit/8108b6e9bfabfca34162b3c6df1eae6257c6e5be))
* **deploy:** keep web DNS alias alive during cutover ([e064e88](https://github.com/CiscoPonce/Harmonix/commit/e064e883e9f6bf28f7ce4a874b04673fbfadd854))
* **deploy:** overlay Coolify provider keys on API standbys ([b3d016e](https://github.com/CiscoPonce/Harmonix/commit/b3d016e505dc517db4ad6ce84b654228fe9d4531))
* **deploy:** pull before redeploy so CI never runs a stale script ([6f7a0fe](https://github.com/CiscoPonce/Harmonix/commit/6f7a0fee3b51dde4528aa2927ebe2a03cb1cbc3e))
* **deploy:** rsync PROJECT to Coolify WORKDIR in coolify-redeploy.sh before building ([7bcfad1](https://github.com/CiscoPonce/Harmonix/commit/7bcfad1f9dc3308066a43cacca1e6ca9d52b61b9))
* **deploy:** set container_name in docker-compose.yml so compose replaces active Coolify container ([2c86d34](https://github.com/CiscoPonce/Harmonix/commit/2c86d34307727e44826e9a69be81735db3bcadd8))
* **deploy:** sync all Coolify service dirs and add fallback WORKDIR ([a10a518](https://github.com/CiscoPonce/Harmonix/commit/a10a51803e451db87bb6ccbdb30494c5fdd7452b))
* **deploy:** sync PROJECT to Coolify WORKDIR in workflow + force --no-cache rebuild ([076563e](https://github.com/CiscoPonce/Harmonix/commit/076563eb1737006546209cefb59c518c727b261a))
* **deploy:** use run_compose build api web with project directory and UUID in coolify-redeploy.sh ([4e1240b](https://github.com/CiscoPonce/Harmonix/commit/4e1240b8f9b8a7f0d9e2f0b8013302990b8a9b26))
* **deploy:** use sudo docker rm -f for reliable standby cleanup ([c568a71](https://github.com/CiscoPonce/Harmonix/commit/c568a718c29d2a89aee02fbc5892329b1ed25cec))
* **deploy:** zero-downtime Coolify redeploy on push ([8207479](https://github.com/CiscoPonce/Harmonix/commit/82074790e61bf04697afca97160a5ca3f908ec31))
* **discover:** fix 3D flip card structure on DailyWordCard ([dc57814](https://github.com/CiscoPonce/Harmonix/commit/dc578149d0243039325b6f8681a120f02c67e4be))
* **discover:** never open karaoke from song search ([8626136](https://github.com/CiscoPonce/Harmonix/commit/8626136650049b7e74db05c28b9b08c3f2b158f3))
* **discover:** put Word of the Day first without section titles ([0cde33b](https://github.com/CiscoPonce/Harmonix/commit/0cde33ba6fef4ac515395b371305609a9911ce2d))
* **docker:** add libespeak-ng-dev and fallback synthesis handling for production containers ([e96c978](https://github.com/CiscoPonce/Harmonix/commit/e96c978857602025b4c8e5ffca4979385013e20c))
* **docker:** add libgomp1 OpenMP dependency for ONNX runtime on Debian ARM Docker container ([cee579e](https://github.com/CiscoPonce/Harmonix/commit/cee579e90b2a27cdddf09902544926b4f9e9095c))
* **docker:** install python3, venv, espeak-ng, kokoro-onnx in production runner image ([13a7cd0](https://github.com/CiscoPonce/Harmonix/commit/13a7cd0d464abcf8231787de6d7ff5e238ae8361))
* **docker:** pre-download Kokoro-82M ONNX model files in production image for instant TTS ([e513d87](https://github.com/CiscoPonce/Harmonix/commit/e513d87e95762d447b01b688b1371fb95a71ab2e))
* **docker:** remove scripts from .dockerignore and explicitly copy scripts into runner stage ([d66e18d](https://github.com/CiscoPonce/Harmonix/commit/d66e18da0d96fd7a6ab965c1ef166b16c9ced963))
* **docker:** set explicit image tags lyric-api:latest and lyric-web:latest in docker-compose.yml ([80c81f7](https://github.com/CiscoPonce/Harmonix/commit/80c81f7c3648df833f92dcebe00b5261905c910c))
* **docker:** set explicit UID 999 for harmonix user and 777 perms for SQLite data volume ([b616630](https://github.com/CiscoPonce/Harmonix/commit/b6166308cf7c519d47add21d9fb14b4389a19717))
* **i18n:** complete translation coverage across flip card prompts, headers, meaning labels, modals, and navigation ([6830155](https://github.com/CiscoPonce/Harmonix/commit/683015516c48440f0189f9db482fcb8343cb709e))
* keep German (and other) WOTD songs/words in the target language ([143b75d](https://github.com/CiscoPonce/Harmonix/commit/143b75dd89a7336920dfd6ea5f91ce1ce976bd1a))
* **landing:** map all header nav section links, add cover art & fix title overflow in phone mockup ([eae38c0](https://github.com/CiscoPonce/Harmonix/commit/eae38c0337bf7ca4e54b59accb864887b3af7274))
* LanguageBadge link, AI model order, audio preview validation, learned vocab endpoint ([51a861e](https://github.com/CiscoPonce/Harmonix/commit/51a861eb68e51c3b7162c80a727eed06c9b140ed))
* **library:** keep Spotify status only in header ([888d11c](https://github.com/CiscoPonce/Harmonix/commit/888d11cb5594feabeb08197bcbc49124fb25aeb3))
* **library:** show Spotify account when connected ([a20cf22](https://github.com/CiscoPonce/Harmonix/commit/a20cf221452820b83016bfa51716becee08dbda4))
* **mobile:** release audio player state and use timestamped temp file for repeat pronunciation playback ([0b3415f](https://github.com/CiscoPonce/Harmonix/commit/0b3415f3098123c6d8d1ced4a4197707c702fe71))
* **mobile:** show song titles in Spotify export match report ([556dd8a](https://github.com/CiscoPonce/Harmonix/commit/556dd8aac3a813ac0200e4d6c5d73f31b21b8b2e))
* **player:** correct preview seek, full-player link, Spotify play scopes ([9bc489d](https://github.com/CiscoPonce/Harmonix/commit/9bc489db274f3c8f11d4c88410adfaf9d1ab9915))
* **player:** fall back to Deezer 30s and add Open in Spotify ([104e744](https://github.com/CiscoPonce/Harmonix/commit/104e744d32b7db3cb1305c094ff795d1142b63c3))
* **playlists:** show added toast and refresh lists after add ([f0e6a5c](https://github.com/CiscoPonce/Harmonix/commit/f0e6a5c615704472c8acde9bea35f444291f98e9))
* **prod:** harden auth, lock Play Store to Flutter, and fix WOTD gloss + TTS ([a852bb9](https://github.com/CiscoPonce/Harmonix/commit/a852bb905579a2d7ab0923af93a44f1b21528a3e))
* **search:** fall back to iTunes when Deezer 403s Discover ([ce5163b](https://github.com/CiscoPonce/Harmonix/commit/ce5163bdd6e1011b27ee63e26337d0ce4a3f347b))
* settings auto-save and hear-it preview sync ([62c93fc](https://github.com/CiscoPonce/Harmonix/commit/62c93fc97172c957248ea224d39a5a380b0516b4))
* **share-playlist:** send JSON Content-Type and copy player deep links ([bce0660](https://github.com/CiscoPonce/Harmonix/commit/bce0660d72dafd17f1421e503d68766f0d75d18e))
* **share:** composite album cover into word postcard PNG ([a6d9b7c](https://github.com/CiscoPonce/Harmonix/commit/a6d9b7c5a25f9a5072fe7fd74671bd90992bbc38))
* **share:** rich WhatsApp postcard preview with OG image ([691edc8](https://github.com/CiscoPonce/Harmonix/commit/691edc80bbc910bb9d1fb2611ad56a41b190f0dd))
* **share:** send postcard image to WhatsApp instead of bare ngrok link ([d928683](https://github.com/CiscoPonce/Harmonix/commit/d928683d862de2b7fe97e08b2f682bc5b35bc252))
* **shelf:** Open song goes to Spotify, not Apple/iTunes player ([8c21705](https://github.com/CiscoPonce/Harmonix/commit/8c217056606283e79a25eb958c8bea896c8d9904))
* **spotify-export:** convert Deezer seconds to ms for matching ([560b6c5](https://github.com/CiscoPonce/Harmonix/commit/560b6c5355cec5559c562519669c6ebbf528494b))
* **spotify:** add short /callback redirect alias for Dashboard matching ([22eb37e](https://github.com/CiscoPonce/Harmonix/commit/22eb37eb83c5f68f4d3ba8c93358b83c4201846e))
* **spotify:** queue per-user API admission instead of rejecting ([efe196f](https://github.com/CiscoPonce/Harmonix/commit/efe196f2180d401cc3e4efff961c90cd2d09d080))
* **spotify:** shorten OAuth redirect URI and show Dashboard copy hint ([4638cb0](https://github.com/CiscoPonce/Harmonix/commit/4638cb0eb72ff946268094228dd7055bb5855a2a))
* **spotify:** unlock Web Playback autoplay for Hear it ([b25933c](https://github.com/CiscoPonce/Harmonix/commit/b25933cf90a4096dda9da4b88e4a7b12b8e3158f))
* **tracks:** pass iTunes artist name into the preview URL ([4bbd650](https://github.com/CiscoPonce/Harmonix/commit/4bbd65025a44b500d11f14619c13b9268137e4b5))
* **tts:** add silent WAV fallback buffer so pronunciation route never returns 502 ([c8ff506](https://github.com/CiscoPonce/Harmonix/commit/c8ff506aacbe3fbf28c29ec91da15fc22c78d69f))
* **tts:** ensure kokoroService returns valid 16-bit RIFF WAV buffers with lang query param support ([aa6934e](https://github.com/CiscoPonce/Harmonix/commit/aa6934ecdfd000abe6e0d5bf4fb286fb8c34bde0))
* **tts:** fix Italian voice assignment (fiammetta/marcos) and add accent restoration for all 6 languages ([5216310](https://github.com/CiscoPonce/Harmonix/commit/521631053cbf51cce349255d3d3acc1d7e4dcef9))
* **tts:** improve daemon readiness timeout and map native voices for all 6 languages ([3b03120](https://github.com/CiscoPonce/Harmonix/commit/3b03120c83a0d82853c12cdb9c793de36a90f9b6))
* **tts:** remove volume overdrive, atempo phase distortion, and normalize clean peaks ([2cffc8d](https://github.com/CiscoPonce/Harmonix/commit/2cffc8d24e073a9ada400192b52f932af8d73069))
* **tts:** ship ffmpeg in API image for snappy pronunciation ([fe64162](https://github.com/CiscoPonce/Harmonix/commit/fe6416250de50dfc215a80c5477b795703a951a8))
* **tts:** update TTS_BASE_URL from stale 10.0.0.15 IP to host.docker.internal ([ff4e082](https://github.com/CiscoPonce/Harmonix/commit/ff4e08234e22b1a819d6bd1974cd6456b7e912a9))
* **ui:** ensure pronunciation guide and part_of_speech badge never disappear ([93874c3](https://github.com/CiscoPonce/Harmonix/commit/93874c32ed0fb547e22cd711b8313cd23a0f47f8))
* **ui:** put Open in Spotify outside the 3D flip card ([daed5a1](https://github.com/CiscoPonce/Harmonix/commit/daed5a1fca49c90b1f364c318b2d3a624f4bb604))
* **ui:** remove forced uppercase and tight italic tracking overlap on ligatures like œurs ([8e4b210](https://github.com/CiscoPonce/Harmonix/commit/8e4b21058c792a5342d7ee200a6879be7517c791))
* **ui:** remove placeholder Pro Plan upgrade card ([3bd376c](https://github.com/CiscoPonce/Harmonix/commit/3bd376ce436575fbfe3a407e6b9dcfec835a0340))
* **ui:** remove wordy hero copy from mobile dashboard ([b6883a1](https://github.com/CiscoPonce/Harmonix/commit/b6883a12c6e915f47eb1a5a842fafce67fe03b14))
* **ui:** restore Pro Plan and pin sidebar full height ([183d38d](https://github.com/CiscoPonce/Harmonix/commit/183d38d51b9448e311a708af7131320d7058ae57))
* **ui:** theme-aware Input for light-mode Library create field ([f1148ca](https://github.com/CiscoPonce/Harmonix/commit/f1148ca6320c8ae20ac08b5b86689dcc0999015e))
* **web:** expose Settings in AppHeader so /settings is reachable ([4ce7419](https://github.com/CiscoPonce/Harmonix/commit/4ce7419168f537c716a27f134c15356e7105fb66))
* **web:** keep daily word usable during cold generate ([485a056](https://github.com/CiscoPonce/Harmonix/commit/485a056cdb425d4eb4b9261b798738c37ec5a781))
* **web:** move Open full player outside flip card ([ab3210a](https://github.com/CiscoPonce/Harmonix/commit/ab3210ab3259c76e6609b3b8c7e13edc54a9d187))
* **web:** resolve Next.js playlist route slug conflict ([33eab61](https://github.com/CiscoPonce/Harmonix/commit/33eab61aa1e011aa4e2c1e89fd3f799254410164))
* **web:** restore dark mode on AppShell and add Spotify in-app play ([a03521b](https://github.com/CiscoPonce/Harmonix/commit/a03521bf07102ba3d8bfc71ef201c4bb9b786642))
* **web:** settings avatar, unlimited new words, clearer Spotify play ([76ad3e5](https://github.com/CiscoPonce/Harmonix/commit/76ad3e55a626ceed3d31af77a1508d613af259f6))


### Performance Improvements

* **daily-word:** deliver first valid word without waiting for full batch ([53f9017](https://github.com/CiscoPonce/Harmonix/commit/53f9017eb0443ea588fd4b768aa4d6c03ddc2236))
* **daily-word:** use curated hits first and unblock user from background refill ([d9ccaf2](https://github.com/CiscoPonce/Harmonix/commit/d9ccaf2ab7d7b900eb146e3b04958821fcd33872))
* **tts:** optimize ONNX ARM thread tuning and PCM silence trimming for instant audio start ([a608e18](https://github.com/CiscoPonce/Harmonix/commit/a608e185eebe91c48d83877ebbf547ad1ae48655))


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
* **12.6:** plan Spotify in-app playback phase ([d876e04](https://github.com/CiscoPonce/Harmonix/commit/d876e04448ccf3fc7adffbc980c40eb0fd5253e8))
* **12:** mark Phase 12 code-complete with live Connect gate status ([0b3b36c](https://github.com/CiscoPonce/Harmonix/commit/0b3b36ce6757c53aaf908489cec6b9844f67c21b))
* add Play Store publishing guide ([7eaad52](https://github.com/CiscoPonce/Harmonix/commit/7eaad526f0729a3b3e52360cf5449ee381e29e3a))
* align repo with Coolify production domain ([3bf26cb](https://github.com/CiscoPonce/Harmonix/commit/3bf26cb62e5c61eb034d226199735620e8946107))
* **architecture:** refresh app-flow and backend diagrams ([d1b5834](https://github.com/CiscoPonce/Harmonix/commit/d1b583474a9f691c4cae37e58aede14d547d4b8b))
* changelog for Flutter Discover parity ([cf4a07b](https://github.com/CiscoPonce/Harmonix/commit/cf4a07b1d841dcc1e8ddd2424f08d60c5097d3b5))
* changelog for unique-song daily-word fix ([090ac65](https://github.com/CiscoPonce/Harmonix/commit/090ac6520d07d1966e937a0da823740063a56307))
* changelog for WOTD translation quality fix ([62a3328](https://github.com/CiscoPonce/Harmonix/commit/62a3328641cb23ecf84d44855d7e4a6854da4ccb))
* changelog, deploy runbook (backups), env example, state ([0d76be8](https://github.com/CiscoPonce/Harmonix/commit/0d76be83c8a52e98685ddc1c45d75a4d1d5667e4))
* complete project research ([3efa340](https://github.com/CiscoPonce/Harmonix/commit/3efa3403ad402972418a5efadb3efab34179d7e3))
* create project instructions ([9bf3c5e](https://github.com/CiscoPonce/Harmonix/commit/9bf3c5e87a68871aceeb03ae158fb70c5289c367))
* drop stale Coolify webhook note from README ([774a815](https://github.com/CiscoPonce/Harmonix/commit/774a8158a5c726fd37d14f43135114f4f2ba73b5))
* initialize project ([680b9e1](https://github.com/CiscoPonce/Harmonix/commit/680b9e10c733d48f9c694c9a05b3a2243261690c))
* mark Phase 8 and all phases as completed ([670cd06](https://github.com/CiscoPonce/Harmonix/commit/670cd06f0d1e1b942fc700cc583e5467603f3e3a))
* **mobile:** QA checklist for Phase 16 Settings prefs ([4732230](https://github.com/CiscoPonce/Harmonix/commit/473223026003507ece4b65af14b01cc6a9e8ebbe))
* **ops:** close Coolify domain cutover on peeporunclub.co.uk ([bf3417c](https://github.com/CiscoPonce/Harmonix/commit/bf3417cecc12e8fa29369704583bdcb1f76c3bd2))
* **phase-17:** Play Store remaining steps and local JDK path ([d83b509](https://github.com/CiscoPonce/Harmonix/commit/d83b509ba6d704a9fe44fa1bee931d638b9c08eb))
* **planning:** close shipped phases and consolidate Phase 14 ([7589535](https://github.com/CiscoPonce/Harmonix/commit/758953543458a6e5756473054fb6e525eeb4a09c))
* **planning:** sync ROADMAP/STATE with shipped Spotify playback work ([6450dcf](https://github.com/CiscoPonce/Harmonix/commit/6450dcfbda66b3ec10805a43c1575ff3b61e3546))
* prefer Actions deploys; refresh Phase 15 state ([dc4a991](https://github.com/CiscoPonce/Harmonix/commit/dc4a99152fc4a020c839dcedb3b0fef12e1da8ab))
* refresh STATE/ROADMAP after main consolidation ([2882dcb](https://github.com/CiscoPonce/Harmonix/commit/2882dcb5ce72f275ecde9eea9fd2aecf08eef2e2))
* rename to WordWave and add MIT license ([fa96284](https://github.com/CiscoPonce/Harmonix/commit/fa9628425aaece699d5a44e284b0f91f2401ecfe))
* set default language to English (UK) in Play Store guide ([7d15f84](https://github.com/CiscoPonce/Harmonix/commit/7d15f84fd7ddb73121fca9b85b7e46c4d2a2f0f5))
* **state:** record accurate server test failure modes from audit ([818e365](https://github.com/CiscoPonce/Harmonix/commit/818e3652d179b8b4ebf8c8fac1b2f1990c7492e0))
* **store:** Play Console listing pack and domain support mailbox ([f6b00f8](https://github.com/CiscoPonce/Harmonix/commit/f6b00f8133dca4bbce5123ebc3f1a1f0060ed24f))
* sync roadmap and product docs with v1.7 polish ([4be2e27](https://github.com/CiscoPonce/Harmonix/commit/4be2e2725256a2452c11da0357d82e552f975218))
* update Play Store guide and build.gradle.kts for release builds ([5119c18](https://github.com/CiscoPonce/Harmonix/commit/5119c18f1bc30661855b49c3bd731bf98e121177))
* update STATE.md and ROADMAP.md for Phase 9 completion ([93892a2](https://github.com/CiscoPonce/Harmonix/commit/93892a2e02fb1f237c3ce7f77416ec8eee6523cd))

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
