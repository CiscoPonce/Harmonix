# Summary: Plan 14-06 (Standalone APK & Release Runbook)

**Phase:** 14 — Production Parity & Ship  
**Completed:** 2026-07-22  

---

## What was built
- **Release Runbook:** Created `docs/RELEASE-RUNBOOK.md` detailing end-to-end VPS deployment, environment validation, ngrok tunnel, and standalone APK compilation.
- **Deploy Script Flag:** Added optional `--skip-tests` flag support to `deploy.sh` for fast VPS process restarts when tests have passed in CI (`D-14-07`).

---

## Verification
- `docs/RELEASE-RUNBOOK.md` created; `deploy.sh` updated with `--skip-tests`.
