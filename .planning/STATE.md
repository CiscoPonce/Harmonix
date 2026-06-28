---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: mobile-dual-frontend
status: in_progress
last_updated: "2026-06-28T08:00:00.000Z"
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 26
  completed_plans: 19
  percent: 73
---

# Project State — Harmonix

## Current Focus

**Phase 10 in progress** — Capacitor Android wrapper (Option B). Build APK locally with Android Studio.

## Phase 10 Progress

- [x] Plan 10-00A: Capacitor config + ngrok URL + env docs + sideload guide
- [ ] Plan 10-00B: Prerequisites — domain + Play Store
- [x] Plan 10-01: Capacitor Android project (`com.harmonix.app`, icons, ngrok header)
- [ ] Plan 10-02: Option B — test & Google Play internal track
- [ ] Plan 10-03: Option C — Flutter MVP matching [UI spec](./phases/10-mobile-dual-frontend/10-UI-SPEC.md)
- [ ] Plan 10-04: Option C — test & dual-frontend parity
- [ ] Plan 10-05: Documentation & release runbook

## Mobile design (team mockup)

- **Reference:** `.planning/phases/10-mobile-dual-frontend/design/android-mockup-v1.png`
- **Spec:** `.planning/phases/10-mobile-dual-frontend/10-UI-SPEC.md`
- **4 tabs:** Discover · Library · Learn (Daily Word) · Settings (Stats & Achievements)
- **Option B:** functional APK, existing web UI (not mockup fidelity)
- **Option C:** Flutter implements mockup + neon green dark theme

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

Capacitor APK (Option B) is a **temporary bridge** during 10-01/10-02; Flutter becomes the long-term mobile client.

## Recent decisions

- **D-10-01:** Ship Option B before Option C — validate on real devices without rewriting UI.
- **D-10-02:** Backend stays single source of truth; both frontends consume `/api/*`.
- **D-10-03:** Test gate required between B → C (internal Play track + QA sign-off).
- **D-10-04:** Deprecate Capacitor after Flutter public launch unless low-end fallback needed.
- **D-10-05:** Wear OS remains post–Phase 10.
- **D-10-06:** Android UI follows team mockup in Flutter; Capacitor bridge uses web UI until C ships.
- **D-10-07:** Start without custom domain — ngrok HTTPS OK for debug APK (10-00A).
- **D-10-08:** Settings tab hosts Stats & Achievements (mockup screen 4) as primary view.

## Phase 9.5 (complete)

- [x] Plan 9.5-01: Validated word queue backend
- [x] Plan 9.5-02: Queue status UI on DailyWordCard
