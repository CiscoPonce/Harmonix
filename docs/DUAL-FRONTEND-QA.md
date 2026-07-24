# Dual-Frontend QA & Feature Parity Matrix

**Date:** 2026-07-24  
**Milestone:** v1.9 — Flutter + Capacitor web parity (Phase 16)  
**Surfaces:** Next.js Web (`client/`) vs Flutter Android (`mobile/`) · Capacitor = live web shell  
**Nav (both):** Discover · Library · Settings  
**Production:** https://harmonix.peeporunclub.co.uk

---

## Parity Verification Matrix

| Domain | Feature | Next.js Web | Flutter Android | Status |
|--------|---------|-------------|-----------------|--------|
| **1. Authentication** | JWT Login / Register | `/login`, `/register` | Login & Register Screens | Verified |
| **1. Authentication** | Token Refresh | HTTP cookie / Bearer | SecureStorage `refresh()` | Verified |
| **2. Discover (home)** | Word of the Day | `/discover` hero card | Discover tab (WOTD) | Verified |
| **2. Discover (home)** | Practice strip / review | Streak + goal + `/review` | Practice chips + Review screen | Verified |
| **2. Discover (home)** | Your shelf flip cards | Recent words shelf | Horizontal shelf + Open in Spotify | Verified (no 3D flip yet) |
| **2. Discover (home)** | Song search | Discover search | Green search band → Spotify | Verified |
| **3. Phonetic Audio** | Pocket-TTS Pronounce | `/api/daily-word/pronounce` | WAV Audio Player | Verified |
| **3. Phonetic Audio** | Voice gender preference | Settings | Settings + onboarding | Verified |
| **4. Spotify** | OAuth Connect | Popup (`D-14-01`) | External browser + deep link (`D-14-03`) | Verified |
| **4. Spotify** | Library sync & export | `/playlists` | Library screen | Verified |
| **4. Spotify** | Connected account UI | Header chip `Spotify · {name}` | Library header chip + Settings card | Verified |
| **5. Playback** | In-app / fallback | Web Playback SDK + Deezer 30s + Open in Spotify | Deezer 30s + Open in Spotify (`D-16-07`) | Verified (honest) |
| **5. Playback** | Hear-it timing / labels | `hearItTiming` + labeled CTA | Labeled Hear it + Deezer seek | Partial (timing port optional) |
| **6. Settings** | Languages | Home & learning pickers | Same list as web (`pt`, not `ja`) | Verified |
| **6. Settings** | Music style (genre) | Settings picker (purges queue) | Settings chips + onboarding | Verified |
| **6. Settings** | Dyslexia-friendly font | Toggle in Settings | Accessible spacing (later) | Gap |

---

## Codebase Roles & Mobile Strategy

- **Flutter (`mobile/`)**: Official primary mobile application for Android (and future iOS). Phase 16 closes design/function gaps vs web.
- **Capacitor (`client/android`)**: Legacy fallback web-wrapper — loads production Next.js (`capacitor.config.ts`). Instant web parity; not the long-term native path.
- **Learn tab**: Removed — Daily Word lives on Discover on both surfaces.

## Phase 16 context

→ [`.planning/phases/16-flutter-web-parity/16-CONTEXT.md`](../.planning/phases/16-flutter-web-parity/16-CONTEXT.md)
