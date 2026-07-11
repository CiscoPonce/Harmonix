---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: mobile-dual-frontend
status: in_progress
last_updated: "2026-07-11T20:00:00.000Z"
progress:
  total_phases: 12
  completed_phases: 10
  total_plans: 28
  completed_plans: 23
  percent: 82
---

# Project State — Harmonix

## Current Focus

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
