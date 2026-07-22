---
phase: 12-spotify-api-integration
plan: "10"
subsystem: docs
tags: [spotify, release, runbook, validation, nyquist, operations]

requires:
  - phase: 12-spotify-api-integration
    provides: Android export parity and resilience matrix (12-09)
  - phase: 12-spotify-api-integration
    provides: Capability coverage matrix and Wave 0–9 automated surfaces
provides:
  - Operator runbook with February 2026 endpoints, scopes, rotation, and Extended Quota gate
  - Factual local release-matrix evidence in 12-VALIDATION.md
  - Documented runnable Spotify-focused matrix when full-repo gates still carry deferred debt
affects: [12-11]

tech-stack:
  added: []
  patterns:
    - Release evidence records observed exits only; nyquist_compliant stays false until full suite is green
    - Spotify-scoped substitutes documented when pre-existing Daily Word/lint debt blocks repo-wide commands

key-files:
  created:
    - docs/SPOTIFY-INTEGRATION.md
  modified:
    - .planning/phases/12-spotify-api-integration/12-VALIDATION.md
    - .planning/phases/12-spotify-api-integration/deferred-items.md

key-decisions:
  - "nyquist_compliant remains false — full npm test (Daily Word/TTS) and repo-wide lint still fail; Spotify surface is green"
  - "wave_0_complete true — Wave 0 harness and Spotify test files exist; RED slices promoted through 12-09"
  - "Runbook pins Development Mode ≠ public release and separates fault-injected suites from real sandbox smoke"

patterns-established:
  - "docs/SPOTIFY-INTEGRATION.md is the operator SoT linked to COVERAGE.md and 12-VALIDATION.md"
  - "Local matrix commands are copy-paste runnable from the runbook"

requirements-completed: [PHASE-12-MVP, D-12-01, D-12-05, D-12-11, D-12-14, D-12-15]

coverage:
  - id: D1
    description: Clean local release matrix evidence recorded without fabricated greens
    requirement: PHASE-12-MVP
    verification:
      - kind: integration
        ref: cd server && npm rebuild better-sqlite3 && NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=… npm test
        status: fail
      - kind: integration
        ref: Spotify-focused mocha suite (69 tests) + client test:spotify + build + flutter test
        status: pass
      - kind: other
        ref: .planning/phases/12-spotify-api-integration/12-VALIDATION.md
        status: pass
    human_judgment: false
  - id: D2
    description: February 2026 operations runbook with endpoints, scopes, rotation, quota, troubleshooting
    requirement: D-12-01
    verification:
      - kind: other
        ref: docs/SPOTIFY-INTEGRATION.md
        status: pass
      - kind: unit
        ref: node -e required-string presence check (/me/playlists, Retry-After, six months, Extended Quota, NVIDIA NIM, 100)
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-07-20
status: complete
---

# Phase 12 Plan 10: Automated Release Matrix and Spotify Runbook Summary

**Factual local matrix evidence plus an operator runbook that pins February 2026 Spotify constraints, encryption rotation, and Extended Quota vs Development Mode.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-20T00:18:44Z
- **Completed:** 2026-07-20T00:23:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Rebuilt `better-sqlite3` and recorded a full release-matrix run with observed exits only (no suppressed failures).
- Confirmed Spotify automated surface green: 69 backend tests, web `test:spotify` + build, Flutter full tests; endpoint/AI prohibition searches clean.
- Shipped `docs/SPOTIFY-INTEGRATION.md` covering env validation, D-12-14 scopes, current endpoints, schema/sync lifecycle, Retry-After, six-month expiry, key rotation without fallback, disconnect cleanup, sandbox vs Extended Quota, and troubleshooting.
- Updated `12-VALIDATION.md` with plan/task mapping; `wave_0_complete: true`, `nyquist_compliant: false` until full-repo gates clear.

## Task Commits

1. **Task 1: Run and record the clean local release matrix** — no tracked commit (`.planning/` validation + deferred-items are gitignored / commit_docs disabled)
2. **Task 2: Write the February 2026 operations and release runbook** - `2bcae51` (docs)

**Plan metadata:** skipped (commit_docs disabled)

## Files Created/Modified

- `docs/SPOTIFY-INTEGRATION.md` — operator, sandbox, security, policy, troubleshooting, and release runbook
- `.planning/phases/12-spotify-api-integration/12-VALIDATION.md` — observed matrix evidence and status map
- `.planning/phases/12-spotify-api-integration/deferred-items.md` — Daily Word/TTS full-suite failures and analyze info

## Decisions Made

- Keep `nyquist_compliant: false` while Daily Word/TTS and repo-wide ESLint fail; do not fabricate full-suite green.
- Treat Spotify-focused mocha + web Spotify eslint + `flutter analyze --no-fatal-infos` as release-candidate substitutes documented for 12-11.
- Runbook explicitly states Development Mode is never a public-release substitute.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed with scope-boundary handling for pre-existing failures.

### Scope boundary (documented, not fixed)

**1. [Scope boundary] Full `npm test` fails on Daily Word / Pocket-TTS**
- **Found during:** Task 1
- **Issue:** 8 failures (timeouts, Spanish language assertion, missing `uvicorn` for Pocket-TTS); unrelated to Spotify.
- **Action:** Recorded factual matrix; Spotify mocha suite green (69); logged in `deferred-items.md`.
- **Files modified:** `12-VALIDATION.md`, `deferred-items.md`

**2. [Scope boundary] Repo-wide `npm run lint` still fails**
- **Found during:** Task 1
- **Issue:** Pre-existing ESLint errors outside Spotify files (deferred since 12-03).
- **Action:** Spotify-path eslint exit 0; documented in validation + deferred-items.

**3. [Scope boundary] `flutter analyze` info in learn_screen.dart**
- **Found during:** Task 1
- **Issue:** One info-level `use_build_context_synchronously` outside Spotify.
- **Action:** `flutter analyze --no-fatal-infos` exit 0; full `flutter test` exit 0.

## Known Stubs

None.

## Threat Flags

None beyond plan threat model (T-12-43–46 mitigated by factual evidence, redaction guidance, quota separation, and COVERAGE-linked endpoint pins).

## Self-Check: PASSED

- FOUND: `docs/SPOTIFY-INTEGRATION.md`
- FOUND: `.planning/phases/12-spotify-api-integration/12-VALIDATION.md`
- FOUND: `.planning/phases/12-spotify-api-integration/12-10-SUMMARY.md`
- FOUND: commit `2bcae51`
