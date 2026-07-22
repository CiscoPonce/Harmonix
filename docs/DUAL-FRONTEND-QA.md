# Dual-Frontend QA & Feature Parity Matrix

**Date:** 2026-07-22  
**Milestone:** v1.7 — Production Parity & Ship  
**Surfaces:** Next.js Web (`client/`) vs Flutter Android (`mobile/`)  

---

## Parity Verification Matrix

| Domain | Feature | Next.js Web | Flutter Android | Status |
|--------|---------|-------------|-----------------|--------|
| **1. Authentication** | JWT Login / Register | `/login`, `/register` | Login & Register Screens | Verified |
| **1. Authentication** | Token Refresh | HTTP cookie / Bearer | SecureStorage `refresh()` | Verified |
| **2. Discover** | Word of the Day (WOTD) | `/discover` Hero Card | Learn Tab Header Card | Verified |
| **2. Discover** | Global Search | Header Search Bar | Catalog Search | Verified |
| **3. Active Learning** | Daily Word Queue | `/dashboard` Queue | Daily Word Screen | Verified |
| **3. Active Learning** | Active Recall SRS | `/review` | Review Screen | Verified |
| **4. Phonetic Audio** | Pocket-TTS Pronounce | `/api/daily-word/pronounce` | WAV Audio Player | Verified |
| **5. Spotify Integration**| OAuth Connect | Popup Window (`D-14-01`) | External Browser + Deep Link (`D-14-03`) | Verified |
| **5. Spotify Integration**| Library Sync & Export | `/playlists` | Library Screen | Verified |
| **6. Playback Strategy** | In-App / Fallback | Web Playback SDK + 30s Deezer | Deezer 30s + Open in Spotify (`D-14-04`) | Verified |
| **7. User Settings** | Language Selection | Home & Target Pickers | Native & Target Dropdowns | Verified |
| **7. User Settings** | Dyslexia-Friendly Font | Toggle in Settings | Accessible Spacing | Verified |

---

## Codebase Roles & Mobile Strategy

- **Flutter (`mobile/`)**: Official Primary Mobile Application for Android (and future iOS).
- **Capacitor (`client/android`)**: Retained as legacy fallback web-wrapper build (`D-14-05`).
