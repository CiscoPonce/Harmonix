# Phase 9: Retention, Gamification & Personalization — Research

**Researched:** 2026-06-25
**Domain:** Multi-feature engagement (onboarding, playlists, badges, SRS review)
**Confidence:** HIGH

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-09-01:** Use a dedicated `/onboarding` route (not modal). New users redirected here after registration before reaching `/dashboard`.
- **D-09-02:** Existing users without language set (null `native_language` or `target_language`) see the onboarding on their next dashboard visit.
- **D-09-03:** Language changeable later via a Settings page + a dashboard badge in the nav header (e.g., `EN → ES`).
- **D-09-04:** Fields: native_language + target_language (step 1), then optional genre + difficulty (step 2).
- **D-09-05:** No browser locale pre-fill — always ask from empty selects.
- **D-09-06:** Soft-block with defaults — users can skip onboarding with a "Skip → Use defaults" option (default: EN → ES). Defaults changeable in settings.
- **D-09-07:** Onboarding redirect is state-checked once per session. If user leaves mid-flow, they see it again on next visit until completed.
- **D-09-08:** Launch with 5 core badges — Streak (7-Day), Vocabulary (50 Words), Quiz (Perfect Score), Playlist (First Created), Daily Word (7-Day Collector).
- **D-09-09:** Badges live in a dashboard card ("Achievements") with a grid of visual badge icons. Grayscale/silhouette for locked, full-color for unlocked.
- **D-09-10:** Unlock notification is a toast/banner, not a full-screen modal.
- **D-09-11:** Unlock detection via background check on relevant API calls (quiz complete, playlist save, etc.). Server evaluates thresholds and returns badge data in the response.

### the agent's Discretion
- SRS Review Room flashcard UX — researcher should propose interaction pattern.
- Playlist UI/API design — standard CRUD approach.
- Dashboard integration for "X words to review today" — researcher should propose approach.

### Deferred Ideas (OUT OF SCOPE)
None.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| — | Onboarding / Multi-Language — `/onboarding` route, native+target language, AI prompt integration | AuthContext user type must extend; PATCH endpoint needed; AI service already accepts language params |
| — | User Playlists & Collections — CRUD, inline undo toast, empty state with CTA | New tables needed (playlists, playlist_songs); new route file; follow existing Express+SQLite pattern |
| — | Gamification (Badges) — 5 core badges, cool-tone palette, toast unlock, grayscale-to-color grid | New tables needed (badges, user_badges); new route file; dashboard card integration; lucide-react icons |
| — | SRS Review Room — `/review` page, SM-2 engine, simultaneous word+translation, 3 buttons | SRS engine and progress routes reusable; new frontend page only; POST /progress/review endpoint already handles SM-2 updates |

---

## Executive Summary

Phase 9 adds four capabilities that transform Harmonix from a stateless utility into a sticky daily habit. The backend already has the core SRS engine (`srsEngine.js`) and progress API routes (`POST /review`, `GET /due`), so the Review Room is primarily a frontend build. The major backend work is: (1) adding `native_language` to users + a PATCH endpoint, (2) creating `playlists`/`playlist_songs` tables and CRUD routes, (3) creating `badges`/`user_badges` tables with server-side unlock detection. All frontend work follows established patterns — the dashboard card grid, DailyWordCard loading/error/empty states, CVA Button variants, apiFetch, and AuthContext.

**Primary recommendation:** Reuse existing SRS engine and progress routes as-is. Build three new Express route files (`playlists.js`, `badges.js`, `user.js`) and three new frontend pages (`/onboarding`, `/review`, `/playlists`). Extend AuthContext user type with language fields.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Onboarding UX flow | Browser/Client | API/Backend | `/onboarding` route page renders wizard; language preferences persisted via PATCH endpoint |
| User playlists CRUD | API/Backend | Browser/Client | Full CRUD logic on server; frontend renders lists and manages optimistic delete+undo |
| Badge detection/unlock | API/Backend | Browser/Client | Server evaluates thresholds on relevant API calls, returns badge data in responses |
| SRS Review Room | Browser/Client | API/Backend | Flashcard UX on frontend; existing `POST /progress/review` does SRS calculation server-side |
| Language preference storage | Database | API/Backend | `native_language` column on users table; PATCH endpoint for updates |
| Dashboard badge grid | Browser/Client | — | Client renders badge state; fetches via GET /badges |
| "X words to review today" | API/Backend | Browser/Client | Existing `GET /progress/due` provides count; dashboard fetches and displays |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.19.x | HTTP server + routing | Existing project core |
| better-sqlite3 | 11.x | SQLite database | Existing — all routes use `db.prepare()` |
| nanoid | 3.3.x | Unique ID generation | Existing — used in all route files |
| jsonwebtoken | 9.x | JWT auth middleware | Existing — used via `auth.js` |
| Next.js | 16.2.9 | React framework | Existing frontend — **see AGENTS.md warning about breaking changes** |
| lucide-react | 1.18.x | Icon library | Existing — badge icons, toast icons |
| class-variance-authority | 0.7.x | CSS variant props | Existing — Button component pattern |
| tailwindcss | 4.x | Utility CSS | Existing — all styling uses Tailwind |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-select | 2.3.x | Accessible select dropdown | Onboarding language selects (already in client deps) |
| clsx + tailwind-merge | 2.x / 3.x | Class merging | Existing — via `cn()` in utils |

### Test Stack
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mocha | 11.x | Test runner | Existing — all server tests use it |
| chai | 6.x | Assertion library | Existing — `expect()` pattern used everywhere |

### Installation
```bash
# No new packages required — all dependencies already installed
```

---

## 1. SRS Reuse Analysis

### What Exists and Can Be Reused (100% reuse — no changes needed)

| Asset | File | Function | Reuse Strategy |
|-------|------|----------|----------------|
| SM-2 calculator | `server/services/srsEngine.js` | `calculateNextReview(state, performance)` → `{ nextInterval, newStability, newDifficulty, easeFactor }` | Called by `POST /review` — no changes needed |
| Performance mapper | `server/services/srsEngine.js` | `correctnessToPerformance(isCorrect, responseMs)` → `1/3/4/5` | Maps Good=5, Hard=3, Again=1 |
| Date calculator | `server/services/srsEngine.js` | `nextReviewDate(intervalDays)` → ISO string | Already used in review endpoint |
| Progress update endpoint | `server/routes/progress.js:32-83` | `POST /api/progress/review` — accepts `{ results: [{ vocab_id, is_correct, response_ms }] }` | Review Room POSTs results here after each card rating |
| Due words query | `server/routes/progress.js:85-102` | `GET /api/progress/due?limit=N` — returns words where `next_review <= today` | Review Room calls this on mount to get cards |
| user_vocab_progress table | `server/db.js:97-109` | Columns: `stability`, `difficulty`, `last_review`, `next_review`, `reps` | Already has all needed SRS columns — no migration needed |

### What Needs Building

| Component | What It Does | Location |
|-----------|-------------|----------|
| SRSReviewRoom frontend | Dedicated `/review` page with flashcard UI | `client/src/app/review/page.tsx` |
| Review count badge | Dashboard card showing "X words to review today" | Add to dashboard `page.tsx` stats card or new compact row |

### Key Integration Points

1. **Frontend `GET /api/progress/due`** on mount → receive array of `{ vocab_id, word, definition, cefr_level, song_id, line_index, char_start, stability, reps, ... }`
2. **User rates a card** (Good/Hard/Again) → map to SM-2:
   - "Good" → `{ is_correct: true, response_ms: <elapsed_ms> }` → engine returns performance 4-5
   - "Hard" → `{ is_correct: true, response_ms: <elapsed_ms> }` → engine returns performance 3
   - "Again" → `{ is_correct: false, response_ms: <elapsed_ms> }` → engine returns performance 1
3. **Session ends** (all done or "End review") → `POST /api/progress/review` with accumulated results array
4. **Due endpoint already JOINs** `song_vocab_map` and `vocab_items`, so each due word includes `song_id`, `line_index`, `char_start` — the Review Room can link back to the player or show the lyric snippet

### Mapping Buttons to SM-2

The existing `correctnessToPerformance()` maps boolean `is_correct` + `response_ms` to SM-2 quality scores. The new Review Room buttons should map as:

| Button | `is_correct` | `response_ms` | Resulting Performance | SM-2 Effect |
|--------|-------------|---------------|----------------------|-------------|
| Good | `true` | `< 1500` (fast) | 5 | Max interval increase |
| Hard | `true` | `>= 3000` (slow) | 3 | Minimal interval increase |
| Again | `false` | (any) | 1 | Reset to 1-day interval |

*This is a design choice: "Hard" could alternatively map to performance 2 (is_correct=false but remembered on seeing answer). Using `is_correct: true` with a high response_ms gives the mildest penalty while still extending the interval. This keeps "Hard" as a passing grade, which matches user expectation better.*

---

## 2. Database Schema Plan

### Existing Tables / Columns to Use (no changes needed)

| Table | Columns | Used By |
|-------|---------|---------|
| `users` | `id, email, password_hash, created_at, updated_at, cefr_level, target_language, genre, difficulty` | Add `native_language` column |
| `user_vocab_progress` | `user_id, vocab_id, stability, difficulty, last_review, next_review, reps` | SRS / Review Room |
| `user_stats` | `user_id, streak_days, total_xp, last_study_date, daily_goal` | Badge detection (streak, vocab count) |
| `vocab_items` | `id, word, definition, cefr_level, language_code` | Badge detection (vocab count) |
| `quiz_sessions` | `id, user_id, song_id, score, total_questions, completed_at` | Badge detection (perfect score check) |
| `daily_words` | `id, user_id, date, word_json` | Badge detection (daily word 7-day streak) |

### New Tables Needed

#### 1. `playlists`
```sql
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### 2. `playlist_songs`
```sql
CREATE TABLE IF NOT EXISTS playlist_songs (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  song_id TEXT NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);
```
- `song_id` references Deezer track ID (not a local FK — it's an external ID)
- Add unique index on `(playlist_id, song_id)` to prevent duplicates
- Use `ON DELETE CASCADE` so deleting a playlist removes all its songs

#### 3. `badges`
```sql
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  criteria_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
- `id`: e.g., `'streak_7'`, `'vocab_50'`, `'quiz_perfect'`, `'playlist_first'`, `'daily_word_7'`
- `criteria_json`: `{ "type": "streak_days", "threshold": 7 }` — flexible for future badges
- This table is static — seed it in `db.js` migration

#### 4. `user_badges`
```sql
CREATE TABLE IF NOT EXISTS user_badges (
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (badge_id) REFERENCES badges(id)
);
```

### Migration: Add `native_language` to users

```sql
-- In db.js, follow existing ALTER TABLE pattern:
const userCols = db.prepare("PRAGMA table_info(users)").all();
if (!userCols.some(col => col.name === 'native_language')) {
  db.exec("ALTER TABLE users ADD COLUMN native_language TEXT DEFAULT 'en'");
}
```

This follows the exact pattern at `server/db.js:50-59` for `target_language`, `genre`, and `difficulty`.

### Seeding the Badges Table

Use `INSERT OR IGNORE` in `db.js` after table creation — following project convention of inline schema+migration:

```sql
INSERT OR IGNORE INTO badges (id, name, description, icon, category, criteria_json) VALUES
  ('streak_7', '7-Day Streak', 'Maintain a 7-day learning streak', 'Flame', 'streak', '{"type":"streak_days","threshold":7}'),
  ('vocab_50', 'Vocabulary Builder', 'Learn 50 vocabulary words', 'BookOpen', 'vocabulary', '{"type":"vocab_count","threshold":50}'),
  ('quiz_perfect', 'Quiz Master', 'Get a perfect score on a quiz', 'Award', 'quiz', '{"type":"perfect_quiz","threshold":1}'),
  ('playlist_first', 'Curator', 'Create your first playlist', 'ListMusic', 'playlist', '{"type":"playlist_count","threshold":1}'),
  ('daily_word_7', 'Daily Dedication', 'Collect 7 daily words', 'CalendarDays', 'daily_word', '{"type":"daily_word_streak","threshold":7}');
```

---

## 3. API Route Design

### Existing Endpoints to Extend

| Endpoint | Change Needed | Reason |
|----------|--------------|--------|
| `POST /api/auth/register` | No change | Registration stays minimal (email+password); onboarding handles language |
| `GET /api/auth/me` | Add `native_language` to SELECT | Currently returns `cefr_level, target_language, genre, difficulty` — add `native_language` |
| `POST /api/study/:sessionId/finish` | Return `badges_unlocked[]` in response | Badge check for perfect score, streak, daily word collector |
| `POST /api/vocab/:songId` | No change needed | Already uses `userCefr` from `req.user` — language params come from user record |

### New Endpoints Needed

#### 1. User Language Preferences
```
PATCH /api/user/preferences
  Auth: Required
  Body: { native_language: string, target_language: string, genre?: string, difficulty?: string, cefr_level?: string }
  Response: { id, email, native_language, target_language, genre, difficulty, cefr_level }
  
GET /api/user/preferences
  Auth: Required
  Response: { native_language, target_language, genre, difficulty, cefr_level }
```
- Create `server/routes/user.js` with this pattern (matching existing route files)
- Both onboarding and settings page use these endpoints

#### 2. Playlist CRUD
```
GET /api/playlists
  Auth: Required
  Query: ?page=1&limit=20 (optional pagination)
  Response: { playlists: [{ id, name, song_count, created_at, updated_at }], total }
  
POST /api/playlists
  Auth: Required
  Body: { name: string }
  Response: { id, name, created_at }
  
GET /api/playlists/:id
  Auth: Required
  Response: { id, name, songs: [{ song_id, added_at, title, artist }], created_at }
  
PUT /api/playlists/:id
  Auth: Required, owner only
  Body: { name: string }
  Response: { id, name, updated_at }
  
DELETE /api/playlists/:id
  Auth: Required, owner only
  Response: { deleted: true }
  Note: Soft-delete not needed; "undo" is handled by frontend calling POST again with same name

POST /api/playlists/:id/songs
  Auth: Required, owner only
  Body: { song_id: string }
  Response: { id, playlist_id, song_id, added_at }
  
DELETE /api/playlists/:id/songs/:songId
  Auth: Required, owner only
  Response: { deleted: true }
```
- Create `server/routes/playlists.js`
- Follow `db.prepare` + `db.transaction` pattern from `progress.js`
- Response badges check: after POST /playlists (create first), check `playlist_count >= 1` → unlock `playlist_first`

#### 3. Badges
```
GET /api/badges
  Auth: Required
  Response: { badges: [{ id, name, description, icon, category, unlocked, unlocked_at }] }
  
GET /api/badges/check
  Auth: Required
  Response: { badges_unlocked: [{ id, name, icon, category }], total_unlocked: number }
```
- Create `server/routes/badges.js`
- `GET /badges` returns all badges with user's unlock status (JOIN user_badges)
- `check` endpoint is optional — the primary unlock mechanism is **piggyback** on existing API calls

#### 4. Badge Detection Strategy (D-09-11)

Unlock detection happens on relevant API responses. Add badge check logic to these existing routes:

| Existing Endpoint | Add Badge Check For | Implementation |
|------------------|---------------------|----------------|
| `POST /api/study/:sessionId/finish` (`study.js:96-140`) | `quiz_perfect` (perfect score), `streak_7` (streak detection), `vocab_50` (vocab count) | After XP update, evaluate thresholds, INSERT into user_badges, return `badges_unlocked[]` in response |
| `POST /api/playlists` (new) | `playlist_first` (first playlist) | After INSERT, check playlists count, return `badges_unlocked[]` |
| `GET /api/daily-word` (`dailyWord.js`) | `daily_word_7` (7-day streak) | After serving daily word, check consecutive daily_words for 7 days |

The badge check function should be a shared helper in `server/services/badgeService.js`:

```javascript
// Pseudocode pattern
function checkAndUnlockBadges(userId, results) {
  const txn = db.transaction(() => {
    const unlocked = [];
    for (const { badgeId, checkFn } of BADGE_CHECKS) {
      const already = db.prepare('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?').get(userId, badgeId);
      if (already) continue;
      if (checkFn(userId)) {
        db.prepare('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(userId, badgeId);
        const badge = db.prepare('SELECT * FROM badges WHERE id = ?').get(badgeId);
        unlocked.push(badge);
      }
    }
    return unlocked;
  });
  return txn();
}
```

Each `checkFn` performs the specific threshold query:
- `streak_7`: `SELECT streak_days FROM user_stats WHERE user_id = ?` → `>= 7`
- `vocab_50`: `SELECT COUNT(*) FROM user_vocab_progress WHERE user_id = ? AND reps > 0` → `>= 50`
- `quiz_perfect`: `SELECT 1 FROM quiz_sessions WHERE user_id = ? AND score = total_questions AND total_questions > 0 LIMIT 1` → exists
- `playlist_first`: `SELECT COUNT(*) FROM playlists WHERE user_id = ?` → `>= 1`
- `daily_word_7`: `SELECT COUNT(DISTINCT date) FROM daily_words WHERE user_id = ?` → `>= 7`

---

## 4. Frontend Component Architecture

### New Components Needed

| Component | Route | Pattern Source | Key States |
|-----------|-------|---------------|------------|
| **SRSReviewRoom** | `/review` | `DailyWordCard.tsx` — card with loading overlay, error banner, content area | Loading, empty ("All caught up!"), populated, error |
| **OnboardingFlow** | `/onboarding` | `LoginForm` in `register/page.tsx` — form with steps | Step 1 (language selects), Step 2 (genre+difficulty), loading, error |
| **BadgeGrid** | Dashboard card | Dashboard card pattern at `page.tsx:145-243` — `rounded-2xl border ...` | Loading, empty ("No achievements yet"), populated |
| **BadgeUnlockToast** | Global | Inline state toast (no library) — `useState` + `useEffect` auto-dismiss | Toast shown on unlock, 4s auto-dismiss |
| **PlaylistList** | Dashboard card / `/playlists` | Dashboard recent sessions pattern `page.tsx:157-181` | Loading, empty ("Your collection is empty"), populated |
| **PlaylistDetail** | `/playlists/[id]` | Recent sessions list pattern | Loading, empty (no songs), populated |
| **UndoDeleteToast** | `/playlists` | Inline state toast — bottom-center, 5s auto-dismiss with "Undo" | Active (showing undo), restoring, expired |
| **LanguageBadge** | Nav header | Nav email display at `page.tsx:108-109` — `text-[10px] font-bold uppercase tracking-widest` | Shows `{native} → {target}` when set, hidden when null |

### Existing Patterns to Follow

#### Dashboard Card Grid Pattern (`client/src/app/dashboard/page.tsx:144-243`)
- Container: `rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8`
- Icon box: `w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6`
- Heading: `<h3 className="font-black uppercase italic tracking-tighter text-xl">`
- Loading: `<div className="space-y-3 animate-pulse">` with skeleton divs
- Empty state: `<p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">`

#### Card State Pattern (`DailyWordCard.tsx`)
- Three-state pattern: `loading` (show spinner with message), `error` (show error + retry button), `data` (show content)
- Refreshing overlay: absolute inset with backdrop-blur, spinner, status message
- Banner error: inside card, `px-6 py-3 bg-red-50 dark:bg-red-950/50` with red text

#### Button Variants (`client/src/components/ui/Button.tsx`)
- `primary`: `bg-white text-black hover:bg-zinc-200 border border-white`
- `secondary`: `bg-black text-white border border-zinc-800 hover:bg-zinc-900`
- `ghost`: `hover:bg-zinc-800 hover:text-white`
- SRS rating buttons use `secondary` variant (colorless, per UI-SPEC)
- "End review" uses `ghost` variant (text-like link)

#### apiFetch Pattern (`client/src/lib/api.ts`)
- All API calls: `const res = await apiFetch('/path', { method: 'POST', headers: {...}, body: JSON.stringify(data) })`
- Automatic 401 → refresh → retry logic
- Returns Response object — check `.ok`, parse with `.json()`

#### AuthContext User Pattern (`client/src/context/AuthContext.tsx`)
- Interface `User { id: string; email: string }` — extend with optional fields
- `setUser(userData)` is called after `/auth/me` returns — will auto-include new columns
- Extend type:
  ```typescript
  export interface User {
    id: string;
    email: string;
    native_language?: string;
    target_language?: string;
    genre?: string;
    difficulty?: string;
    cefr_level?: string;
  }
  ```

### State Management Approach

No new state management library needed. Use existing patterns:

1. **Dashboard card data**: `useEffect` + `useState` (same as current dashboard `page.tsx:46-78`)
2. **Review Room session**: `useState` for index, ratings accumulator array
3. **Playlist optimistic delete**: `useState` for local list, timeout for undo window
4. **Badge unlock toast**: `useState` with auto-dismiss timer (no library)
5. **Onboarding**: `useState` for step, form values

### Onboarding Redirect Logic

In `AuthContext.tsx`, after session refresh sets the user, add a check:

```typescript
// In AuthProvider or a new useOnboardingRedirect hook
useEffect(() => {
  if (!isLoading && user && !user.native_language) {
    router.push('/onboarding');
  }
}, [user, isLoading]);
```

This should fire once per session. Use `sessionStorage` to prevent re-redirect on page refresh during onboarding (D-09-07). A simpler approach: let the `/dashboard` page check `user.native_language` on mount and redirect, storing a flag in `sessionStorage` that clears on completion or logout.

### Words-to-Review Dashboard Integration

Fetched via `GET /api/progress/due?limit=1` to get count (without fetching all words). Display as a compact card row above the grid or as a stat inside the existing Stats card:

```typescript
// In dashboard page.tsx, alongside stats fetch
const dueRes = await apiFetch('/progress/due?limit=1');
if (dueRes.ok) {
  const dueData = await dueRes.json();
  // dueData.count tells us how many words are due
}
```

Display: `"5 words to review today →"` as a link to `/review`. Follow the pattern from the existing Stats card `page.tsx:201-226`.

---

## 5. AI Service Integration

### Current State

| Function | File:Line | Parameters | Language Support |
|----------|-----------|------------|------------------|
| `extractVocabulary(lyricsText, targetLanguage, cefrLevel)` | `aiService.js:113` | String language name ("Spanish"), CEFR level | ✅ Already accepts language param |
| `generateDailyWord({ languageName, cefrLevel, genre, difficulty, avoidWords })` | `aiService.js:153` | String language name, CEFR, genre, difficulty, avoid list | ✅ Already accepts language + genre + difficulty |

### LANGUAGE_NAMES Map (in dailyWordService.js:8)

```javascript
const LANGUAGE_NAMES = { es: "Spanish", en: "English", fr: "French" };
```

This maps the user's `target_language` (stored as ISO code `'es'`) to the full name the AI prompt expects (`'Spanish'`). **This map must be extended** if new languages are added (e.g., `de: "German"`, `pt: "Portuguese"`, `ja: "Japanese"`).

### Wiring User Language Preferences into AI Calls

The data flow is already established through the user object:

1. **User selects** `native_language: 'en'`, `target_language: 'es'` on onboarding
2. **Onboarding POST** → `/api/user/preferences` → writes to `users` table
3. **AuthContext** reads `/auth/me` → includes `native_language`, `target_language` in user object
4. **DailyWordService** already reads `user.target_language` at `dailyWordService.js:176-180`:
   ```javascript
   const targetLanguage = user.target_language || 'es';
   const languageName = LANGUAGE_NAMES[targetLanguage] || 'Spanish';
   ```
5. **Vocab route** `vocab.js:31` reads `req.user.cefr_level` but currently hardcodes `'Spanish'` at line 141 — **this is the one hardcoded reference that must be fixed**: change `'Spanish'` to use the user's `target_language` from their profile:
   ```javascript
   const targetLangName = userLangMap[req.user.target_language] || 'Spanish';
   const vocab = await aiService.extractVocabulary(lyricsText, targetLangName, userCefr);
   ```

### What Exactly Needs Changing

| File | Line | Current | Change To |
|------|------|---------|-----------|
| `server/routes/vocab.js` | 141 | `'Spanish'` | `languageNameFromCode(req.user.target_language)` |
| `server/services/dailyWordService.js` | 8 | `{ es: "Spanish", en: "English", fr: "French" }` | **No change** — extend when adding new languages |
| `server/routes/dailyWord.js` | 8 | SELECT without `native_language` | Add `native_language` to SELECT |
| `server/index.js` | 147 | SELECT without `native_language` | Add `native_language` to SELECT |

Create a shared helper map (or use the existing one):
```javascript
// In a shared location or inline where needed
const LANG_CODE_TO_NAME = { es: 'Spanish', en: 'English', fr: 'French', de: 'German', pt: 'Portuguese' };
function languageNameFromCode(code) {
  return LANG_CODE_TO_NAME[code] || 'Spanish';
}
```

---

## 6. Key Patterns & Conventions

### SQLite Migration Pattern (`server/db.js`)

```javascript
// 1. Check column existence via PRAGMA
const columns = db.prepare("PRAGMA table_info(users)").all();
if (!columns.some(col => col.name === 'native_language')) {
  db.exec("ALTER TABLE users ADD COLUMN native_language TEXT DEFAULT 'en'");
}

// 2. CREATE TABLE IF NOT EXISTS for new tables
db.exec(`CREATE TABLE IF NOT EXISTS playlists (...) `);

// 3. Seed data with INSERT OR IGNORE
db.exec(`INSERT OR IGNORE INTO badges (...) VALUES (...)`);

// 4. Create indexes after table creation
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_songs_unique ON playlist_songs(playlist_id, song_id)`);
```

### Express Router Pattern

```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
const { nanoid } = require('nanoid');

router.get('/', (req, res) => {
  const userId = req.user.id;
  // db.prepare().all() / .get() / .run()
  res.json({ data });
});

router.post('/', (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  const id = nanoid();
  db.prepare('INSERT INTO ...').run(id, userId, name);
  res.status(201).json({ id, name });
});

module.exports = router;
```

Registration in `server/index.js`:
```javascript
const playlistsRouter = require('./routes/playlists');
const badgesRouter = require('./routes/badges');
const userRouter = require('./routes/user');

app.use('/api/playlists', authenticateToken, playlistsRouter);
app.use('/api/badges', authenticateToken, badgesRouter);
app.use('/api/user', authenticateToken, userRouter);
```

### Dashboard Card Pattern

```tsx
<div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px]">
  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
    <Trophy className="w-6 h-6" />
  </div>
  <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2 shrink-0">Achievements</h3>
  {/* Loading / Empty / Content states */}
</div>
```

### Badge Grid Specific Pattern

```tsx
// 3x2 grid of 48px icons
<div className="grid grid-cols-3 gap-4">
  {badges.map(badge => (
    <div key={badge.id} className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
        badge.unlocked 
          ? 'bg-zinc-100 dark:bg-zinc-900' 
          : 'bg-zinc-800/30 dark:bg-zinc-900/50'
      }`}>
        <BadgeIcon 
          icon={badge.icon} 
          className={badge.unlocked ? 'text-[color]' : 'text-zinc-700 dark:text-zinc-700 grayscale opacity-30'} 
          size={24} 
        />
      </div>
      <span className={`text-[8px] font-bold uppercase tracking-widest text-center ${
        badge.unlocked ? 'text-zinc-900 dark:text-white' : 'text-zinc-700 dark:text-zinc-700'
      }`}>
        {badge.name}
      </span>
    </div>
  ))}
</div>
```

### Button Variants for SRS Rating

Per UI-SPEC, SRS rating buttons use the `secondary` variant (colorless — no per-button colors):
```tsx
<Button variant="secondary" size="sm" onClick={() => rate('again')}>Again</Button>
<Button variant="secondary" size="sm" onClick={() => rate('hard')}>Hard</Button>
<Button variant="secondary" size="sm" onClick={() => rate('good')}>Good</Button>
```

### Loading/Error/Empty State Pattern

```tsx
// Loading
{loading && (
  <div className="space-y-3 animate-pulse">
    <div className="h-10 bg-zinc-900 rounded w-full"></div>
  </div>
)}

// Empty
{!loading && items.length === 0 && (
  <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">
    Your collection is empty.
  </p>
)}

// Error
{error && (
  <div className="px-6 py-3 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium text-center">
    {error}
  </div>
)}
```

### Undo Toast Pattern (No Library)

```tsx
const [undoState, setUndoState] = useState<{ playlistId: string, name: string } | null>(null);
const [restoring, setRestoring] = useState(false);

const handleDelete = async (playlistId: string) => {
  await apiFetch(`/playlists/${playlistId}`, { method: 'DELETE' });
  setUndoState({ playlistId, name: deletedPlaylist.name });
  setTimeout(() => setUndoState(null), 5000); // Auto-dismiss after 5s
};

const handleUndo = async () => {
  if (!undoState) return;
  setRestoring(true);
  await apiFetch('/playlists', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: undoState.name })
  });
  setUndoState(null);
  setRestoring(false);
};

// In JSX, render toast when undoState is set:
{undoState && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 ...">
    <span>Playlist deleted.</span>
    <button onClick={handleUndo} disabled={restoring}>Undo</button>
  </div>
)}
```

### Onboarding Form Pattern (Step Wizard)

Follow register page pattern (`register/page.tsx`):
- Full-page centered form: `flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white`
- Max width: `max-w-sm`
- Submit calls AuthContext method or apiFetch directly
- Error display: `<p className="text-sm text-red-500">{error}</p>`
- Loading: Button disabled with text change

For step indicator, use simple inline:
```tsx
<div className="flex gap-2 justify-center">
  <div className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-white' : 'bg-zinc-700'}`} />
  <div className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-white' : 'bg-zinc-700'}`} />
</div>
```

---

## 7. Test Strategy

### What to Test

| Test File | What to Test | Priority |
|-----------|-------------|----------|
| `server/routes/playlists.test.js` | CRUD operations, auth, empty state, song add/remove, verify owner-only access | HIGH |
| `server/routes/badges.test.js` | GET badges (locked/unlocked), badge check logic, verify duplicate unlocks don't insert | HIGH |
| `server/routes/user.test.js` | PATCH preferences, GET preferences, verify DB write | HIGH |
| `server/services/badgeService.test.js` | Unit test each badge check function: streak_7, vocab_50, quiz_perfect, playlist_first, daily_word_7 | MEDIUM |
| `client/src/app/review/page.tsx` (component test) | Card display, rating buttons, progress counter, end review, empty state | LOW (no client test infra) |

### Existing Test Patterns to Follow

**Pattern 1: Basic setup** (`progress.test.js:1-28`)
```javascript
const { expect } = require('chai');
const router = require('./yourRouter');
const db = require('../db');

const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  return r;
};

function ensureUser(id) {
  db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, `${id}@test.com`, 'x');
}

beforeEach(() => {
  ensureUser('test-user');
  // Clean dependent tables in FK order
  db.prepare('DELETE FROM table_that_depends').run();
});
```

**Pattern 2: Dynamic route handler extraction** (`progress.test.js:33-35`)
```javascript
const handler = router.stack.find(s => s.route.path === '/stats').route.stack[0].handle;
const req = { user: { id: 'test-user' } };
const res = mockRes();
await handler(req, res);
expect(res.body).to.have.property('streak_days');
```

**Pattern 3: Auth token generation** — For tests, routes don't need real auth tokens because `req.user` is set directly on the mock request object. The `authenticateToken` middleware is only applied at `server/index.js` level, not in the route file itself.

**Pattern 4: DB cleanup in beforeEach** — DELETE from child tables first (FK order), then parent tables:
```javascript
db.prepare('DELETE FROM playlist_songs').run();
db.prepare('DELETE FROM playlists').run();
db.prepare('DELETE FROM user_badges').run();
```

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Next.js 16 breaking changes** (per `client/AGENTS.md`) | HIGH | HIGH | Read `node_modules/next/dist/docs/` before writing any frontend code. The AGENTS.md explicitly warns that this is "NOT the Next.js you know." |
| **AI prompt needs language parameter** for `vocab.js` | MEDIUM | MEDIUM | `extractVocabulary()` already accepts `targetLanguage` param, but `vocab.js:141` hardcodes `'Spanish'`. Must read user's `target_language` from DB. |
| **Badge detection on quiz finish adds latency** | LOW | MEDIUM | Badge checks run in the same transaction as XP update. Keep queries simple (COUNT, SELECT). Add index on `user_badges(user_id)` if needed. |
| **Empty playlists with zero songs** | LOW | LOW | Schema allows it. Frontend PlaylistDetail handles empty song list with heading+body. |
| **Undo delete race condition** | LOW | MEDIUM | If user deletes same playlist twice quickly, second undo might recreate it. Mitigation: use debounce on delete button or disable during undo window. |
| **SRS Review Room performance** with 100+ due words | LOW | MEDIUM | `GET /progress/due?limit=20` limits results. Frontend loads small batches. SM-2 calculation is O(1) per card. |
| **Grayscale badge icons CSS compatibility** | LOW | LOW | Use Tailwind's `grayscale` and `opacity` utilities. On locked: `grayscale opacity-30`. On unlocked: `grayscale-0 opacity-100`. |
| **Onboarding redirect after register** | MEDIUM | MEDIUM | AuthContext's `login()` calls `router.push('/dashboard')`. Must change to redirect to `/onboarding` when user has no `native_language`. Or add a check in dashboard page. |
| **Language code mismatch** | LOW | MEDIUM | Frontend sends ISO codes (`'es'`), AI service expects full names (`'Spanish'`). `dailyWordService.js:8` has mapping. Must ensure vocab route also has this mapping. |

---

## 9. File-by-File Change Summary

### Backend Changes

| File | Change Type | What to Do |
|------|-------------|-----------|
| `server/db.js` | Add schema | Add playlists, playlist_songs, badges, user_badges tables + native_language migration + badge seed data |
| `server/index.js` | Modify | Add `native_language` to `/auth/me` SELECT; register new routes (playlists, badges, user) |
| `server/routes/playlists.js` | **New file** | Playlist CRUD routes; badge check on first create |
| `server/routes/badges.js` | **New file** | GET /badges with unlock status; system badge check endpoint |
| `server/routes/user.js` | **New file** | PATCH/GET user language preferences |
| `server/routes/progress.js` | No change | Already handles SRS — Review Room consumes existing endpoints |
| `server/routes/vocab.js` | Modify line 141 | Change hardcoded `'Spanish'` to use `req.user.target_language` mapped to full name |
| `server/routes/study.js` | Modify | Add badge unlock detection in `/finish` endpoint, return `badges_unlocked[]` |
| `server/services/badgeService.js` | **New file** | Shared badge check & unlock helper |
| `server/auth.js` | No change | JWT already includes `id` and `email` — user profile fetched via `/auth/me` |

### Frontend Changes

| File | Change Type | What to Do |
|------|-------------|-----------|
| `client/src/context/AuthContext.tsx` | Modify | Extend `User` interface with optional `native_language`, `target_language`, `genre`, `difficulty`, `cefr_level` |
| `client/src/app/onboarding/page.tsx` | **New page** | 2-step language wizard; calls PATCH /api/user/preferences; "Skip → Use defaults" |
| `client/src/app/review/page.tsx` | **New page** | SRS flashcard review room; calls GET /due and POST /review; 3 rating buttons; progress counter; "End review" |
| `client/src/app/playlists/page.tsx` | **New page** | Playlist list with empty state; create playlist form; delete with undo toast |
| `client/src/app/playlists/[id]/page.tsx` | **New page** | Playlist detail with song list, remove button |
| `client/src/app/dashboard/page.tsx` | Modify | Add Achievements card (BadgeGrid), "X words to review" indicator, language badge in nav, onboarding redirect check |
| `client/src/app/layout.tsx` | No change | AuthProvider + ThemeProvider already wraps everything |
| `client/src/lib/api.ts` | No change | apiFetch handles auth automatically — new endpoints work as-is |

---

## 10. SRS Review Room UX Proposal (the agent's Discretion)

### Layout
- Centered single card, `max-w-md`, vertically centered on page
- Card: `rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden`

### Card Content
1. **Progress header**: `"3/12"` badge at top-left of card — `bg-zinc-100 dark:bg-zinc-900 text-xs font-bold uppercase tracking-widest px-2 py-1 rounded`
2. **Word**: Large display — `text-5xl font-black tracking-tighter uppercase italic text-zinc-900 dark:text-white text-center`
3. **Translation**: Below word — `text-lg font-medium text-zinc-500 text-center`
4. **Lyric snippet** (if available): At bottom of card — italic muted text with highlighted word (following `DailyWordCard.tsx:212-215` pattern)
5. **Rating buttons**: Horizontal row at bottom — `Button variant="secondary"` x3 (Good / Hard / Again)
6. **"End review"**: Ghost button below rating row — `Button variant="ghost"` with text `"End review"`

### Interaction Flow
1. On mount, `GET /api/progress/due?limit=20` → get due words
2. If `count === 0` → show "All caught up!" empty state with subtle checkmark animation
3. If cards exist → show first card immediately
4. User reads word + translation simultaneously (no flip)
5. User clicks rating → append result to local accumulator array → advance to next card
6. On last card OR "End review" click → `POST /api/progress/review` with all accumulated results
7. On success → redirect to dashboard or show completion state

### Empty State ("All caught up!")
- Checkmark icon: `CheckCircle2` from lucide-react, large, green-ish
- Heading: `"All caught up!"` — `text-2xl font-black uppercase italic tracking-tighter`
- Body: `"No words due for review. Come back tomorrow."`
- Subtle celebration: CSS animation on the checkmark (pulse/scale)

### Edge Cases
- **Zero due words**: Render SRSReviewEmpty state
- **API failure on POST /review**: Show error banner, keep accumulated results in state, allow retry
- **Only 1 card in session**: End review button saves that 1 card's result
- **Network disconnect during review**: Accumulated results stay in state; attempt POST on reconnect

---

## Sources

### Primary (HIGH confidence)
- `server/services/srsEngine.js` — Full SM-2 implementation verified: `calculateNextReview`, `correctnessToPerformance`, `nextReviewDate`
- `server/routes/progress.js` — Working review endpoint (POST `/review`) and due query (GET `/due`)
- `server/db.js` — Complete schema with migration patterns
- `server/routes/vocab.js:141` — Confirmed hardcoded `'Spanish'` string
- `server/services/dailyWordService.js:8` — LANGUAGE_NAMES map and language wiring
- `client/src/app/dashboard/page.tsx` — Dashboard card pattern verified
- `client/src/components/DailyWordCard.tsx` — Card state pattern verified
- `client/src/components/ui/Button.tsx` — CVA button variants verified
- `client/src/context/AuthContext.tsx` — User interface verified (currently `{ id, email }` only)
- `client/src/lib/api.ts` — apiFetch pattern verified
- `client/src/app/layout.tsx` — Provider wrapper pattern verified
- `server/routes/progress.test.js` — Test pattern verified
- `server/routes/study.test.js` — Test pattern with AI mock verified
- `client/AGENTS.md` — Next.js breaking change warning verified
- `client/package.json` — `@radix-ui/react-select` ^2.3.0 already installed
- `server/package.json` — nanoid ^3.3.7, better-sqlite3 ^11.0.0 verified

### Secondary (MEDIUM confidence)
- UI-SPEC.md — Full interaction design contract for all components [CITED: `.planning/phases/09-retention-gamification-personalization/09-UI-SPEC.md`]
- CONTEXT.md — All decisions and discretion areas [CITED: `.planning/phases/09-retention-gamification-personalization/09-CONTEXT.md`]

### Tertiary (LOW confidence)
- None — all claims verified via codebase audit or official project artifacts

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The SRS Review Room can POST `is_correct: true` with `response_ms` for all three buttons and `is_correct: false` for "Again" | SRS Reuse Analysis | Low — the `correctnessToPerformance()` function handles this correctly. Only risk is user perception of "Hard" as a failing grade. |
| A2 | `next_review IS NULL` in the `/due` query will include words that were never reviewed before | SRS Reuse Analysis | Low — confirmed by `progress.js:96`: `(uvp.next_review IS NULL OR DATE(uvp.next_review) <= DATE('now'))`. |
| A3 | The `badgeService.js` helper function should be a new file | API Route Design | Low — could alternatively inline badge checks in each route. New file is cleaner. |

---

## Open Questions

1. **Should "Hard" map to `is_correct: true` (performance 3) or `is_correct: false` (performance 2)?**
   - What we know: `correctnessToPerformance(true, 3000+)` returns 3, `correctnessToPerformance(false)` returns 1. There's no performance 2 exposed.
   - Recommendation: Treat "Hard" as `is_correct: true` with high `response_ms` (3000+). This matches user expectation that "Hard" is still correct. The SM-2 interval increase will be minimal (performance 3).

2. **Should playlists support reordering songs?**
   - What we know: Standard CRUD approach (per the agent's discretion). No ordering requirement in scope.
   - Recommendation: Not needed for MVP. Songs appear in `added_at` order. Add `sort_order` column if reordering becomes a future requirement.

3. **How to handle the "X words to review today" count when the due count is high?**
   - What we know: GET `/progress/due` returns all due words (with `limit` param defaulting to 20).
   - Recommendation: Use `GET /progress/due?limit=1` just to get the `count` property for dashboard display. The actual words are fetched when the user enters the Review Room.

4. **Should onboarding create a `user_stats` row?**
   - What we know: `user_stats` is created lazily on first stats fetch (`progress.js:9-13`).
   - Recommendation: No change needed — the stats row is created on first dashboard visit or study session.

---

## Environment Availability

> **Note:** Environment availability was not probed because Phase 9 is a code-only phase (no new external tools, databases, or services beyond what's already in use). All dependencies are already installed and tested in previous phases.

| Dependency | Required By | Available | Version (from package.json) | Fallback |
|------------|------------|-----------|-----------------------------|----------|
| Express | API routes | Already installed | ^4.19.2 | — |
| better-sqlite3 | Database | Already installed | ^11.0.0 | — |
| Next.js | Frontend | Already installed | 16.2.9 | — |
| lucide-react | Icons | Already installed | ^1.18.0 | — |
| class-variance-authority | Button variants | Already installed | ^0.7.1 | — |
| @radix-ui/react-select | Select dropdowns | Already installed | ^2.3.0 | — |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | mocha ^11.7.6 + chai ^6.2.2 |
| Config file | In package.json test script |
| Quick run command | `npm test -- --grep "Playlist|Badge|User"` |
| Full suite command | `npm test` (runs all `*test.js` in services, routes, utils) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — | Playlist CRUD: create, read, update, delete, list | unit | `npm test -- --grep "Playlist"` | ❌ Wave 0 |
| — | Badge: list all badges, show unlock status | unit | `npm test -- --grep "Badge"` | ❌ Wave 0 |
| — | Badge: unlock detection prevents duplicate inserts | unit | `npm test -- --grep "Badge"` | ❌ Wave 0 |
| — | User: PATCH preferences writes to DB, returns updated user | unit | `npm test -- --grep "User"` | ❌ Wave 0 |
| — | Onboarding: verify redirect when native_language is null | e2e | manual | ❌ Wave 0 |
| — | SRS Review: existing progress.test.js still passes | unit | `npm test -- --grep "Progress"` | ✅ Already exists |

### Sampling Rate
- **Per task commit:** `npm test -- --grep "Playlist|Badge|User|Progress"` (new routes + SRS)
- **Per wave merge:** Full `npm test` suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/routes/playlists.test.js` — covers playlist CRUD, auth, owner enforcement, empty states
- [ ] `server/routes/badges.test.js` — covers badge list, unlock detection, duplicate prevention
- [ ] `server/routes/user.test.js` — covers PATCH/GET preferences, field validation

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | JWT access + refresh token (existing — `auth.js`) |
| V3 Session Management | Yes | HttpOnly refresh cookie (existing) |
| V4 Access Control | Yes | `req.user.id` check for playlist ownership — verify `user_id` matches before UPDATE/DELETE |
| V5 Input Validation | Yes | PATCH preferences: validate `target_language` is a known ISO code; sanitize playlist name (max length, strip XSS) |
| V6 Cryptography | No — no new secrets | None |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Playlist IDOR (access another user's playlist) | Information Disclosure | All playlist routes check `WHERE user_id = req.user.id` — same pattern as existing routes |
| Badge unlock replay (re-triggering unlock) | Tampering | `INSERT OR IGNORE` or check `SELECT 1 FROM user_badges` before inserting — prevents duplicate badges |
| XSS via playlist name | Spoofing | SQLite parameterized queries prevent SQL injection. Frontend: React auto-escapes. Add playlist name length validation (max 100 chars). |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json
- Architecture: HIGH — patterns verified against existing codebase
- Pitfalls: MEDIUM — Next.js 16 breaking changes flagged but unverified

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (standard 30-day window)
