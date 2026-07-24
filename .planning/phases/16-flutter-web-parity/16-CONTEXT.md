# Phase 16 — Flutter + Capacitor web parity

**Status:** In progress — required parity items landed (2026-07-24)  
**Milestone:** v1.9 (mobile parity)  
**Surfaces:** Flutter Android (`mobile/`) primary · Capacitor (`client/android`) legacy web-shell

## Goal

Make the **Flutter** app match **web** design language and learning functionality (Discover · Library · Settings). Keep Capacitor as the “always-current web” fallback, not the primary product path.

## Decisions locked

| ID | Decision |
|----|----------|
| D-16-01 | **Flutter is primary** Android product; Capacitor stays legacy WebView of live Next.js |
| D-16-02 | Settings must edit **music style** + **voice gender** (same API as web); language list = web (`pt`, not `ja`) |
| D-16-03 | Discover home gains practice strip, review entry, Your shelf (flip cards) — WOTD remains hero |
| D-16-04 | Hear-it: labeled control + Open in Spotify; **Add to playlist** on WOTD (**required**) |
| D-16-05 | Library header shows `Spotify · {name}` / Connect chip (match web `AppShell`) |
| D-16-06 | Visual tokens align to Phase 13 web (`#0B4D2E` / `#3DCF7A`); Material bottom nav OK |
| D-16-07 | In-app Spotify Web Playback SDK **not** required on Flutter this phase (keep Deezer 30s + Open in Spotify) |
| D-16-08 | **3D flip cards** on WOTD + shelf are **required** (actions outside the flip transform) |
| D-16-09 | **Capacitor smoke** against production is **required** (`scripts/capacitor-smoke.sh` + device checklist) |

## Workstreams

1. **Settings learning profile** — Done
2. **Discover home parity** — Done
3. **Hear-it + WOTD actions** — Done (labels, Spotify, **Add to playlist**)
4. **Library Spotify chrome** — Done
5. **Visual system sync** — Done
6. **3D flip cards** — Done (`mobile/lib/widgets/word_flip_card.dart`)
7. **QA / Capacitor smoke** — Done (`scripts/capacitor-smoke.sh`)

## Non-goals

- Play Store listing / Extended Spotify Quota
- Containerizing Pocket-TTS
- Wear OS
- Full Flutter Spotify App Remote streaming

## Evidence

Parity matrix: [`docs/DUAL-FRONTEND-QA.md`](../../../docs/DUAL-FRONTEND-QA.md)  
Capacitor: [`docs/MOBILE-B-CAPACITOR.md`](../../../docs/MOBILE-B-CAPACITOR.md)
