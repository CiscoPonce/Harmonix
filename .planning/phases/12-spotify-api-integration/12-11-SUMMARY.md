---
phase: 12-spotify-api-integration
plan: "11"
subsystem: release
tags: [spotify, sandbox, uat, quota]

requires:
  - phase: 12-10
    provides: automated release matrix and runbook
provides:
  - Automated Spotify surface evidence (backend/web/Flutter)
  - Explicit Development Mode / sandbox-only release boundary
  - Operator Client ID provisioned on VPS (2026-07-21)
affects: [verify-work]

tech-stack:
  added: []
  patterns: [sandbox-only release until Extended Quota]

key-files:
  created:
    - .planning/phases/12-spotify-api-integration/12-11-SUMMARY.md
  modified:
    - server/index.js
    - client/src/app/settings/page.tsx
    - client/src/components/AppHeader.tsx

key-decisions:
  - "Release boundary: Development Mode sandbox only (five allowlisted users). Not public."
  - "Live OAuth/device/policy gates remain human-required until Dashboard redirect URI matches and smoke passes."

requirements-completed: [PHASE-12-MVP]

coverage:
  - id: D1
    description: Spotify automated suites green (backend 69, web 27, Flutter Spotify suite)
    verification:
      - kind: unit
        ref: server mocha spotify* + client npm run test:spotify + flutter test test/spotify_*_test.dart
        status: pass
    human_judgment: false
  - id: D2
    description: Real Spotify web/Android sandbox journey
    verification: []
    human_judgment: true
    rationale: Client ID on VPS; blocked on Spotify Dashboard redirect URI exact match + allowlisted user smoke
  - id: D3
    description: UI/accessibility/policy/branding human approval
    verification: []
    human_judgment: true
    rationale: Policy and branding backstops require named human approval
  - id: D4
    description: Extended Quota public-release decision
    verification: []
    human_judgment: false
    rationale: Decided Development Mode / sandbox-only; Extended Quota not requested

duration: ongoing
completed: null
status: partial
updated: 2026-07-21
---

# Phase 12: Plan 11 Summary — Status 2026-07-21

**Code + deploy:** complete on GitHub `main` and VPS.  
**Live Connect:** blocked on Spotify Dashboard **Redirect URI** match (server side is ready).

## Status snapshot

| Area | Status |
|------|--------|
| Plans 12-01 … 12-10 | Complete (code + tests) |
| Plan 12-11 automated evidence | Complete |
| Plan 12-11 live sandbox/device smoke | **Open** — Dashboard redirect URI |
| Plan 12-11 UI/policy human approval | **Open** |
| Extended Quota / public release | **Not requested** (sandbox-only) |
| GitHub | Single branch `main` @ `83ad3b3`+ |
| VPS | Same code; services up |

## Operator progress (2026-07-21)

| Step | Done? | Notes |
|------|-------|-------|
| Spotify Developer app created | Yes | Client ID provisioned (not committed) |
| `SPOTIFY_CLIENT_ID` on VPS `server/.env` | Yes | Auth start returns `accounts.spotify.com` URL |
| Other Spotify env (redirect, success/error URLs, encryption key, scopes) | Yes | On VPS |
| `/settings` reachable on live web | Yes | AppHeader link + page |
| Playlist route conflict fixed | Yes | `/playlists/spotify/[id]` |
| Short `/callback` alias | Yes | Aliases OAuth handler; env uses long path |
| Dashboard Redirect URI exact match | **No** | Error: `redirect_uri: Not matching configuration` |
| Allowlisted test user Connect smoke | **No** | Blocked by Dashboard URI |
| Android device smoke | **No** | Same gate |
| UI/policy gate approval | **No** | Awaiting human |

### Redirect URI Harmonix sends (must match Dashboard character-for-character)

```text
https://moral-sparrow-nationally.ngrok-free.app/api/spotify/oauth/callback
```

Also available on VPS: `GET /callback` aliases the same handler (optional Dashboard entry).

## Automated evidence (2026-07-20 / reconfirmed 2026-07-21)

| Surface | Result |
|---------|--------|
| Backend Spotify Mocha | 69 passing (slice) |
| Web `npm run test:spotify` | 27 passing |
| Flutter Spotify tests | Passing |
| Live `/settings` | HTTP 200 |
| Live `POST /api/spotify/auth/start` | Returns authorize URL with Client ID (when logged in) |

## Release decision

**Sandbox-only / Development Mode.** Public release blocked until Extended Quota is approved separately.

## Still required to close 12-11

1. In Spotify Dashboard → app settings → **Redirect URIs**: save **exactly** the long callback URI above (delete mismatches).
2. **Users and Access**: allowlist the Spotify account used for testing (≤5).
3. Web: Settings → **Connect Spotify** → consent → Library shows Spotify group.
4. Optionally repeat on Android.
5. Reply `approved sandbox/device gate` and `approved UI/policy gate`.

## Already shipped for that test

- Settings Spotify connection card (web + Flutter)
- OAuth PKCE backend + encrypted tokens
- Library provider-separated Spotify playlists
- Playlist detail + Open in Spotify
- Export + match report (web + Android)
- Disconnect cleanup
- Ops runbook: `docs/SPOTIFY-INTEGRATION.md`
