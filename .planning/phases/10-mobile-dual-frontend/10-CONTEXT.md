# Phase 10: Mobile — Dual Frontend (Android)

**Gathered:** 2026-06-27  
**Status:** Ready for planning (not started)  
**Milestone:** v1.3 — Mobile

<domain>
## Phase Boundary

Deliver Android mobile access in two stages, ending with **one backend and two frontends**:

1. **Option B — Capacitor APK (bridge)** — wrap existing Next.js app for real-device testing without a custom domain (ngrok OK).
2. **Option C — Flutter native app** — implement team Android mockup (4-tab UI, neon green dark theme).
3. **Dual-frontend ops** — Next.js web + Flutter Android share Express/SQLite API.

Out of scope for Phase 10: Wear OS, iOS, push notifications (defer post-10).

</domain>

<decisions>
## Implementation Decisions

### Strategy (team agreed 2026-06-27)
- **D-10-01:** Option B before Option C — validate on real devices without rewriting UI.
- **D-10-02:** Backend stays single source of truth; both frontends consume `/api/*`.
- **D-10-03:** Formal test gate between B → C (QA sign-off + optional Play internal track).
- **D-10-04:** Deprecate Capacitor after Flutter public launch unless low-end fallback needed.
- **D-10-05:** Wear OS remains post–Phase 10 (Flutter foundation first).
- **D-10-06:** Android UI follows team mockup in Flutter; Capacitor shows web UI until C ships.
- **D-10-07:** Start without custom domain — use ngrok HTTPS (`moral-sparrow-nationally.ngrok-free.app`) for 10-00a / debug APK.
- **D-10-08:** Domain + Play Store prep deferred to Plan 10-00B (before public release).

### Design (team mockup)
- **D-10-09:** Bottom nav: Discover · Library · Learn · Settings.
- **D-10-10:** Settings tab primary view = **Stats & Achievements** (mockup screen 4); preferences via profile/sub-screen.
- **D-10-11:** Learn tab = Daily Word (mockup screen 1); integrates Phase 9.5 queue badge.

</decisions>

<canonical_refs>
## Canonical References

- [10-UI-SPEC.md](./10-UI-SPEC.md) — screen-by-screen mockup mapping
- [design/android-mockup-v1.png](./design/android-mockup-v1.png) — design lead reference
- `server/routes/dailyWord.js` — queue endpoints (Phase 9.5)
- `client/src/components/DailyWordCard.tsx` — web reference for Learn tab behaviour
- [../../ROADMAP.md](../../ROADMAP.md) — phase index

</canonical_refs>
