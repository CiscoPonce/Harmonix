# Phase 9: Retention, Gamification & Personalization — Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 19 (9 new, 10 modify)
**Analogs found:** 17 / 19 (2 test files with no exact analog — use test pattern template)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/routes/playlists.js` | route | CRUD | `server/routes/progress.js` | exact (route+CRUD) |
| `server/routes/badges.js` | route | request-response | `server/routes/progress.js` | exact (route+CRUD) |
| `server/routes/user.js` | route | request-response | `server/routes/dailyWord.js` | role-match |
| `server/services/badgeService.js` | service | CRUD | `server/services/srsEngine.js` | role-match |
| `server/db.js` | config | schema | `server/db.js` (self) | exact (same file) |
| `server/index.js` | config | init | `server/index.js` (self) | exact (same file) |
| `server/routes/vocab.js` | route | request-response | `server/routes/vocab.js` (self) | exact (same file) |
| `server/routes/study.js` | route | CRUD | `server/routes/study.js` (self) | exact (same file) |
| `client/src/app/onboarding/page.tsx` | page | form-submit | `client/src/app/register/page.tsx` | role-match (page+form) |
| `client/src/app/review/page.tsx` | page | request-response | `client/src/app/dashboard/page.tsx` | role-match (page) |
| `client/src/app/playlists/page.tsx` | page | request-response | `client/src/app/dashboard/page.tsx` | role-match (page) |
| `client/src/app/playlists/[id]/page.tsx` | page | request-response | `client/src/app/dashboard/page.tsx` | role-match (page) |
| `client/src/components/BadgeGrid.tsx` | component | display | `client/src/components/DailyWordCard.tsx` | role-match (component) |
| `client/src/components/BadgeUnlockToast.tsx` | component | event-driven | `client/src/components/DailyWordCard.tsx` | role-match (component) |
| `client/src/components/UndoDeleteToast.tsx` | component | event-driven | `client/src/components/DailyWordCard.tsx` | role-match (component) |
| `client/src/components/LanguageBadge.tsx` | component | display | `client/src/components/ThemeToggle.tsx` | exact (nav item component) |
| `client/src/components/ReviewCountBadge.tsx` | component | display | `client/src/components/DailyWordCard.tsx` | role-match (component) |
| `client/src/context/AuthContext.tsx` | context | state | `client/src/context/AuthContext.tsx` (self) | exact (same file) |
| `client/src/app/dashboard/page.tsx` | page | request-response | `client/src/app/dashboard/page.tsx` (self) | exact (same file) |
| `server/routes/playlists.test.js` | test | CRUD | `server/routes/progress.test.js` | exact (test+CRUD) |
| `server/routes/badges.test.js` | test | request-response | `server/routes/progress.test.js` | exact (test pattern) |
| `server/routes/user.test.js` | test | request-response | `server/routes/progress.test.js` | exact (test pattern) |
| `server/services/badgeService.test.js` | test | CRUD | `server/routes/progress.test.js` | role-match (test pattern) |

---

## Pattern Assignments

---

### `server/routes/playlists.js` (route, CRUD) — NEW

**Analog:** `server/routes/progress.js` (lines 1-104)

**Imports pattern** (lines 1-4):
```javascript
const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');   // study.js:3 uses this pattern
const db = require('../db');
```

**GET / pattern** (progress.js:6-30):
```javascript
router.get('/', (req, res) => {
  const userId = req.user.id;
  // db.prepare SELECT with WHERE user_id = ?
  const items = db.prepare('SELECT ... FROM ... WHERE user_id = ?').all(userId);
  res.json({ playlists: items });
});
```
**Differences:** Playlist list needs a LEFT JOIN to COUNT songs per playlist, e.g.:
```sql
SELECT p.id, p.name, p.created_at, p.updated_at,
  (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) as song_count
FROM playlists p WHERE p.user_id = ? ORDER BY p.updated_at DESC
```

**POST / pattern** (progress.js:32-83, study.js:96-140):
Use inline SQL with `db.transaction` for atomicity. Create a nanoid for the id:
```javascript
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name_required' });
  }
  const safeName = name.trim().slice(0, 100);

  const id = nanoid();
  db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(id, userId, safeName);

  // Badge check for playlist_first
  const badgesUnlocked = badgeService.checkAndUnlockBadges(userId, { checkPlaylist: true });

  res.status(201).json({ id, name: safeName, created_at: new Date().toISOString(), badges_unlocked: badgesUnlocked });
});
```

**PUT/DELETE owner check** (study.js:64-66 pattern):
```javascript
const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(id, userId);
if (!playlist) return res.status(404).json({ error: 'playlist_not_found' });
```

**Error handling pattern** (study.js:21-24):
```javascript
  } catch (err) {
    console.error('playlist error:', err);
    res.status(500).json({ error: 'failed_to_manage_playlist' });
  }
```

**Song add/remove** — use unpaginated endpoint following study.js:59-94 pattern:
```javascript
router.post('/:id/songs', (req, res) => {
  // Verify playlist ownership
  // INSERT OR IGNORE or unique check
  // Return 201
});
```

**Export pattern** (progress.js:104):
```javascript
module.exports = router;
```

---

### `server/routes/badges.js` (route, request-response) — NEW

**Analog:** `server/routes/dailyWord.js` (lines 1-36) — compact route helper + `server/routes/progress.js` (lines 1-30)

**Imports pattern** (dailyWord.js:1-4):
```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
```

**GET / — list all badges with unlock status** (progress.js:6-9 pattern + SQL JOIN):
```javascript
router.get('/', (req, res) => {
  const userId = req.user.id;
  const badges = db.prepare(`
    SELECT b.*, ub.unlocked_at,
      CASE WHEN ub.user_id IS NOT NULL THEN 1 ELSE 0 END as unlocked
    FROM badges b
    LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = ?
    ORDER BY b.category
  `).all(userId);
  res.json({ badges });
});
```

**GET /check — run all badge checks** (dailyWord.js:12-31 helper pattern):
```javascript
router.get('/check', (req, res) => {
  const userId = req.user.id;
  const badgesUnlocked = badgeService.checkAndUnlockBadges(userId, { checkAll: true });
  const totalUnlocked = db.prepare('SELECT COUNT(*) as count FROM user_badges WHERE user_id = ?').get(userId).count;
  res.json({ badges_unlocked: badgesUnlocked, total_unlocked: totalUnlocked });
});
```

**Error handling** — inline try/catch (dailyWord.js:22-30 pattern):
```javascript
  } catch (err) {
    console.error('badge error:', err);
    res.status(500).json({ error: 'failed_to_fetch_badges' });
  }
```

---

### `server/routes/user.js` (route, request-response) — NEW

**Analog:** `server/routes/dailyWord.js` (lines 1-36)

**GET /preferences** (dailyWord.js:6-10 loadUser pattern):
```javascript
router.get('/preferences', (req, res) => {
  const user = db.prepare(
    'SELECT id, email, native_language, target_language, genre, difficulty, cefr_level FROM users WHERE id = ?'
  ).get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json({
    native_language: user.native_language,
    target_language: user.target_language,
    genre: user.genre,
    difficulty: user.difficulty,
    cefr_level: user.cefr_level
  });
});
```

**PATCH /preferences** (study.js:96-140 transaction pattern):
```javascript
router.patch('/preferences', (req, res) => {
  const userId = req.user.id;
  const { native_language, target_language, genre, difficulty, cefr_level } = req.body;

  // Validate target_language is known ISO code
  const validLangs = ['en', 'es', 'fr', 'de', 'pt'];
  if (target_language && !validLangs.includes(target_language)) {
    return res.status(400).json({ error: 'invalid_target_language' });
  }

  // Build dynamic UPDATE statement (follow existing pattern — just UPDATE all columns)
  db.prepare(`
    UPDATE users SET
      native_language = COALESCE(?, native_language),
      target_language = COALESCE(?, target_language),
      genre = COALESCE(?, genre),
      difficulty = COALESCE(?, difficulty),
      cefr_level = COALESCE(?, cefr_level),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(native_language || null, target_language || null, genre || null, difficulty || null, cefr_level || null, userId);

  const user = db.prepare('SELECT id, email, native_language, target_language, genre, difficulty, cefr_level FROM users WHERE id = ?').get(userId);
  res.json(user);
});
```

---

### `server/services/badgeService.js` (service, CRUD) — NEW

**Analog:** `server/services/srsEngine.js` (lines 1-85) — module with exported functions

**Module pattern** (srsEngine.js:1-3, 79-85):
```javascript
const db = require('../db');

function checkAndUnlockBadges(userId, options) {
  const txn = db.transaction(() => {
    const unlocked = [];
    const checks = [
      { id: 'streak_7', check: () => {
        const row = db.prepare('SELECT streak_days FROM user_stats WHERE user_id = ?').get(userId);
        return row && row.streak_days >= 7;
      }},
      { id: 'vocab_50', check: () => {
        const row = db.prepare('SELECT COUNT(*) as count FROM user_vocab_progress WHERE user_id = ? AND reps > 0').get(userId);
        return row && row.count >= 50;
      }},
      { id: 'quiz_perfect', check: () => {
        const row = db.prepare('SELECT 1 FROM quiz_sessions WHERE user_id = ? AND score = total_questions AND total_questions > 0 LIMIT 1').get(userId);
        return !!row;
      }},
      { id: 'playlist_first', check: () => {
        if (!options || !options.checkPlaylist) return false;
        const row = db.prepare('SELECT COUNT(*) as count FROM playlists WHERE user_id = ?').get(userId);
        return row && row.count >= 1;
      }},
      { id: 'daily_word_7', check: () => {
        const row = db.prepare('SELECT COUNT(DISTINCT date) as count FROM daily_words WHERE user_id = ?').get(userId);
        return row && row.count >= 7;
      }},
    ];

    for (const { id, check } of checks) {
      const already = db.prepare('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?').get(userId, id);
      if (already) continue;
      if (check()) {
        db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_id) VALUES (?, ?)').run(userId, id);
        const badge = db.prepare('SELECT id, name, description, icon, category FROM badges WHERE id = ?').get(id);
        if (badge) unlocked.push(badge);
      }
    }
    return unlocked;
  });
  return txn();
}

module.exports = { checkAndUnlockBadges };
```

**Key pattern:** The `srsEngine.js` uses simple pure functions. This service uses `db` at module scope (same pattern as `dailyWordService.js`). The `db.transaction` wrapper follows `progress.js:51-79`.

---

### `server/db.js` — Schema Additions (MODIFY)

**Analog:** Self — follow existing migration patterns at `server/db.js`

**ALTER TABLE pattern** for `native_language` (lines 49-59, the user preferences migration):
```javascript
// Migration: native_language for personalization
const langCols = db.prepare("PRAGMA table_info(users)").all();
if (!langCols.some(col => col.name === 'native_language')) {
  db.exec("ALTER TABLE users ADD COLUMN native_language TEXT DEFAULT 'en'");
}
```

**CREATE TABLE IF NOT EXISTS** for `playlists` (follow lines 62-71 pattern for vocab_items):
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);
```

**CREATE TABLE IF NOT EXISTS** for `playlist_songs` (follow lines 82-94 pattern for song_vocab_map):
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS playlist_songs (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL,
    song_id TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
  )
`);
```

**CREATE TABLE IF NOT EXISTS** for `badges` (follow lines 96-109 pattern for user_vocab_progress):
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    criteria_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
```

**CREATE TABLE IF NOT EXISTS** for `user_badges`:
```javascript
db.exec(`
  CREATE TABLE IF NOT EXISTS user_badges (
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (badge_id) REFERENCES badges(id)
  )
`);
```

**Unique index** for playlist_songs (follow lines 76-80 pattern for idx_vocab_canonical_key):
```javascript
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_songs_unique ON playlist_songs(playlist_id, song_id)`);
```

**Seed data** with `INSERT OR IGNORE` (follow existing seed logic — no direct analog, but follows SQLite convention used elsewhere):
```javascript
const badgeCount = db.prepare('SELECT COUNT(*) as count FROM badges').get().count;
if (badgeCount === 0) {
  db.exec(`INSERT OR IGNORE INTO badges (id, name, description, icon, category, criteria_json) VALUES
    ('streak_7', '7-Day Streak', 'Maintain a 7-day learning streak', 'Flame', 'streak', '{"type":"streak_days","threshold":7}'),
    ('vocab_50', 'Vocabulary Builder', 'Learn 50 vocabulary words', 'BookOpen', 'vocabulary', '{"type":"vocab_count","threshold":50}'),
    ('quiz_perfect', 'Quiz Master', 'Get a perfect score on a quiz', 'Award', 'quiz', '{"type":"perfect_quiz","threshold":1}'),
    ('playlist_first', 'Curator', 'Create your first playlist', 'ListMusic', 'playlist', '{"type":"playlist_count","threshold":1}'),
    ('daily_word_7', 'Daily Dedication', 'Collect 7 daily words', 'CalendarDays', 'daily_word', '{"type":"daily_word_streak","threshold":7}')
  `);
}
```

**Placement:** Add ALL new schema code at line 230 (after `daily_words` table creation, before `ensureCanonicalKeys` call at line 234).

---

### `server/index.js` — Route Registration (MODIFY)

**Analog:** Self — follow existing route registration at lines 265-270

**Add `native_language` to `/auth/me` SELECT** (line 147):
```javascript
// Change from:
'SELECT id, email, created_at, cefr_level, target_language, genre, difficulty FROM users WHERE id = ?'
// To:
'SELECT id, email, created_at, native_language, cefr_level, target_language, genre, difficulty FROM users WHERE id = ?'
```

**Register new routes** (after line 270, before the proxy at line 272):
```javascript
const playlistsRouter = require('./routes/playlists');
const badgesRouter = require('./routes/badges');
const userRouter = require('./routes/user');

app.use('/api/playlists', authenticateToken, playlistsRouter);
app.use('/api/badges', authenticateToken, badgesRouter);
app.use('/api/user', authenticateToken, userRouter);
```

---

### `server/routes/vocab.js` — Fix Hardcoded 'Spanish' (MODIFY)

**Analog:** Self — line 141

**Change line 141** from:
```javascript
const vocab = await aiService.extractVocabulary(lyricsText, 'Spanish', userCefr);
```
To:
```javascript
const langCode = req.user.target_language || 'es';
const LANG_CODE_TO_NAME = { es: 'Spanish', en: 'English', fr: 'French', de: 'German', pt: 'Portuguese' };
const targetLangName = LANG_CODE_TO_NAME[langCode] || 'Spanish';
const vocab = await aiService.extractVocabulary(lyricsText, targetLangName, userCefr);
```

**Note:** This map should ideally live in a shared location (e.g., `server/services/dailyWordService.js:8` already has it as `LANGUAGE_NAMES`). Either import from there or define inline. The LANGUAGE_NAMES map at dailyWordService.js:8 is:
```javascript
const LANGUAGE_NAMES = { es: "Spanish", en: "English", fr: "French" };
```

---

### `server/routes/study.js` — Add Badge Detection in `/finish` (MODIFY)

**Analog:** Self, lines 96-140

**After the XP update in the transaction** (after line 134, before transaction closes), add:
```javascript
// Import badgeService at top of file
const badgeService = require('../services/badgeService');

// Inside the transaction, after XP update (around line 134):
});

// AFTER transaction runs (after line 137), add badge check:
const badgesUnlocked = badgeService.checkAndUnlockBadges(userId, { checkQuiz: true });

// Add badges_unlocked to response (modify line 139):
res.json({ session_id: sessionId, score, total_questions: total, badges_unlocked: badgesUnlocked });
```

**Import line** (add after line 7):
```javascript
const badgeService = require('../services/badgeService');
```

---

### `client/src/app/onboarding/page.tsx` (page, form-submit) — NEW

**Analog:** `client/src/app/register/page.tsx` (lines 1-104)

**Page wrapper** (register.tsx:37):
```tsx
<div className="flex min-h-screen flex-col items-center justify-center bg-black px-4 text-white">
  <div className="w-full max-w-sm space-y-8">
```

**Step 1 — Language selects** (register.tsx:43-54 field pattern):
```tsx
<form onSubmit={handleStep1} className="space-y-4">
  <div className="space-y-2">
    <label htmlFor="native_language" className="text-sm font-medium">Native Language</label>
    <select id="native_language" className="flex h-9 w-full rounded-md border border-zinc-800 bg-black px-3 py-1 text-sm" value={nativeLang} onChange={...} required>
      <option value="">Select...</option>
      <option value="en">English</option>
      <option value="es">Spanish</option>
      <option value="fr">French</option>
    </select>
  </div>
  {/* Same for target_language */}
</form>
```

**Step 2 — Genre + difficulty** (register.tsx:43-54 pattern):
```tsx
<label className="text-sm font-medium">Preferred Genre</label>
<select ...>
  <option value="">Any</option>
  <option value="pop">Pop</option>
  <option value="rock">Rock</option>
  <option value="hip-hop">Hip-Hop</option>
  <option value="reggaeton">Reggaeton</option>
</select>
```

**Submit and error handling** (register.tsx:17-34):
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);
  try {
    const res = await apiFetch('/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ native_language: nativeLang, target_language: targetLang, genre, difficulty })
    });
    if (!res.ok) throw new Error('Failed to save preferences');
    router.push('/dashboard');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to save');
  } finally {
    setIsLoading(false);
  }
};
```

**Skip button** (register.tsx:91-93 Button pattern):
```tsx
<Button variant="ghost" onClick={() => router.push('/dashboard')} className="text-[10px] font-bold uppercase tracking-widest">
  Skip → Use defaults
</Button>
```

**Step indicator** (inline per UI-SPEC):
```tsx
<div className="flex gap-2 justify-center">
  <div className={`w-2 h-2 rounded-full ${step === 1 ? 'bg-white' : 'bg-zinc-700'}`} />
  <div className={`w-2 h-2 rounded-full ${step === 2 ? 'bg-white' : 'bg-zinc-700'}`} />
</div>
```

---

### `client/src/app/review/page.tsx` (page, request-response) — NEW

**Analog:** `client/src/app/dashboard/page.tsx` (lines 1-252)

**Page wrapper and auth check** (dashboard.tsx:1-14, 15-17, 40-44, 84-95):
```tsx
'use client';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ReviewPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);
```

**State pattern** (dashboard.tsx:19-38):
```tsx
const [dueWords, setDueWords] = useState<any[]>([]);
const [currentIndex, setCurrentIndex] = useState(0);
const [results, setResults] = useState<Array<{vocab_id: string, is_correct: boolean, response_ms: number}>>([]);
const [pageLoading, setPageLoading] = useState(true);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Data fetching** (dashboard.tsx:46-78):
```tsx
useEffect(() => {
  if (!user) return;
  let active = true;
  async function loadDue() {
    try {
      const res = await apiFetch('/progress/due?limit=20');
      if (!active) return;
      if (res.ok) {
        const data = await res.json();
        setDueWords(data.due);
      } else {
        setError('Could not load review words. Try again.');
      }
    } catch (err) {
      setError('Could not load review words. Try again.');
    } finally {
      if (active) setPageLoading(false);
    }
  }
  loadDue();
  return () => { active = false; };
}, [user]);
```

**Loading state** (dashboard.tsx:84-92):
```tsx
if (isLoading || pageLoading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}
```

**Empty state** (dashboard.tsx:183-185 pattern):
```tsx
if (dueWords.length === 0) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white gap-6">
      <CheckCircle2 className="w-16 h-16 text-green-500 animate-pulse" />
      <h2 className="text-2xl font-black uppercase italic tracking-tighter">All caught up!</h2>
      <p className="text-zinc-500 font-medium">No words due for review. Come back tomorrow.</p>
      <Link href="/dashboard"><Button variant="secondary">Back to Dashboard</Button></Link>
    </div>
  );
}
```

**Card display pattern** (DailyWordCard.tsx:196-229 pattern):
```tsx
<div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden max-w-md w-full">
  {/* Progress header */}
  <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-900 flex justify-between items-center">
    <span className="bg-zinc-100 dark:bg-zinc-900 text-xs font-bold uppercase tracking-widest px-2 py-1 rounded">
      {currentIndex + 1}/{dueWords.length}
    </span>
  </div>
  {/* Word */}
  <div className="p-8 space-y-6 text-center">
    <p className="text-5xl font-black tracking-tighter uppercase italic text-zinc-900 dark:text-white">
      {dueWords[currentIndex].word}
    </p>
    <p className="text-lg font-medium text-zinc-500">{dueWords[currentIndex].definition}</p>
  </div>
  {/* Rating buttons */}
  <div className="px-8 pb-6 flex justify-center gap-3">
    <Button variant="secondary" onClick={() => rate('again')}>Again</Button>
    <Button variant="secondary" onClick={() => rate('hard')}>Hard</Button>
    <Button variant="secondary" onClick={() => rate('good')}>Good</Button>
  </div>
  {/* End review */}
  <div className="text-center pb-6">
    <Button variant="ghost" onClick={endReview} disabled={submitting}>
      End review
    </Button>
  </div>
</div>
```

**Rating handler** (SM-2 mapping per RESEARCH.md):
```tsx
function rate(level: 'good' | 'hard' | 'again') {
  const word = dueWords[currentIndex];
  const mapping = {
    good: { is_correct: true, response_ms: 1200 },
    hard: { is_correct: true, response_ms: 3500 },
    again: { is_correct: false, response_ms: 5000 },
  };
  setResults(prev => [...prev, { vocab_id: word.vocab_id, ...mapping[level] }]);
  if (currentIndex < dueWords.length - 1) {
    setCurrentIndex(prev => prev + 1);
  } else {
    endReviewWithResults([...results, { vocab_id: word.vocab_id, ...mapping[level] }]);
  }
}
```

**End review submit** (apiFetch pattern from dashboard.tsx:52-55):
```tsx
async function endReviewWithResults(finalResults: typeof results) {
  setSubmitting(true);
  try {
    const res = await apiFetch('/progress/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: finalResults }),
    });
    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError('Failed to save review results. Try again.');
    }
  } catch {
    setError('Failed to save review results. Try again.');
  } finally {
    setSubmitting(false);
  }
}
```

---

### `client/src/app/playlists/page.tsx` (page, request-response) — NEW

**Analog:** `client/src/app/dashboard/page.tsx` (lines 146-186 — Recent sessions card pattern) extended to full page

**Page layout** (dashboard.tsx:98):
```tsx
<div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
  {/* Nav */}
  <nav className="p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-xl sticky top-0 z-10">
    <Link href="/dashboard" className="flex items-center gap-3">
      <h1 className="text-2xl font-black tracking-tighter uppercase italic">Playlists</h1>
    </Link>
    <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard')}>Back</Button>
  </nav>

  <main className="flex-1 flex flex-col items-center px-6 py-12 max-w-3xl mx-auto w-full">
    {/* Create form */}
    <form onSubmit={handleCreate} className="w-full flex gap-3 mb-12">
      <Input placeholder="Playlist name" value={newName} onChange={e => setNewName(e.target.value)} required maxLength={100} />
      <Button type="submit" disabled={creating}>Create</Button>
    </form>

    {/* Playlist list */}
    <div className="w-full space-y-3">
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 bg-zinc-900 rounded-xl"></div>
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest">Your collection is empty</p>
          <p className="text-xs text-zinc-600 mt-2">Find songs in the player and save them to build your library.</p>
          <Link href="/dashboard"><Button variant="secondary" className="mt-4">Explore songs</Button></Link>
        </div>
      ) : (
        playlists.map(p => (
          <PlaylistRow key={p.id} playlist={p} onDelete={handleDelete} />
        ))
      )}
    </div>
  </main>
</div>
```

**Delete with undo** (see UndoDeleteToast component pattern below):
```tsx
const [undoState, setUndoState] = useState<{ id: string; name: string } | null>(null);
const handleDelete = async (id: string, name: string) => {
  await apiFetch(`/playlists/${id}`, { method: 'DELETE' });
  setUndoState({ id, name });
  setTimeout(() => setUndoState(null), 5000);
};
```

**API fetch pattern** (dashboard.tsx:46-78):
```tsx
const [playlists, setPlaylists] = useState<any[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!user) return;
  apiFetch('/playlists').then(r => r.ok && r.json()).then(d => {
    setPlaylists(d.playlists || []);
    setLoading(false);
  }).catch(() => setLoading(false));
}, [user]);
```

---

### `client/src/app/playlists/[id]/page.tsx` (page, request-response) — NEW

**Analog:** `client/src/app/dashboard/page.tsx` (lines 146-186) — list items with links

**URL param access** (Next.js 16 — use `params` prop):
```tsx
export default function PlaylistDetailPage({ params }: { params: { id: string } }) {
  const playlistId = params.id;
```

**Data fetching** (dashboard.tsx:46-78):
```tsx
const [playlist, setPlaylist] = useState<any>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!user) return;
  apiFetch(`/playlists/${playlistId}`).then(r => r.ok && r.json()).then(d => {
    setPlaylist(d);
    setLoading(false);
  }).catch(() => setLoading(false));
}, [user, playlistId]);
```

**Song list rendering** (dashboard.tsx:158-181 — recent sessions items):
```tsx
{playlist.songs.length === 0 ? (
  <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest">No songs yet. Search and add songs from the player.</p>
) : (
  <div className="space-y-2">
    {playlist.songs.map((song: any) => (
      <div key={song.song_id} className="flex justify-between items-center p-3 rounded-lg border border-zinc-200 dark:border-zinc-900">
        <Link href={`/player/${song.song_id}`} className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider">{song.title || 'Unknown'}</p>
        </Link>
        <button onClick={() => removeSong(song.song_id)} className="text-[10px] text-red-500 font-bold uppercase">Remove</button>
      </div>
    ))}
  </div>
)}
```

---

### `client/src/components/BadgeGrid.tsx` (component, display) — NEW

**Analog:** `client/src/components/DailyWordCard.tsx` (lines 144-163 for loading/error, lines 167-231 for content)

**Component pattern** (DailyWordCard.tsx:53-57):
```tsx
'use client';
import { apiFetch } from '@/lib/api';
import { Flame, BookOpen, Award, ListMusic, CalendarDays, Loader2 } from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: number;
  unlocked_at: string | null;
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  Flame: <Flame className="w-5 h-5" />,
  BookOpen: <BookOpen className="w-5 h-5" />,
  Award: <Award className="w-5 h-5" />,
  ListMusic: <ListMusic className="w-5 h-5" />,
  CalendarDays: <CalendarDays className="w-5 h-5" />,
};

const BADGE_COLORS: Record<string, string> = {
  streak: 'text-purple-500',
  vocabulary: 'text-pink-500',
  quiz: 'text-blue-500',
  playlist: 'text-orange-500',
  daily_word: 'text-teal-500',
};
```

**Three-state rendering** (DailyWordCard.tsx:144-163):
```tsx
if (loading) return (
  <div className="space-y-3 animate-pulse">
    <div className="grid grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-xl bg-zinc-900"></div>
          <div className="h-3 w-16 bg-zinc-900 rounded"></div>
        </div>
      ))}
    </div>
  </div>
);

if (error) return (
  <p className="text-sm text-red-500">{error}</p>
);

if (badges.length === 0) return (
  <div>
    <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">No achievements yet</p>
    <p className="text-[10px] text-zinc-600 mt-1">Complete lessons, build streaks, and explore songs to unlock badges.</p>
  </div>
);
```

**Badge grid** (UI-SPEC pattern):
```tsx
<div className="grid grid-cols-3 gap-4">
  {badges.map(badge => (
    <div key={badge.id} className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
        badge.unlocked ? 'bg-zinc-100 dark:bg-zinc-900' : 'bg-zinc-800/30 dark:bg-zinc-900/50'
      }`}>
        <div className={`${badge.unlocked ? BADGE_COLORS[badge.category] : 'text-zinc-700 dark:text-zinc-700 grayscale opacity-30'}`}>
          {BADGE_ICONS[badge.icon]}
        </div>
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

---

### `client/src/components/BadgeUnlockToast.tsx` (component, event-driven) — NEW

**Analog:** `client/src/components/DailyWordCard.tsx` (lines 55-60 useState pattern, lines 112-119 timer pattern)

**Self-contained component with auto-dismiss timer** (DailyWordCard.tsx:112-119 timer pattern):
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Flame, BookOpen, Award, ListMusic, CalendarDays, X } from 'lucide-react';

const BADGE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  streak_7: { icon: <Flame className="w-5 h-5" />, color: '#a855f7' },
  vocab_50: { icon: <BookOpen className="w-5 h-5" />, color: '#ec4899' },
  quiz_perfect: { icon: <Award className="w-5 h-5" />, color: '#3b82f6' },
  playlist_first: { icon: <ListMusic className="w-5 h-5" />, color: '#f97316' },
  daily_word_7: { icon: <CalendarDays className="w-5 h-5" />, color: '#14b8a6' },
};

export function BadgeUnlockToast({ badge, onDismiss }: { badge: { id: string; name: string } | null; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (badge) {
      setVisible(true);
      const timer = setTimeout(() => { setVisible(false); onDismiss(); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [badge, onDismiss]);

  if (!visible || !badge) return null;

  const config = BADGE_CONFIG[badge.id];
  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in">
      <div className="rounded-xl border border-zinc-800 bg-black/90 backdrop-blur-xl p-4 flex items-center gap-3 shadow-2xl">
        <div style={{ color: config?.color }}>{config?.icon}</div>
        <div>
          <p className="text-sm font-bold">{badge.name} unlocked!</p>
        </div>
        <button onClick={() => { setVisible(false); onDismiss(); }} className="text-zinc-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

---

### `client/src/components/UndoDeleteToast.tsx` (component, event-driven) — NEW

**Pattern:** Inline state in parent page (no separate component file needed per RESEARCH.md), but if extracted as a component:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface UndoState {
  playlistId: string;
  name: string;
}

export function UndoDeleteToast({ undoState, onUndo, onDismiss, restoring }: {
  undoState: UndoState | null;
  onUndo: () => void;
  onDismiss: () => void;
  restoring: boolean;
}) {
  useEffect(() => {
    if (undoState) {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [undoState, onDismiss]);

  if (!undoState) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="rounded-xl border border-zinc-800 bg-black/90 backdrop-blur-xl px-5 py-3 flex items-center gap-4 shadow-2xl">
        <span className="text-sm font-medium">Playlist deleted.</span>
        <button onClick={onUndo} disabled={restoring} className="text-xs font-bold uppercase tracking-widest text-white hover:text-zinc-300 disabled:opacity-50">
          {restoring ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Undo'}
        </button>
      </div>
    </div>
  );
}
```

---

### `client/src/components/LanguageBadge.tsx` (component, display) — NEW

**Analog:** `client/src/components/ThemeToggle.tsx` (lines 1-36) — small nav element

```tsx
'use client';
import { useAuth } from '@/hooks/useAuth';

export function LanguageBadge() {
  const { user } = useAuth();

  if (!user || !user.native_language || !user.target_language) return null;

  return (
    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border border-zinc-800 bg-black/50 text-zinc-300">
      {user.native_language.toUpperCase()} → {user.target_language.toUpperCase()}
    </span>
  );
}
```

**Dashboard nav placement** (dashboard.tsx:107-109, alongside the email display):
```tsx
<div className="flex items-center gap-3">
  <LanguageBadge />
  <ThemeToggle />
  <div className="hidden md:flex flex-col items-end">
    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Logged in as</span>
    <span className="text-xs font-bold">{user.email}</span>
  </div>
</div>
```

---

### `client/src/components/ReviewCountBadge.tsx` (component, display) — NEW

**Analog:** `client/src/components/DailyWordCard.tsx` (lines 53-108 — loading+fetching pattern)

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export function ReviewCountBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiFetch('/progress/due?limit=1').then(r => r.ok && r.json()).then(d => {
      setCount(d.count || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  if (loading) return <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />;
  if (count === null || count === 0) return null;

  return (
    <Link href="/review" className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">
      {count} {count === 1 ? 'word' : 'words'} to review today →
    </Link>
  );
}
```

---

### `client/src/context/AuthContext.tsx` — Extend User Interface (MODIFY)

**Analog:** Self, lines 7-10

**Change** from:
```typescript
export interface User {
  id: string;
  email: string;
}
```
**To:**
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

No other changes needed — the `setUser(userData)` at line 64 already calls `setUser(userData)` with whatever `/auth/me` returns, and the SELECT at `server/index.js:147` will now include `native_language`.

---

### `client/src/app/dashboard/page.tsx` — Add Badges Card, Review Count, Language Badge, Onboarding Redirect (MODIFY)

**Analog:** Self, plus components referenced above

**1. Add imports** (at top, after line 11):
```tsx
import { BadgeGrid } from '@/components/BadgeGrid';
import { LanguageBadge } from '@/components/LanguageBadge';
import { ReviewCountBadge } from '@/components/ReviewCountBadge';
```

**2. Add onboarding redirect** — in the existing `useEffect` at line 40-44:
```tsx
useEffect(() => {
  if (!isLoading && !user) {
    router.push('/login');
  }
  // NEW: Redirect to onboarding if missing native_language
  if (!isLoading && user && !user.native_language) {
    const redirected = sessionStorage.getItem('onboarding_redirected');
    if (!redirected) {
      sessionStorage.setItem('onboarding_redirected', 'true');
      router.push('/onboarding');
    }
  }
}, [user, isLoading, router]);
```

**3. Add LanguageBadge to nav** — insert before ThemeToggle (around line 106):
```tsx
<LanguageBadge />
<ThemeToggle />
```

**4. Add Achievements/Badges card** — add as 4th card in the grid (after line 243, before `</div>` closing the grid):
```tsx
{/* Achievements card - new */}
<div className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px]">
  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-6 group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors shrink-0">
    <Award className="w-6 h-6" />
  </div>
  <h3 className="font-black uppercase italic tracking-tighter text-xl mb-2 shrink-0">Achievements</h3>
  <div className="flex-1">
    <BadgeGrid />
  </div>
</div>
```

**5. Change grid to 4 columns** (or 2+2) — change line 145:
```tsx
<div className="grid gap-6 sm:grid-cols-2 w-full mt-24">
```
(The existing 3 cards + 1 new card fit better in a 2x2 grid on desktop. Alternatively, change to a dashboard.tsx:145-243 responsive grid that switches from 1 to 2 columns.)

**6. Insert ReviewCountBadge** — add between the hero section and the DailyWordCard, or into the Stats card (around line 126, after the hero `<p>`):
```tsx
<div className="w-full text-center mt-4">
  <ReviewCountBadge />
</div>
```

---

## Shared Patterns

### Authentication
**Source:** `server/index.js:26-39`
**Apply to:** All route files (playlists.js, badges.js, user.js) — auth middleware is applied at index.js level, NOT in the route files. Routes access `req.user.id` directly.

### Express Router Pattern
**Source:** `server/routes/progress.js:1-4, 104`
```javascript
const express = require('express');
const router = express.Router();
const db = require('../db');
// ... routes ...
module.exports = router;
```

### Error Handling
**Source:** `server/routes/study.js:21-24`
**Apply to:** All new route files
```javascript
} catch (err) {
  console.error('operation error:', err);
  res.status(500).json({ error: 'failed_to_do_thing' });
}
```

### ApiFetch Pattern (Frontend)
**Source:** `client/src/lib/api.ts:29-73`
**Apply to:** All frontend pages
```typescript
const res = await apiFetch('/path', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
if (res.ok) { const data = await res.json(); /* use data */ }
```

### Dashboard Card Layout Pattern
**Source:** `client/src/app/dashboard/page.tsx:147`
```tsx
className="rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group flex flex-col min-h-[250px]"
```

### Loading / Empty / Error State Pattern
**Source:** `client/src/app/dashboard/page.tsx:152-185`
```tsx
// Loading
{loading && <div className="space-y-3 animate-pulse"><div className="h-10 bg-zinc-900 rounded w-full"></div></div>}
// Empty
{!loading && items.length === 0 && <p className="text-sm text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">{emptyText}</p>}
// Error (DailyWordCard.tsx:177-181)
{error && <div className="px-6 py-3 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium text-center">{error}</div>}
```

### Dark Mode Page Background
**Source:** `client/src/app/dashboard/page.tsx:98`
```tsx
className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white"
```

### Sticky Nav Pattern
**Source:** `client/src/app/dashboard/page.tsx:100`
```tsx
<nav className="p-6 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-xl sticky top-0 z-10">
```

### Button Variant Reference
**Source:** `client/src/components/ui/Button.tsx:5-29`
| Variant | Class | Usage |
|---------|-------|-------|
| `primary` | `bg-white text-black border border-white` | CTAs, form submit |
| `secondary` | `bg-black text-white border border-zinc-800` | SRS rating, nav buttons, secondary CTAs |
| `ghost` | `hover:bg-zinc-800 hover:text-white` | End review, language badge, skip |

---

## Test Pattern Assignments

### `server/routes/playlists.test.js` (NEW) → `server/routes/progress.test.js`

**Analog:** `server/routes/progress.test.js` (lines 1-90)

**Import and mock helpers** (lines 1-10):
```javascript
const { expect } = require('chai');
const playlistsRouter = require('./playlists');
const db = require('../db');

const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  return r;
};
```

**BeforeEach setup** (progress.test.js:17-28):
```javascript
beforeEach(() => {
  ensureUser('test-user');
  // Delete in FK order:
  db.prepare('DELETE FROM playlist_songs').run();
  db.prepare('DELETE FROM playlists').run();
  db.prepare('DELETE FROM user_badges').run();
});
```

**Test: CRUD operations** (progress.test.js:30-39 pattern):
```javascript
describe('POST /', () => {
  it('creates a playlist', async () => {
    const handler = playlistsRouter.stack.find(s => s.route.path === '/').route.stack[0].handle;
    const req = { user: { id: 'test-user' }, body: { name: 'My Favorites' } };
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body.name).to.equal('My Favorites');
  });
});
```

### `server/routes/badges.test.js` (NEW) → `server/routes/progress.test.js`
Same pattern — route handler extraction with `mockRes()`.

### `server/routes/user.test.js` (NEW) → `server/routes/progress.test.js`
Same pattern — test PATCH and GET `/preferences`.

### `server/services/badgeService.test.js` (NEW) → `server/routes/progress.test.js`
Unit test each check function directly (no route handler needed — call exported functions).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All files have close analogs in the existing codebase |

---

## Metadata

**Analog search scope:**
- `server/routes/` — progress.js, study.js, dailyWord.js, vocab.js
- `server/services/` — srsEngine.js
- `server/` — db.js, index.js
- `client/src/app/` — dashboard/page.tsx, register/page.tsx
- `client/src/components/` — DailyWordCard.tsx, ThemeToggle.tsx, ui/Button.tsx, ui/Input.tsx
- `client/src/context/` — AuthContext.tsx
- `client/src/lib/` — api.ts, utils.ts

**Files scanned:** 15 existing files
**Pattern extraction date:** 2026-06-25
