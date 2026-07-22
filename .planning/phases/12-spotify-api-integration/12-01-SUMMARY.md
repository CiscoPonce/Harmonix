---
phase: 12-spotify-api-integration
plan: "01"
subsystem: infra
tags: [spotify, oauth, secrets, ngrok]

requires: []
provides:
  - Exact HTTPS Spotify callback and fixed return URLs for web/Android
  - Local encryption-key custody for development
  - Match-cache policy approval
  - Development Mode quota boundary
affects: [12-02, 12-04, 12-05, 12-06, 12-11]

tech-stack:
  added: []
  patterns: [backend-owned OAuth callback, deployment-env secret custody]

key-files:
  created:
    - .planning/phases/12-spotify-api-integration/12-01-SUMMARY.md
  modified:
    - server/.env

key-decisions:
  - "Option: development-only fixed ngrok HTTPS callback for five-user sandbox"
  - "Callback: https://moral-sparrow-nationally.ngrok-free.app/api/spotify/oauth/callback"
  - "Web success → Library URL; web/error and Android error → Settings URLs"
  - "Encryption key: 32-byte AES key in server/.env (gitignored), version v1, custody local-dev-server-env"
  - "Match cache: ttl=7d; revalidate_on_export; delete_on_disconnect"
  - "Scopes: playlist-read-private playlist-read-collaborative playlist-modify-private"
  - "Quota: Development Mode only; Extended Quota not requested; public release blocked"

patterns-established:
  - "Never invent Spotify Client ID; live OAuth waits for dashboard-provided value"
  - "Production App Link / custom domain remains a release gate, not a sandbox blocker"

requirements-completed: [PHASE-12-MVP, D-12-01, D-12-11, D-12-14]

coverage:
  - id: D1
    description: Exact HTTPS callback and fixed success/error return URLs recorded
    requirement: D-12-01
    verification:
      - kind: other
        ref: server/.env SPOTIFY_REDIRECT_URI and return URL keys
        status: pass
    human_judgment: false
  - id: D2
    description: Encryption key custody and cache policy named for implementation
    requirement: D-12-11
    verification:
      - kind: other
        ref: server/.env SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION and SPOTIFY_MATCH_CACHE_POLICY
        status: pass
    human_judgment: false
  - id: D3
    description: Spotify Client ID / Premium owner / allowlist still required from developer dashboard
    requirement: D-12-01
    verification: []
    human_judgment: true
    rationale: Account-controlled Spotify Dashboard facts cannot be invented by the agent

duration: 10min
completed: 2026-07-20
status: complete
---

# Phase 12: Plan 01 Summary

**Development-only Spotify prerequisite contracts locked on the existing ngrok HTTPS host; live Client ID remains the only external blocker for real OAuth.**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-07-20
- **Tasks:** 2 (Task 1 decided; Task 2 partially open — Client ID pending)
- **Files modified:** 1 (`server/.env`, gitignored)

## Accomplishments

- Chose **development-only** fixed ngrok HTTPS callback (blocks production release until a controlled domain exists).
- Recorded callback path `/api/spotify/oauth/callback` and fixed Library/Settings return targets for web and Android.
- Provisioned a local 32-byte `SPOTIFY_TOKEN_ENCRYPTION_KEY` (v1) outside source control.
- Approved match-cache policy: 7-day TTL, revalidate on export, delete on disconnect.
- Locked playlist scopes to D-12-14 and Development Mode / five-user ceiling.

## Decisions

| Item | Value |
|------|-------|
| Option | development-only ngrok HTTPS |
| Redirect | `https://moral-sparrow-nationally.ngrok-free.app/api/spotify/oauth/callback` |
| Web success | Library (`/playlists?spotify=connected`) |
| Web error | Settings (`/settings?spotify=error`) |
| Android success | `/app/library?spotify=connected` |
| Android error | `/app/settings?spotify=error` |
| Key custody | `local-dev-server-env` / version `v1` |
| Cache policy | `ttl=7d; revalidate_on_export; delete_on_disconnect` |
| Quota | Development Mode; Extended Quota not requested |

## Open for human

Add to `server/.env` before live OAuth smoke:

```bash
SPOTIFY_CLIENT_ID=<from Spotify Developer Dashboard>
```

Also confirm Premium owner and up to five allowlisted sandbox users, and register the exact redirect URI above in the Dashboard.

## Next

Continue Wave 0 / implementation plans 12-02+.
