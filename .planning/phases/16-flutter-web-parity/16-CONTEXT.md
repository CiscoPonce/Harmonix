# Phase 16 — Flutter + Capacitor web parity

**Status:** In progress (2026-07-24)  
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
| D-16-04 | Hear-it: labeled control + web timing rules; Open in Spotify + Add to playlist on WOTD |
| D-16-05 | Library header shows `Spotify · {name}` / Connect chip (match web `AppShell`) |
| D-16-06 | Visual tokens align to Phase 13 web (`#0B4D2E` / `#3DCF7A`); Material bottom nav OK |
| D-16-07 | In-app Spotify Web Playback SDK **not** required on Flutter this phase (keep Deezer 30s + Open in Spotify) |

## Workstreams

1. **Settings learning profile** — music style, voice gender, language list, onboarding genre incl. hip-hop
2. **Discover home parity** — practice strip, review, shelf flip cards
3. **Hear-it + WOTD actions** — timing, labels, Open in Spotify, Add to playlist
4. **Library Spotify chrome** — header account chip
5. **Visual system sync** — brand tokens + typography closer to web
6. **QA** — refresh `docs/DUAL-FRONTEND-QA.md`; Capacitor smoke on production URL

## Non-goals

- Play Store listing / Extended Spotify Quota
- Containerizing Pocket-TTS
- Wear OS
- Full Flutter Spotify App Remote streaming

## Evidence of gaps (pre-phase)

See `docs/DUAL-FRONTEND-QA.md` rows: music style “Settings when parity”, voice gender “when wired”, Discover shelf missing on Flutter.
