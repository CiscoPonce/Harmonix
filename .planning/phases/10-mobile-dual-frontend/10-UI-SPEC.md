# Phase 10 — Android UI Spec (Flutter source of truth)

**Applies to:** Option C (Flutter) in `mobile/`.  
**Option B (Capacitor):** keeps existing web UI in WebView until Flutter replaces it (D-10-04).

**Design source of truth (2026-07):** light background + dark-green accents from the Learn/WOTD screenshot.  
The older neon-dark mockup (`design/android-mockup-v1.png`) is **superseded for Flutter**.

---

## App shell (4 tabs)

| # | Tab | Primary screen |
|---|-----|----------------|
| 1 | Discover | Search + streak/level chips |
| 2 | Library | Playlists + recent daily words |
| 3 | Learn | Word of the Day (default tab) |
| 4 | Settings | Stats, badges, prefs, logout |

```text
┌─────────────────────────────────────────┐
│  avatar · Harmonix · search             │
├─────────────────────────────────────────┤
│              Tab content                │
├─────────────────────────────────────────┤
│ Discover │ Library │ Learn │ Settings   │
└─────────────────────────────────────────┘
```

---

## Screen — Learn (Word of the Day)

| UI | Data |
|----|------|
| WORD OF THE DAY | static label + queue ready count |
| Hero word (italic bold) | `word.text` |
| IPA + speaker | `word.pronunciation` (device TTS) |
| Definition | `word.translation` |
| Lyric card + green left rail | `lyric.snippet` + highlight on target word |
| Artist · title | `song.artist` · `song.title` |
| Green Play | 30s `audio.preview_url`, seek `lyric.timestamp_ms` |
| Headphones | open web player / Deezer deep link |
| Share | share sheet: word + lyric + song |
| Next word | `POST /daily-word/next` |

Header: profile avatar (left), italic green **Harmonix** (center), search (right → Discover).

---

## Screen — Discover / Library / Settings

MVP maps to existing APIs (`/search`, `/progress/stats`, `/playlists`, `/daily-word/recent`, `/badges`).  
Deferred: trending carousel, weekly XP chart, activity rhythm (same gaps as prior 10-03C/D).

---

## Design tokens (Flutter)

| Token | Value |
|-------|-------|
| background | `#FFFFFF` |
| text primary | `#111111` |
| text muted | `#6B6B6B` |
| accent | `#006432` |
| card border accent | left rail `#006432` |
| brand wordmark | italic green Harmonix |
| display word | large bold italic black |
| lyric highlight | green italic on target word |
| surface / border | `#FFFFFF` / `#E5E5E5` |

Implemented in `mobile/lib/theme/harmonix_theme.dart`.

---

## Asset checklist

- [ ] Adaptive app icon  
- [ ] Splash (white + Harmonix mark)  
- [x] Bottom nav (Material 3 NavigationBar)  
- [ ] Empty states polish per tab  

---

## API notes

| ID | Feature | Status |
|----|---------|--------|
| 10-03B | Mobile Bearer + body `refreshToken` | Done (`/api/auth/login`, `/api/auth/refresh`) |
| 10-03C | Trending songs | Deferred |
| 10-03D | Activity rhythm | Deferred |
