---
phase: 09-retention-gamification-personalization
plan: 01A
type: execute
wave: 1
depends_on: [08-harmonix-rebrand-landing]
files_modified: [server/db.js, server/index.js]
files_created: [server/services/badgeService.js, server/routes/playlists.js, server/routes/badges.js, server/routes/user.js]
autonomous: true
requirements: [STUDY-01, STUDY-03]
user_setup:
  - service: None (existing DB, existing server)
env_vars: []
must_haves:
  truths:
    - "User can set native+target language via PATCH /api/user/preferences"
    - "User can create, list, rename, and delete playlists via API"
    - "User can add/remove songs from playlists via API"
    - "User can see all 5 badges with unlock status via GET /api/badges"
    - "Badge detection service exists and is importable by other routes"
  artifacts:
    - path: "server/db.js"
      provides: "4 new tables (playlists, playlist_songs, badges, user_badges) + native_language column + badge seed data"
    - path: "server/services/badgeService.js"
      provides: "Shared checkAndUnlockBadges() used by study.js and playlists.js"
    - path: "server/routes/playlists.js"
      provides: "Full CRUD playlist endpoints + song add/remove"
    - path: "server/routes/badges.js"
      provides: "GET /api/badges with unlock status"
    - path: "server/routes/user.js"
      provides: "PATCH/GET /api/user/preferences"
  key_links:
    - from: "server/db.js"
      to: "server/routes/playlists.js"
      via: "playlists + playlist_songs tables"
    - from: "server/services/badgeService.js"
      to: "server/routes/study.js"
      via: "Badge detection on quiz finish endpoint"
    - from: "server/services/badgeService.js"
      to: "server/routes/playlists.js"
      via: "Badge detection on playlist creation"
---

<objective>
Build the backend foundation for Phase 9: database schema for playlists, badges, and user preferences; shared badge detection service; playlist CRUD routes; badge listing routes; and user language preference routes. This plan establishes all server-side data and API capabilities so plans 01B, 02, and 03 have working endpoints to consume.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Database Schema — New Tables + Migration</name>
  <files>server/db.js</files>
  <action>
  1. Add native_language column migration for users table (follow existing pattern at lines 49-59):
     - Check PRAGMA table_info(users) for 'native_language'
     - If missing, ALTER TABLE users ADD COLUMN native_language TEXT DEFAULT 'en'
  2. Add CREATE TABLE IF NOT EXISTS for playlists (id TEXT PK, user_id TEXT NOT NULL FK→users, name TEXT NOT NULL, created_at DATETIME, updated_at DATETIME)
  3. Add CREATE TABLE IF NOT EXISTS for playlist_songs (id TEXT PK, playlist_id TEXT NOT NULL FK→playlists ON DELETE CASCADE, song_id TEXT NOT NULL, added_at DATETIME DEFAULT CURRENT_TIMESTAMP)
  4. Add unique index idx_playlist_songs_unique ON playlist_songs(playlist_id, song_id)
  5. Add CREATE TABLE IF NOT EXISTS for badges (id TEXT PK, name TEXT NOT NULL, description TEXT NOT NULL, icon TEXT NOT NULL, category TEXT NOT NULL, criteria_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)
  6. Add CREATE TABLE IF NOT EXISTS for user_badges (user_id TEXT NOT NULL, badge_id TEXT NOT NULL, unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP, PK(user_id, badge_id), FK→users, FK→badges)
  7. Seed badges table with 5 core badges using INSERT OR IGNORE (only if empty):
     - streak_7: '7-Day Streak', 'Flame', 'streak', criteria {"type":"streak_days","threshold":7}
     - vocab_50: 'Vocabulary Builder', 'BookOpen', 'vocabulary', criteria {"type":"vocab_count","threshold":50}
     - quiz_perfect: 'Quiz Master', 'Award', 'quiz', criteria {"type":"perfect_quiz","threshold":1}
     - playlist_first: 'Curator', 'ListMusic', 'playlist', criteria {"type":"playlist_count","threshold":1}
     - daily_word_7: 'Daily Dedication', 'CalendarDays', 'daily_word', criteria {"type":"daily_word_streak","threshold":7}
  8. Place all new code before the ensureCanonicalKeys call (around line 234)
  </action>
  <done>All 4 new tables created, native_language column added, 5 badges seeded.</done>
  <verify>node -e "const db = require('./server/db'); const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(t => t.name); console.log(tables.join(', '));" 2>&1 | grep -q "playlists" && echo "PASS" || echo "FAIL"</verify>
</task>

<task type="auto">
  <name>Task 2: Badge Detection Service</name>
  <files>server/services/badgeService.js</files>
  <action>
  1. Create new file `server/services/badgeService.js`
  2. Import db = require('../db')
  3. Export function `checkAndUnlockBadges(userId, options = {})`:
     - Use db.transaction() for atomicity
     - For each of the 5 badges:
       - Skip if user already has this badge (SELECT 1 FROM user_badges)
       - Check threshold via DB query:
         - streak_7: SELECT streak_days FROM user_stats WHERE user_id = ?
         - vocab_50: SELECT COUNT(*) FROM user_vocab_progress WHERE user_id = ? AND reps > 0
         - quiz_perfect: SELECT 1 FROM quiz_sessions WHERE user_id = ? AND score = total_questions AND total_questions > 0 LIMIT 1
         - playlist_first: SELECT COUNT(*) FROM playlists WHERE user_id = ?
         - daily_word_7: SELECT COUNT(DISTINCT date) FROM daily_words WHERE user_id = ?
       - If threshold met: INSERT OR IGNORE INTO user_badges, fetch badge info, push to unlocked array
     - Return array of newly unlocked badge objects { id, name, description, icon, category }
  4. Follow module export pattern from srsEngine.js (pure functions, module.exports)
  </action>
  <done>badgeService.js exports checkAndUnlockBadges() that returns newly unlocked badges.</done>
  <verify>node -e "const bs = require('./server/services/badgeService'); console.log(typeof bs.checkAndUnlockBadges === 'function' ? 'PASS' : 'FAIL')"</verify>
</task>

<task type="auto">
  <name>Task 3: Playlist CRUD Routes</name>
  <files>server/routes/playlists.js, server/index.js</files>
  <action>
  1. Create new file `server/routes/playlists.js`:
     - Import express, router, nanoid, db, badgeService
     - GET /api/playlists: list user's playlists with song_count (subquery), ordered by updated_at DESC
     - POST /api/playlists: create playlist (name required, max 100 chars, trim); call badgeService.checkAndUnlockBadges for playlist_first; return 201 with badges_unlocked
     - GET /api/playlists/:id: get single playlist with songs (LEFT JOIN playlist_songs), verify ownership
     - PUT /api/playlists/:id: rename playlist, verify ownership
     - DELETE /api/playlists/:id: delete playlist (CASCADE deletes songs), verify ownership
     - POST /api/playlists/:id/songs: add song to playlist (body: { song_id }), verify ownership, prevent duplicates via unique index
     - DELETE /api/playlists/:id/songs/:songId: remove song from playlist, verify ownership
     - Follow error handling pattern: try/catch with console.error + 500 json
  2. In `server/index.js`:
     - Add const playlistsRouter = require('./routes/playlists')
     - Add app.use('/api/playlists', authenticateToken, playlistsRouter)
     - Add 'native_language' to the /auth/me SELECT at line 147
  </action>
  <done>All playlist CRUD endpoints working. Songs can be added/removed. Owner enforced on all mutations.</done>
  <verify>npm test -- --grep "Playlist" 2>&1 | tail -5</verify>
</task>

<task type="auto">
  <name>Task 4: Badge Routes</name>
  <files>server/routes/badges.js, server/index.js</files>
  <action>
  1. Create new file `server/routes/badges.js`:
     - Import express, router, db, badgeService
     - GET /api/badges: return all badges with user's unlock status (LEFT JOIN user_badges), ordered by category
       - Each badge includes: id, name, description, icon, category, unlocked (0/1), unlocked_at (null if locked)
     - Follow error handling pattern
  2. In `server/index.js`:
     - Add const badgesRouter = require('./routes/badges')
     - Add app.use('/api/badges', authenticateToken, badgesRouter)
  </action>
  <done>GET /api/badges returns all 5 badges with per-user unlock status. Proper auth enforced.</done>
  <verify>npm test -- --grep "Badge" 2>&1 | tail -5</verify>
</task>

<task type="auto">
  <name>Task 5: User Preferences Routes</name>
  <files>server/routes/user.js, server/index.js</files>
  <action>
  1. Create new file `server/routes/user.js`:
     - Import express, router, db
     - GET /api/user/preferences: return user's native_language, target_language, genre, difficulty, cefr_level
     - PATCH /api/user/preferences: update user preferences (body accepts any subset of native_language, target_language, genre, difficulty, cefr_level)
       - Validate target_language is known code (en/es/fr/de/pt) if provided
       - Use COALESCE to only update provided fields
       - Return full updated user object
     - Follow error handling pattern
  2. In `server/index.js`:
     - Add const userRouter = require('./routes/user')
     - Add app.use('/api/user', authenticateToken, userRouter)
  </action>
  <done>GET and PATCH /api/user/preferences working. Language validation enforced on write.</done>
  <verify>npm test -- --grep "User" 2>&1 | tail -5</verify>
</task>
</tasks>

<success_criteria>
1. Database has playlists, playlist_songs, badges, user_badges tables and native_language column on users
2. 5 badges seeded and queryable via SQL
3. badgeService.checkAndUnlockBadges() importable and callable
4. PATCH /api/user/preferences persists language selections
5. Playlist CRUD works with ownership enforcement
6. GET /api/badges returns badges with per-user unlock status
7. All existing tests still pass: npm test
</success_criteria>
