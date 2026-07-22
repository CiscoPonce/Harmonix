# Dual-Frontend QA & Feature Parity Matrix

**Date:** 2026-07-22  
**Milestone:** v1.7 — Production Parity & Ship (+ post-ship polish)  
**Surfaces:** Next.js Web (`client/`) vs Flutter Android (`mobile/`)  
**Nav (both):** Discover · Library · Settings

---

## Parity Verification Matrix

| Domain | Feature | Next.js Web | Flutter Android | Status |
|--------|---------|-------------|-----------------|--------|
| **1. Authentication** | JWT Login / Register | `/login`, `/register` | Login & Register Screens | Verified |
| **1. Authentication** | Token Refresh | HTTP cookie / Bearer | SecureStorage `refresh()` | Verified |
| **2. Discover (home)** | Word of the Day | `/discover` hero card | Discover tab (WOTD) | Verified |
| **2. Discover (home)** | Practice strip / review | Streak + goal + `/review` | Review from Discover | Verified |
| **2. Discover (home)** | Song search | Discover search | Catalog search | Verified |
| **3. Phonetic Audio** | Pocket-TTS Pronounce | `/api/daily-word/pronounce` | WAV Audio Player | Verified |
| **3. Phonetic Audio** | Voice gender preference | Settings | Settings (when wired) / device TTS fallback | Web verified |
| **4. Spotify** | OAuth Connect | Popup (`D-14-01`) | External browser + deep link (`D-14-03`) | Verified |
| **4. Spotify** | Library sync & export | `/playlists` | Library screen | Verified |
| **4. Spotify** | Connected account UI | Header chip `Spotify · {name}` | Settings Connected card | Verified (surface differs) |
| **5. Playback** | In-app / fallback | Web Playback SDK + Deezer 30s + Open in Spotify | Deezer 30s + Open in Spotify (`D-14-04`) | Verified |
| **6. Settings** | Languages | Home & learning pickers | Native & target dropdowns | Verified |
| **6. Settings** | Music style (genre) | Settings picker (purges queue) | Onboarding genre; Settings when parity | Web verified |
| **6. Settings** | Dyslexia-friendly font | Toggle in Settings | Accessible spacing | Verified |

---

## Codebase Roles & Mobile Strategy

- **Flutter (`mobile/`)**: Official primary mobile application for Android (and future iOS).
- **Capacitor (`client/android`)**: Retained as legacy fallback web-wrapper build (`D-14-05`).
- **Learn tab**: Removed — Daily Word lives on Discover on both surfaces.
