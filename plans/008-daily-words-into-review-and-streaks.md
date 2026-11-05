# Plan 008: Put every daily word into Review, and make streak and badges count daily words

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c7eb9ff..HEAD -- server/db.js server/services/dailyWordService.js server/routes/progress.js server/services/badgeService.js client/src/app/review/page.tsx mobile/lib/screens/review_screen.dart`
> If any of these changed (other than plan 007's `recordEvent` lines), compare excerpts; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (run after 007 if possible so the effect can be measured)
- **Category**: bug / direction
- **Planned at**: commit `c7eb9ff`, 2026-11-05

## Why this matters

Harmonix shows one word at a time from a song lyric (the "daily word" card, with **Next** for another). It also has a spaced-repetition **Review** screen on web (`/review`) and Android (`review_screen.dart`). The two are not connected. Nothing ever adds a daily word to Review, so in production `user_vocab_progress` has **0 rows** after 1,260 word cards. The Review link only appears when something is due, so nobody ever sees it. Streak, XP, and most badges are also wired only to a quiz screen that no client ships. Every `user_stats` row has streak 0 and XP 0, and the "7 days of daily words" badge is never checked. Result: no reason to come back tomorrow (24 of 32 users used the app on one day only). After this plan, each word you get shows up for review the next day, with its lyric line. Streak and badges also follow the words you actually learn.

## Current state

**Schema** (`server/db.js`):
- `vocab_items(id TEXT PK, word, lemma, definition, cefr_level, language_code NOT NULL, canonical_key)` with `UNIQUE INDEX idx_vocab_canonical_key ON vocab_items(canonical_key)` (lines 90-108). The canonical key is `` `${foldWord(word)}|${languageCode}` ``, with `foldWord` from `server/services/canonicalKeyService.js` (exported). Same construction in `server/routes/vocab.js:197`.
- `user_vocab_progress(user_id, vocab_id, stability, difficulty, last_review, next_review, reps, PK(user_id, vocab_id))` (lines 124-137).
- `user_stats(user_id PK, streak_days, total_xp, last_study_date, daily_goal)` (lines 140-149).
- Migration style for new columns: `PRAGMA table_info(...)` then `ALTER TABLE ... ADD COLUMN` (e.g. `db.js:104-107`).

**Daily word delivery**: every new card goes through `deliverPayload` (`server/services/dailyWordService.js:1036-1041`). A saved payload looks like this (production sample, key names only):

```text
{ date, language_code, word: { text, translation, part_of_speech, pronunciation, ... },
  lyric: { snippet, line_index, char_start, char_end, ... },
  song: { id, title, artist, genre, cover }, audio: {...}, from_queue }
```

`word.lemma` is usually absent. `word.translation` is the gloss in the learner's home language.

**Streak**: `computeDailyWordStreak(userId)` (`dailyWordService.js:1183-1203`) counts consecutive UTC dates in `daily_words`. `/api/progress/stats` (`server/routes/progress.js:7-29`) already returns this as `streak_days`, but `user_stats.streak_days` is never written except in `server/routes/study.js:131` (quiz finish, unused).

**Review API** (`server/routes/progress.js`):
- `POST /review` (lines 31-82) upserts SRS state using `srs.calculateNextReview` / `srs.nextReviewDate` from `server/services/srsEngine.js`.
- `GET /due` (lines 84-101):

```sql
SELECT uvp.*, v.word, v.lemma, v.definition, v.cefr_level, v.language_code,
       svm.song_id, svm.line_index, svm.char_start
FROM user_vocab_progress uvp
JOIN vocab_items v ON uvp.vocab_id = v.id
LEFT JOIN song_vocab_map svm ON svm.vocab_id = v.id AND svm.line_index <> -1
WHERE uvp.user_id = ? AND (uvp.next_review IS NULL OR DATE(uvp.next_review) <= DATE('now'))
ORDER BY uvp.next_review ASC LIMIT ?
```

**Review UIs** show `word` and `definition` and let the learner rate themselves. Web `client/src/app/review/page.tsx:151-155` also prints `From song #{song_id}` (an id, not useful). Android `mobile/lib/screens/review_screen.dart:158-170` shows `word` and `definition`.

**Badges** (`server/services/badgeService.js`): `streak_7` reads `user_stats.streak_days`; `daily_word_7` counts distinct `daily_words.date`. `checkAndUnlockBadges(userId)` is only called from `routes/playlists.js:48` and `routes/study.js:140`. The web Discover page already shows a toast if `/progress/stats` returns `badges_unlocked` (`client/src/app/discover/page.tsx:128-131`), but the stats route never includes it.

**Important**: `vocab_items` is shared across users and keyed by word + **target** language, but the translation is in each learner's **home** language. Store the per-learner gloss on `user_vocab_progress`, not only in `vocab_items.definition`.

Tests: mocha + chai; pattern `server/routes/progress.test.js` (direct handler calls; `beforeEach` clears tables). Flutter tests: `cd mobile && flutter test`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Server tests | `cd server && npm test` | all passing |
| Web typecheck | `cd client && npx tsc --noEmit -p .` | exit 0 |
| Flutter | `cd mobile && flutter analyze --fatal-infos && flutter test` | no issues; all pass |

## Scope

**In scope**
- `server/db.js` (add columns to `user_vocab_progress`)
- `server/services/reviewEnrollment.js` (create) + `server/services/reviewEnrollment.test.js` (create)
- `server/services/dailyWordService.js` (`deliverPayload` only: call enrollment + stats update)
- `server/routes/progress.js` (`/due` returns the new fields; `/stats` runs badge checks and returns `badges_unlocked`)
- `server/routes/progress.test.js`
- `client/src/app/review/page.tsx` (show lyric line + song instead of `From song #id`)
- `mobile/lib/screens/review_screen.dart` (show lyric line + song under the definition)

**Out of scope**
- `server/routes/study.js` and quiz tables — no quiz UI ships; leave them alone.
- The SRS math in `srsEngine.js`.
- Changing how review answers are graded (self-rating stays).
- Showing XP anywhere in the UI.

## Git workflow

Branch `advisor/008-review-from-daily-words`; conventional commits (e.g. `feat(review): add each daily word to review`). Do not push unless told.

## Steps

### Step 1: Columns for the learner's own context

In `server/db.js`, after the `user_vocab_progress` table, add (guarded by `PRAGMA table_info(user_vocab_progress)`): `gloss TEXT`, `context_sentence TEXT`, `song_title TEXT`, `song_artist TEXT`, `source TEXT`.

**Verify**: `cd server && NODE_ENV=test node -e "const db=require('./db'); console.log(db.prepare('PRAGMA table_info(user_vocab_progress)').all().map(c=>c.name).join(','))"` → includes `gloss,context_sentence,song_title,song_artist,source`.

### Step 2: Enrollment service

Create `server/services/reviewEnrollment.js` exporting `enrollDailyWord(userId, payload)`:

1. Read `word = payload?.word?.text`, `lang = payload?.language_code`. If either is missing, or the word is longer than 60 characters, return `null`.
2. `key = `${foldWord(word)}|${lang}``. Find the `vocab_items` row by `canonical_key`. If there isn't one, insert it with `id = nanoid()`, `word`, `lemma = payload.word.lemma || null`, `definition = payload.word.translation || null`, `cefr_level = payload.word.cefr_level || null`, `language_code = lang`, `canonical_key = key`. Handle a unique-constraint race by re-selecting.
3. Insert into `user_vocab_progress` with `stability 0, difficulty 0, reps 0, next_review = tomorrow at 00:00 UTC (ISO string), gloss = translation, context_sentence = payload.lyric?.snippet (truncate to 300 characters), song_title, song_artist, source = 'daily_word'`. Use `ON CONFLICT(user_id, vocab_id) DO UPDATE` **only** to fill `gloss`, `context_sentence`, `song_title` and `song_artist` when they are NULL. Never reset `next_review`, `reps` or `stability` for a word already being reviewed.
4. Wrap everything in `try/catch`; log with `console.warn` and return `null` on error. Enrollment must never break word delivery.

**Verify**: `server/services/reviewEnrollment.test.js`:
- A new word creates 1 `vocab_items` row and 1 progress row with `next_review` tomorrow and `gloss` set.
- The same word again for the same user leaves `reps` and `next_review` unchanged.
- The same word for a second user with a different translation reuses the `vocab_items` row, and each user keeps their own `gloss`.
- `corazón` and `corazon` map to one `vocab_items` row.
- A payload with no `word.text` returns `null` and writes nothing.

`npm test` → all pass.

### Step 3: Call it on delivery, and keep `user_stats` in step

In `deliverPayload`, after `saveDailyWord(...)`:

```javascript
reviewEnrollment.enrollDailyWord(userId, delivered);
updateStudyStats(userId);
```

Add `updateStudyStats(userId)` in `dailyWordService.js`. It upserts `user_stats` with `streak_days = computeDailyWordStreak(userId)`, `last_study_date = todayDate()`, `total_xp = total_xp + 10`, inside `try/catch`.

**Verify**: a new test in `dailyWordService.test.js` calls `deliverPayload('u1', payload)` (it's exported) and asserts one `user_vocab_progress` row for `u1` and `user_stats.streak_days >= 1`. `npm test` → all pass.

### Step 4: Return the context from `/due`, and badges from `/stats`

- `/due`: select `COALESCE(uvp.gloss, v.definition) AS definition`, plus `uvp.context_sentence`, `uvp.song_title`, `uvp.song_artist`. Keep all existing columns so older apps still work.
- `/stats`: after computing stats, call `badgeService.checkAndUnlockBadges(userId)` and include `badges_unlocked` (an array, possibly empty) in the JSON.

**Verify**: `progress.test.js`:
- Enroll a word with `next_review` set to yesterday; `/due` returns it with `context_sentence` and `definition` equal to the gloss.
- With 7 distinct `daily_words` dates seeded, `/stats` returns a `badges_unlocked` entry with id `daily_word_7` the first time and an empty array the second time.

`npm test` → all pass.

### Step 5: Show the lyric in the Review screens

- Web `client/src/app/review/page.tsx`: extend the item type with optional `context_sentence`, `song_title`, `song_artist`. Replace the `From song #{currentWord.song_id}` line with the lyric in italics in quotes, then `song_title — song_artist` in small muted text. Render each only if present.
- Android `mobile/lib/screens/review_screen.dart`: under the definition text (around lines 166-170), add the same two lines with the existing theme styles (`colors.textMuted`, `bodyMedium`, italic for the lyric).

**Verify**: `cd client && npx tsc --noEmit -p .` → exit 0; `cd mobile && flutter analyze --fatal-infos` → "No issues found!"; `flutter test` → all pass.

## Test plan

Covered in Steps 2–4 (server). Clients: typecheck and analyze only; no new widget test is required. Pattern: `server/routes/progress.test.js`.

## Done criteria

- [ ] `cd server && npm test` exits 0 with the new enrollment, delivery and progress tests
- [ ] `grep -n "enrollDailyWord" server/services/dailyWordService.js` matches inside `deliverPayload`
- [ ] `/progress/stats` response includes `badges_unlocked` (test asserts it)
- [ ] `cd client && npx tsc --noEmit -p .` exit 0
- [ ] `cd mobile && flutter analyze --fatal-infos && flutter test` pass
- [ ] Only in-scope files changed
- [ ] `plans/README.md` row updated

## STOP conditions

- `deliverPayload` is not the only place new `daily_words` rows are created for real users (search for `INSERT INTO daily_words`). Report the other sites instead of guessing.
- The unique index on `vocab_items.canonical_key` causes failures you cannot resolve by re-selecting after a conflict.
- A Flutter or web change seems to need a new API endpoint.

## Maintenance notes

- Existing production users have 1,260 past cards and nothing in Review. A one-off backfill (enroll the last 14 days of each user's `daily_words`, due tomorrow) is a sensible follow-up, but it's deliberately not part of this plan. Run it only after this ships and works.
- Review uses self-rating (`is_correct` from the client). That's fine for a personal learning tool. Don't add leaderboards on top of it.
- Plan 009 (Android reminder) points learners at Review, so ship this first.
