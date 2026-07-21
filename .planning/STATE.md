---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: mobile-dual-frontend
status: in_progress
stopped_at: Phase 12 code complete on main+VPS — close 12-11 via Dashboard redirect URI + Connect smoke
last_updated: "2026-07-21T20:45:00.000Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 11
  completed_plans: 10
---

# Project State — Harmonix

## Current Focus

**Phase 12 — Spotify API Integration:** **code complete** (12-01–12-10) on GitHub `main` + VPS.

| Item | Status |
|------|--------|
| Implementation (web + Android + backend) | Done |
| Automated Spotify tests | Green |
| VPS deploy + `/settings` live | Done |
| `SPOTIFY_CLIENT_ID` on VPS | Done |
| Spotify Dashboard Redirect URI match | **Open** — `redirect_uri: Not matching configuration` |
| 12-11 live sandbox / UI / policy gates | **Open** |
| Phase 12.5 popup / Library Connect UX | Planned (after Connect works) |

**Required Redirect URI (exact):**  
`https://moral-sparrow-nationally.ngrok-free.app/api/spotify/oauth/callback`

Detail: [12-11-SUMMARY.md](./phases/12-spotify-api-integration/12-11-SUMMARY.md)

**Phase 12.5 — Spotify Connect UX (planned):** popup OAuth, Library inline Connect, onboarding prompt.  
Context: [12.5-CONTEXT.md](./phases/12.5-spotify-connect-ux/12.5-CONTEXT.md).

**Phase 10 — Option C in progress.** Flutter Android MVP lives in `mobile/` (light + dark-green Learn UI). Capacitor remains the temporary bridge APK until Flutter public launch (D-10-04).

**Phase 11 — Word Phonics TTS** implemented on backend + web DailyWordCard (HQ Pocket-TTS, SQLite cache, replayable speaker).

Language reliability Track A (catalogs, queue purge, per-lang stopwords, smoke gate) is complete — see `docs/LANGUAGE-RELIABILITY.md`.

## Phase 10 Progress

- [x] Plan 10-00A: Capacitor config + ngrok URL + env docs + sideload guide
- [ ] Plan 10-00B: Prerequisites — domain + Play Store
- [x] Plan 10-01: Capacitor Android project — debug APK in `releases/Harmonix-debug.apk`
- [ ] Plan 10-02: Option B — test & Google Play internal track
- [x] Plan 10-03: Option C — Flutter MVP (`mobile/`) matching light/green [UI spec](./phases/10-mobile-dual-frontend/10-UI-SPEC.md)
- [ ] Plan 10-04: Option C — test & dual-frontend parity
- [ ] Plan 10-05: Documentation & release runbook

## Phase 11 Progress

- [x] Plan 11-01: Backend TTS service + `/pronounce` + cache
- [x] Plan 11-02: Frontend pronunciation button (replayable)

## Phase 12 Progress

- [x] Plan 12-01: Resolve blocking Spotify callback/account/secret/policy facts
- [x] Plan 12-02: Backend Wave 0 ABI, OAuth/crypto foundation, adversarial contracts
- [x] Plan 12-03: Client/matching Wave 0 tests and labeled corpus
- [x] Plan 12-04: Backend OAuth/status/list foundation and API journey
- [x] Plan 12-05: Web Settings linking and provider-separated Library
- [x] Plan 12-06: Android linking, verified return, and Library parity
- [x] Plan 12-07: Provider-aware playlist detail on web and Android
- [x] Plan 12-08: Validation-first matching and web export report
- [x] Plan 12-09: Android export and resilience matrix
- [x] Plan 12-10: Automated release matrix and operations runbook
- [~] Plan 12-11: Sandbox/device/UI/policy/quota — **partial** (Client ID on VPS; Dashboard redirect URI + smoke remaining)

## Phase 12.5 Progress

- [ ] Plan 12.5-01: Web popup OAuth + callback postMessage (redirect fallback)
- [ ] Plan 12.5-02: Library inline Connect Spotify (shared auth hook)
- [ ] Plan 12.5-03: Optional onboarding connect prompt (web)
- [ ] Plan 12.5-04: Operator runbook + popup/Library tests

## Mobile design

- **Flutter SoT:** light background `#FFFFFF`, accent `#006432` — [10-UI-SPEC.md](./phases/10-mobile-dual-frontend/10-UI-SPEC.md)
- **4 tabs:** Discover · Library · Learn (default) · Settings
- **Option B:** Capacitor WebView (web UI) — still installable for A/B
- **Option C:** Flutter native — `mobile/`

## Target architecture (post–Phase 10)

```text
         ┌─────────────┐     ┌──────────────┐
         │  Next.js    │     │   Flutter    │
         │  (web)      │     │  (Android)   │
         └──────┬──────┘     └──────┬───────┘
                │                    │
                └────────┬───────────┘
                         ▼
                  Express API + SQLite
```

## Recent decisions

- **D-10-01:** Ship Option B before Option C — validate on real devices without rewriting UI.
- **D-10-02:** Backend stays single source of truth; both frontends consume `/api/*`.
- **D-10-03:** Test gate required between B → C (internal Play track + QA sign-off).
- **D-10-04:** Deprecate Capacitor after Flutter public launch unless low-end fallback needed.
- **D-10-05:** Wear OS remains post–Phase 10.
- **D-10-06:** Flutter UI follows light/green screenshot SoT (neon-dark mockup superseded for Flutter).
- **D-10-07:** Start without custom domain — ngrok HTTPS OK for debug APK (10-00A).
- **D-10-08:** Settings tab hosts Stats & Achievements as primary view.
- **D-10-09:** Language reliability before Flutter feature work (Track A → Track B).

## Phase 9.5 (complete)

- [x] Plan 9.5-01: Validated word queue backend
- [x] Plan 9.5-02: Queue status UI on DailyWordCard

## Session

**Last session:** 2026-07-21T20:45:00.000Z
**Stopped at:** Phase 12 marked code-complete; 12-11 open on Dashboard redirect URI + Connect smoke
**Resume file:** .planning/phases/12-spotify-api-integration/12-11-SUMMARY.md
**Default branch:** `main` only

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 12 P02 | 6min | 3 tasks | 15 files |
| Phase 12 P03 | 4min | 3 tasks | 15 files |
| Phase 12 P04 | 6 min | 2 tasks | 11 files |
| Phase 12 P05 | 5min | 2 tasks | 7 files |
| Phase 12 P06 | 7min | 3 tasks | 16 files |
| Phase 12 P07 | 6min | 3 tasks | 14 files |
| Phase 12 P08 | 6min | 3 tasks | 16 files |
| Phase 12 P09 | 4min | 2 tasks | 12 files |
| Phase 12 P10 | 8min | 2 tasks | 3 files |

## Decisions

- [Phase 12]: OAuth state stored as SHA-256 only; client kinds web|android with fixed env destinations
- [Phase 12]: Controlled-RED Spotify slice tests excluded from npm test until owning implementation plans
- [Phase 12]: Precision gate uses accepted-match precision (>0.90), not overall accuracy inflated by rejections
- [Phase 12]: Flutter RED uses explicit Args/factory hooks with per-slice sentinels until 12-06/07/09
- [Phase 12]: Web Spotify strategy is pure DTO contracts + Node 24 test:spotify; no new test package
- [Phase 12]: Public Spotify callback mounted separately; status never returns tokens — D-12-01/D-12-04 backend-owned PKCE with fixed client-kind destinations
- [Phase 12]: Playlist list uses complete-sync upsert/prune with 7-day metadata TTL — Preserve prior rows on partial/provider failure; match-cache policy alignment
- [Phase 12]: Web Spotify success lands on /playlists?spotify=connected; errors recover on /settings with allowlisted outcomes
- [Phase 12]: Library fetches Harmonix/Spotify/Recent independently; Spotify failures never clear Harmonix content
- [Phase 12]: Disconnect clears provider UI only after DELETE /api/spotify/connection acknowledgement
- [Phase 12]: Development-only App Links on ngrok host; release association blocked until production domain + release cert
- [Phase 12]: Android Spotify OAuth via Settings card + url_launcher; provider tokens never stored on device
- [Phase 12]: Library Open Settings recovery only; Spotify cards open provider-aware in-app detail (12-07)
- [Phase 12]: Restricted Spotify detail trusts user_spotify_playlists only when fresh; stale rows revalidate via full /me/playlists sync
- [Phase 12]: Playlist detail Open in Spotify uses only API-provided HTTPS open.spotify.com URLs after client validation
- [Phase 12]: Duration hard-reject only when title+artist identify the work; else weak_candidate
- [Phase 12]: Export match→create→add inline with 202 + latest/by-id restore; dialog does not own job identity
- [Phase 12]: Disconnect clears user export jobs and match evidence for that user's playlist songs
- [Phase 12]: Flutter export job identity restored via authenticated latest/by-id; sheet state is not the store
- [Phase 12]: No-AI boundary proven by injected spy, AI-host fetch rejection, and match/export source import scan
- [Phase 12]: nyquist_compliant remains false until full npm test and repo lint are green; Spotify surface documented as RC substitute
- [Phase 12]: Spotify ops runbook pins Development Mode ≠ Extended Quota public release and February 2026 endpoints
- [Phase 12]: VPS uses long OAuth callback path; `/callback` alias present for Dashboard convenience (2026-07-21)
- [Phase 12]: Repo consolidated to single `main` branch (2026-07-21)
