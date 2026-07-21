---
phase: 12
slug: spotify-api-integration
status: code_complete_awaiting_live_gate
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-19
updated: 2026-07-21
matrix_run: 2026-07-20T00:18:44Z
live_gate: "Spotify Dashboard redirect URI must match VPS SPOTIFY_REDIRECT_URI"
---

# Phase 12 — Validation Strategy

## Current phase status (2026-07-21)

| Gate | Status |
|------|--------|
| Plans 12-01 … 12-10 implementation | Complete |
| Automated Spotify suites | Green (see 12-11-SUMMARY) |
| Deployed to VPS + `/settings` live | Complete |
| `SPOTIFY_CLIENT_ID` on VPS | Complete |
| Live OAuth Connect smoke | **Blocked** — Dashboard `redirect_uri: Not matching configuration` |
| UI/policy human approval | Open |
| Extended Quota public release | Not requested (sandbox-only) |

## Test Infrastructure

| Property | Value |
|---|---|
| Backend | Mocha 11.7.6 + Chai 6.2.2; focused commands by owning slice |
| Backend full suite | `cd server && NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= npm test` |
| Backend Spotify slice | `cd server && NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=… npx mocha services/spotify*.test.js routes/spotify*.test.js` |
| Flutter | `flutter_test`; focused files by owning slice |
| Flutter full suite | `cd mobile && flutter test` |
| Web Spotify | `cd client && npm run test:spotify` |
| Web build | `cd client && npm run build` |
| Web lint (repo-wide) | `cd client && npm run lint` — pre-existing failures outside Spotify files (see deferred-items) |
| Web lint (Spotify) | `cd client && npx eslint src/lib/spotifyContracts.ts src/lib/spotifyContracts.test.ts src/components/Spotify*.tsx` |
| Targeted latency | Under 30 seconds after Wave 0 ABI repair |

The installed `better-sqlite3` binary must be rebuilt for Node 24.13.0 before backend evidence is trusted. Controlled RED runners accept failure only when the requested sentinel is emitted by the intended absent-behavior assertion; syntax, fixture, loader, timeout, import/module-resolution, or unrelated setup failures fail the gate.

## Sampling Rate

- Run the focused command after every task.
- Run all suites relevant to a wave after that wave.
- Before `/gsd-verify-work`, run the complete local matrix plus the real Spotify sandbox/device gates.
- No watch-mode command is valid evidence.

## 12-10 Local Release Matrix (observed 2026-07-20)

| Step | Command | Exit | Notes |
|---|---|---:|---|
| ABI rebuild | `cd server && npm rebuild better-sqlite3` | 0 | Node v24.13.0 |
| Full backend suite | `NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= npm test` | 8 | **261 passing, 8 failing** — all failures in Daily Word / Pocket-TTS (timeouts, language assertion, missing `uvicorn`). Not Spotify. See deferred-items. |
| Spotify backend suite | `npx mocha` all `spotify*.test.js` / `routes/spotify*.test.js` | 0 | **69 passing** in 259ms |
| Web Spotify contracts | `npm run test:spotify` | 0 | All contracts green |
| Web lint (repo) | `npm run lint` | ≠0 | 8 pre-existing errors in non-Spotify files (deferred since 12-03) |
| Web lint (Spotify) | `npx eslint` Spotify contract + component paths | 0 | Clean |
| Web build | `npm run build` | 0 | Next.js 16.2.9 production build |
| Flutter tests | `flutter test` | 0 | All tests passed (40+) |
| Flutter analyze | `flutter analyze` | ≠0 | 1 **info** in `learn_screen.dart` (pre-existing, non-Spotify). `flutter analyze --no-fatal-infos` → 0 |
| Endpoint / AI searches | ripgrep legacy endpoints, popularity-as-match, Spotify→NIM | 0 | No `/users/{id}/playlists` or `/playlists/{id}/tracks`. Popularity stripped from ranking. No NIM/AI imports in Spotify match/export sources. |

**Nyquist / release decision:** `nyquist_compliant` remains `false` until full `npm test` and repo-wide `npm run lint` exit zero without suppression. Spotify Phase 12 automated surface is green; remaining blockers are out-of-scope Daily Word/TTS and legacy ESLint debt. Manual sandbox/device/UI/policy/quota gates remain in 12-11.

**Wave 0:** All Wave 0 RED harness files and Spotify test files exist on disk (`server/scripts/assert-red-contracts.js`, `mobile/tool/assert_red_spotify_tests.dart`, full Spotify Mocha + Flutter suites). `wave_0_complete: true`.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---|---:|---:|---|---|---|---|
| 12-W0-ABI | 12-02 | 0 | Test baseline | integration | `cd server && npm rebuild better-sqlite3 && npm test` | pass (ABI); full suite now has unrelated DW/TTS failures — see matrix |
| 12-RED-FOUNDATION | 12-02 | 0 | D-12-01,05,11,15 | controlled RED → green | promoted in 12-04; covered by Spotify mocha suite | pass |
| 12-RED-LIST | 12-02 | 0 | D-12-06,08,15 | controlled RED → green | promoted in 12-04 | pass |
| 12-RED-DETAIL | 12-02 | 0 | D-12-08,09 | controlled RED → green | promoted in 12-07 | pass |
| 12-RED-EXPORT-ROUTE | 12-02 | 0 | D-12-12–15 | controlled RED → green | promoted in 12-08 | pass |
| 12-RED-MATCH | 12-03 | 1 | D-12-12,13 | controlled RED → green | promoted in 12-08 | pass |
| 12-RED-EXPORT | 12-03 | 1 | D-12-12–15 | controlled RED → green | promoted in 12-08 | pass |
| 12-RED-MOBILE-LINK | 12-03 | 1 | D-12-02–04 | controlled RED → green | promoted in 12-06 | pass |
| 12-RED-MOBILE-LIST | 12-03 | 1 | D-12-06–08,10 | controlled RED → green | promoted in 12-06 | pass |
| 12-RED-MOBILE-DETAIL | 12-03 | 1 | D-12-08–10 | controlled RED → green | promoted in 12-07 | pass |
| 12-RED-MOBILE-EXPORT | 12-03 | 1 | D-12-10,13,15 | controlled RED → green | promoted in 12-09 | pass |
| 12-OAUTH-API | 12-04 | 1 | D-12-01,04,05,11,14,15 | unit/route | Spotify mocha OAuth/crypto/service/routes | pass |
| 12-LIST-API | 12-04 | 1 | D-12-06,08,15 | unit/route | Spotify mocha list service/routes | pass |
| 12-WEB-LINK-LIST | 12-05 | 2 | D-12-02–08 | contract/build | `test:spotify` + Spotify eslint + `build` | pass |
| 12-MOBILE-LINK-LIST | 12-06 | 3 | D-12-02–08,10 | widget | Flutter Spotify settings/deep-link/list | pass |
| 12-DETAIL | 12-07 | 4 | D-12-08–10,15 | route/build/widget | Spotify detail mocha + web contracts + Flutter detail | pass |
| 12-MATCH-EXPORT-WEB | 12-08 | 5 | D-12-12–15 | unit/route/build | Match/export mocha + web contracts + build | pass |
| 12-MOBILE-EXPORT | 12-09 | 6 | D-12-05,08,10,13,15 | widget/matrix | Flutter export + analyze `--no-fatal-infos` | pass |
| 12-LOCAL-RELEASE | 12-10 | 7 | D-12-01–15 | full matrix | See matrix table above | **partial** — Spotify surface green; full `npm test` + repo lint blocked by deferred debt |
| 12-EXTERNAL-GATES | 12-11 | 8 | D-12-01–15 | sandbox/device/human | Repeat Spotify-green matrix, then sandbox/App Link/UI/policy/quota | pending |

## Controlled RED Contract

`server/scripts/assert-red-contracts.js` runs only the explicit Mocha files passed before `--sentinel`. For matching, it must observe `NOT_IMPLEMENTED_SPOTIFY_MATCH` from the intended ranking/corpus assertion and must not run export files. For export, it must observe `NOT_IMPLEMENTED_SPOTIFY_EXPORT` from the intended orchestration assertion and must not rely on matcher failure. A missing sentinel or any syntax, fixture, import, loader, timeout, or unrelated setup error exits non-zero as an invalid RED result.

Flutter uses the equivalent explicit-file and required-sentinel contract in `mobile/tool/assert_red_spotify_tests.dart`.

## Promotion Order

- Foundation and list backend contracts enter normal Mocha in 12-04.
- Web Settings/Library contracts become browser-build green in 12-05.
- Flutter Settings/deep-link/list enter normal Flutter in 12-06.
- Detail enters normal backend/web/Flutter commands in 12-07.
- Matching/export enter normal backend/web commands in 12-08.
- Flutter export enters the normal suite in 12-09.
- No earlier plan invokes a later slice's normal green file.

## Manual-Only Verification

| Behavior | Why Manual | Owning plan |
|---|---|---:|
| Real Spotify OAuth, reconnect, list, and disconnect | Allowlisted Development Mode account required | 12-11 |
| Signed Android verified App Link | Controlled HTTPS host and signing fingerprint required | 12-11 |
| Real private playlist create/add and deep link | External Spotify side effect required | 12-11 |
| Responsive/accessibility/branding/policy | Human visual and policy approval required | 12-11 |
| Extended Quota release boundary | Provider entitlement cannot be automated | 12-11 |

Six-month expiry, deterministic 429 timing, zero-match, and controlled pre/post-create failure remain fault-injected automated evidence and must not be represented as real-sandbox observations.

## Validation Sign-Off

- [x] Every task has an automated command.
- [x] Matching and export RED commands are separate and require their own sentinel.
- [x] Every future slice moves from controlled RED to normal green only in its implementation plan.
- [x] Backend native ABI is repaired.
- [ ] All complete local suites pass (blocked: Daily Word/TTS full-suite failures; repo-wide ESLint).
- [x] Wave 0 files exist (`wave_0_complete: true`).
- [ ] `nyquist_compliant: true` — deferred until full matrix is green without suppression.

**Approval:** pending — Spotify automated surface ready for 12-11 external gates; full-repo Nyquist not claimed.
