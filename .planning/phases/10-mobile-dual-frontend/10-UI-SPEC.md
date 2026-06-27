# Phase 10 — Android UI Spec (team mockup v1)

**Source:** Design lead — [android-mockup-v1.png](./design/android-mockup-v1.png)  
**Applies to:** Option C (Flutter). Option B uses existing web UI in WebView.

---

## Mockup overview (4 screens → 4 tabs)

| # | Mockup title | App tab | Phase plan |
|---|--------------|---------|------------|
| 1 | Daily Word | **Learn** | 10-03 P0 |
| 2 | Discover | **Discover** | 10-03 P0 |
| 3 | Library | **Library** | 10-03 P0 |
| 4 | Stats & Achievements | **Settings** (primary) | 10-03 P0 |

```text
┌─────────────────────────────────────────┐
│  Harmonix · profile · search              │
├─────────────────────────────────────────┤
│              Tab content                  │
├─────────────────────────────────────────┤
│ Discover │ Library │ Learn │ Settings    │
└─────────────────────────────────────────┘
```

**Option B:** single-page web dashboard — no bottom nav.  
**Option C:** implement nav + screens per mockup.

---

## Screen 1 — Learn (Daily Word)

| UI element | Mockup | API / data |
|------------|--------|------------|
| Date label | MONDAY, OCT 23 | `payload.date` |
| Hero word + POS + IPA | PARADISE · Noun | `word.text`, `part_of_speech`, `pronunciation` |
| Definition + lyric quote (mono) | Quote with keyword | `translation`, `lyric.snippet` |
| Daily Mastery bar | 85% green progress | `today_words / daily_goal` or queue fill |
| Queue badge | (Phase 9.5) N ready | `GET /daily-word/queue-status` |
| HEAR IT IN SONG | White pill CTA | `audio.preview_url`, seek to `lyric.timestamp_ms` |
| OPEN PLAYER | Outline CTA | Navigate → player `song.id` |
| Footer | Used in N songs · Level | CEFR from user; song count → v1.1 API |

---

## Screen 2 — Discover

| UI element | Mockup | API / data |
|------------|--------|------------|
| Search bar | Songs, artists, words | Deezer search → `/player/[id]` |
| Trending Songs carousel | Cards + fluency % | **v1.1** — optional `10-03C` |
| New Vocabulary row | Komorebi, Saudade cards + **32 READY** badge | `GET /daily-word/recent` + `GET /daily-word/queue-status` |
| Lyric Context card | Mono snippet | Recent daily word lyric |
| Streak chip | 12 DAYS ACTIVE | `GET /progress/stats` → `streak_days` |
| Level chip | B2 UPPER INT. | User `cefr_level` |
| FAB play | Quick resume | Local `last_song_id` — **gap** |

**MVP:** search + streak/level + recent vocab. Trending deferred.

---

## Screen 3 — Library

| UI element | Mockup | API / data |
|------------|--------|------------|
| Explore Songs hero | Waveform art | Navigate → Discover search |
| Playlist cards | Daily Groove, Top 40 | `GET /playlists` |
| Create New | + tile | `POST /playlists` |
| Recent Discoveries list | Word + POS + chevron | `GET /daily-word/recent` |

Fully supported by existing API ✅

---

## Screen 4 — Settings (Stats & Achievements)

| UI element | Mockup | API / data |
|------------|--------|------------|
| Profile | Name, title, level, flame | Auth user + derived level |
| Weekly Goal | XP bar 850/1000 | **Gap** — quiz XP aggregate |
| Stats grid | Words learned · Songs mastered | `total_words`, study sessions |
| Achievements list | Daily Dedication, Curator, Lyricist | `GET /badges` |
| Activity Rhythm | 7-day bar chart | **Gap** — `GET /progress/activity?days=7` optional |

Preferences (language, genre, logout): sub-screen from profile icon.

---

## Design tokens

| Token | Value |
|-------|-------|
| background | `#000000` |
| surface | `#0A0A0A` – `#141414` |
| accent | `#39FF14` (neon green — tune from asset) |
| textPrimary | `#FFFFFF` |
| textSecondary | `#888888` |
| fontDisplay | Geist / Inter Bold |
| fontMono | JetBrains Mono (lyrics) |
| radiusButton | pill (9999px) |

---

## Asset checklist (design lead)

- [ ] Adaptive app icon  
- [ ] Splash (black + Harmonix mark)  
- [ ] Bottom nav icons (4 tabs)  
- [ ] Waveform hero (Library / Discover)  
- [ ] Empty states per tab  

---

## API mini-plans (non-blockers)

| ID | Feature | When |
|----|---------|------|
| 10-03B | Mobile token auth | If WebView/cookies fail |
| 10-03C | Trending songs | Flutter v1.1 |
| 10-03D | Activity rhythm endpoint | Flutter week 2 |
| 10-03E | Word frequency in songs | v1.1 |

Core mockup flows work with today's API ✅
