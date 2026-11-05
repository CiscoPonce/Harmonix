# Plan 007: Record basic usage events on the server and print a retention report

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c7eb9ff..HEAD -- server/db.js server/index.js server/services/dailyWordService.js server/routes/dailyWord.js server/routes/progress.js server/routes/share.js server/routes/playlists.js`
> If any of these changed, compare the excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `c7eb9ff`, 2026-11-05

## Why this matters

Harmonix teaches vocabulary from song lyrics (web + Android app, one Express API). Today the only way to know whether people come back is to read timestamps on generated word cards. That is how we learned that only 8 of 32 active users returned on a second day. Upcoming work (adding words to Review, Android reminders, share-page sign-ups) needs a before/after measurement. This plan records a handful of events **on the server only**: no client changes and no third-party analytics. It also adds a script that prints day-1 and day-7 return rates.

## Current state

- Schema lives in `server/db.js` as idempotent `db.exec('CREATE TABLE IF NOT EXISTS …')` blocks, with `PRAGMA table_info` checks before `ALTER TABLE`. Example: `server/db.js:530-541` (`shared_postcards` table + index). New tables go just before `const { ensureCanonicalKeys } = require('./services/canonicalKeyService');` near the end of the file.
- Both clients call `GET /api/auth/me` when they start with a saved session. Web: `client/src/context/AuthContext.tsx:68` after `/auth/refresh`. Android: `mobile/lib/state/auth_state.dart` `bootstrap()` → `api.me()`. Handler: `server/index.js:197-206`:

```javascript
app.get('/api/auth/me', authenticateToken, (req, res) => {
  console.log('GET /api/auth/me - for user:', req.user.id);
  const user = db.prepare('SELECT id, email, created_at, ... FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.sendStatus(404);
```

- Sign-up: `server/index.js:97-123`, success path at lines 114-118 (`INSERT INTO users …` then `res.status(201)`).
- Every new word card goes through `deliverPayload` in `server/services/dailyWordService.js:1036-1041`:

```javascript
function deliverPayload(userId, payload, { fromQueue = false } = {}) {
  const date = todayDate();
  const delivered = { ...payload, date, cached: false, from_queue: fromQueue };
  saveDailyWord(userId, date, delivered);
  return delivered;
}
```

- Pronunciation: `server/routes/dailyWord.js:135-145` (`router.get("/pronounce", …)`); `resolvePronounceUser(req)` gives `user` (may be anonymous).
- Review submit: `server/routes/progress.js:31-82` (`router.post('/review', …)`).
- Postcards: `server/routes/share.js:185` (`protectedRouter.post('/postcards', …)`, signed in) and `share.js:110-119` (`publicRouter.get('/postcards/:id', …)`, anyone viewing a shared card).
- Playlist create: `server/routes/playlists.js:38-48`.
- Android's HTTP client sends a `User-Agent` that starts with `Dart/`; browsers send `Mozilla/…`.
- Tests: mocha + chai (`cd server && npm test`). Pattern for DB-backed tests: `server/routes/progress.test.js` (creates users with `INSERT OR IGNORE INTO users`, clears tables in `beforeEach`).
- Privacy: `client/src/app/privacy/page.tsx` lists what is stored. Events hold no email, IP, lyrics, or free text.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Server tests | `cd server && npm test` | all passing, 0 failing |
| Report (local) | `cd server && node scripts/usage-report.js` | prints a table, exit 0 |
| Report (production, operator only) | `ssh ubuntu@<vps> 'docker exec api-rxwdj1k3qu51fqf8uwtal389 node scripts/usage-report.js'` | prints a table |

## Scope

**In scope**
- `server/db.js` (new `usage_events` table + indexes)
- `server/services/usageEvents.js` (create), `server/services/usageEvents.test.js` (create)
- One-line hooks in: `server/index.js` (sign-up, `/auth/me`), `server/services/dailyWordService.js` (`deliverPayload`), `server/routes/dailyWord.js` (`/pronounce`), `server/routes/progress.js` (`/review`), `server/routes/share.js` (create + public view), `server/routes/playlists.js` (create)
- `server/scripts/usage-report.js` (create)
- `client/src/app/privacy/page.tsx`: one sentence about usage events

**Out of scope**
- Any client (web or Flutter) code; any third-party analytics SDK.
- The audio preview proxy (`server/routes/audio.js`). It is unauthenticated and called by `<audio>` tags.
- Admin UI for the report.

## Git workflow

Branch `advisor/007-usage-events`; conventional commits (e.g. `feat(metrics): record server-side usage events`). Do not push unless told.

## Steps

### Step 1: Table

In `server/db.js` add:

```javascript
// Product usage events: no email, IP, or free text.
db.exec(`
  CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    name TEXT NOT NULL,
    platform TEXT,
    props_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_events_name_time ON usage_events(name, created_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_events_user_time ON usage_events(user_id, created_at)`);
```

**Verify**: `cd server && NODE_ENV=test node -e "const db=require('./db'); console.log(db.prepare(\"select name from sqlite_master where name='usage_events'\").get())"` → `{ name: 'usage_events' }`.

### Step 2: Helper

Create `server/services/usageEvents.js`:

- `const EVENT_NAMES = new Set(['signup','app_open','word_delivered','word_heard','review_done','postcard_created','postcard_viewed','playlist_created'])`
- `platformFromRequest(req)` → `'android'` if `User-Agent` starts with `Dart/`, `'web'` if it contains `Mozilla/`, else `'other'`.
- `recordEvent(name, { userId = null, req = null, platform = null, props = null } = {})`. It inserts one row and **never throws**: wrap everything in `try/catch` and `console.warn` on failure. Ignore names not in `EVENT_NAMES`. Store `props` with `JSON.stringify`, but only when it's a plain object whose values are numbers, booleans, or strings of 40 characters or fewer. Drop anything else.
- `app_open` is recorded at most once per user per UTC day: before inserting, check for `user_id = ? AND name = 'app_open' AND created_at >= date('now')`.

**Verify**: `server/services/usageEvents.test.js` covers: unknown name ignored; `app_open` twice in a day → 1 row; long string prop dropped; `platformFromRequest({ headers: { 'user-agent': 'Dart/3.12 (dart:io)' } })` → `'android'`; a DB error (e.g. pass `name` as an object) does not throw. `npm test` → all pass.

### Step 3: Hooks (one line each, after the success path)

| Where | Call |
|---|---|
| `index.js` sign-up, after the `INSERT INTO users` | `recordEvent('signup', { userId: id, req })` |
| `index.js` `/api/auth/me`, after `if (!user) …` | `recordEvent('app_open', { userId: req.user.id, req })` |
| `dailyWordService.deliverPayload`, after `saveDailyWord` | `recordEvent('word_delivered', { userId, props: { from_queue: fromQueue, lang: String(payload.language_code || '') } })` |
| `dailyWord.js` `/pronounce`, only when `user?.id` and the audio was sent successfully | `recordEvent('word_heard', { userId: user.id, req })` |
| `progress.js` `/review`, after `txn()` | `recordEvent('review_done', { userId, req, props: { count: updated.length } })` |
| `share.js` create, after the postcard is stored | `recordEvent('postcard_created', { userId: req.user.id, req })` |
| `share.js` public `GET /postcards/:id`, when the card is found | `recordEvent('postcard_viewed', { req, props: { postcard: id } })` |
| `playlists.js` `POST /`, after insert | `recordEvent('playlist_created', { userId, req })` |

**Verify**: `npm test` → all pass (existing tests must keep passing; the helper never throws). Add one test in `server/routes/progress.test.js` that calls the `/review` handler and asserts a `review_done` row exists for that user.

### Step 4: Report script

Create `server/scripts/usage-report.js` (runs with `node scripts/usage-report.js` from `server/`; it `require('../db')`, so it uses `SQLITE_PATH` in production). Print plain text:

1. Per sign-up week (from `users.created_at`): users, % with any `app_open` or `word_delivered` on a **later** UTC day (day-1+ return), % active 7–13 days after sign-up (day-7 return). Before events existed, fall back to `daily_words.generated_at` dates for activity so old cohorts still show numbers.
2. Last 28 days: counts per event name, per platform.
3. Postcards: views and the number of distinct viewed postcards in the last 28 days.

**Verify**: run locally against the test DB after `npm test` (`NODE_ENV=test node scripts/usage-report.js`) → exit 0, prints the three sections.

### Step 5: Privacy page

Add one sentence under the account section of `client/src/app/privacy/page.tsx`: "We record simple usage events, such as opening the app, getting a word, or sharing a postcard, to see which features help people learn. They don't include your email or what you type." Change the `updated="…"` date to the current date.

**Verify**: `cd client && npx tsc --noEmit -p .` → exit 0.

## Test plan

`usageEvents.test.js` (Step 2 cases) and one hook test in `progress.test.js` (Step 3). Pattern: `server/routes/progress.test.js`. `cd server && npm test` → all pass.

## Done criteria

- [ ] `cd server && npm test` exits 0, new tests included
- [ ] `grep -c "recordEvent(" server/index.js server/services/dailyWordService.js server/routes/*.js` totals at least 8 call sites
- [ ] `NODE_ENV=test node server/scripts/usage-report.js` exits 0
- [ ] No client or mobile files changed except `client/src/app/privacy/page.tsx`
- [ ] `plans/README.md` row updated

## STOP conditions

- Any hook would need to change a response body or status code.
- `deliverPayload` no longer looks like the excerpt, or words are saved somewhere other than `saveDailyWord`.
- You find yourself adding IP addresses, emails, lyric text, or search queries to events. Don't; stop and report.

## Maintenance notes

- Plans 008 (Review), 009 (reminders) and 010 (share sign-ups) are measured with this report. Run it before deploying them and again two weeks later.
- If the table grows large (it shouldn't at this scale), prune rows older than 400 days in the backup script.
- Event names are a contract for the report. Add new names to `EVENT_NAMES`; never rename old ones.
