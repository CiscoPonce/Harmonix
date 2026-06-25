---
phase: 09-retention-gamification-personalization
plan: 01B
type: execute
wave: 1
depends_on: [09-01A-PLAN.md]
files_modified: [server/routes/vocab.js, server/routes/study.js, client/src/context/AuthContext.tsx]
files_created: [server/routes/playlists.test.js, server/routes/badges.test.js, server/routes/user.test.js, server/services/badgeService.test.js]
autonomous: true
requirements: [STUDY-01, STUDY-03, AI-02]
user_setup:
  - service: None (depends on 01A DB + routes)
env_vars: []
must_haves:
  truths:
    - "AI vocabulary extraction uses user's target_language instead of hardcoded 'Spanish'"
    - "Badge detection fires automatically on quiz finish (POST /study/:id/finish)"
    - "Badge detection fires automatically on playlist creation (POST /playlists)"
    - "User interface includes optional language fields for native_language, target_language, genre, difficulty, cefr_level"
    - "Playlist CRUD has test coverage (create, read, update, delete, auth, edge cases)"
    - "Badge routes have test coverage (list, unlock status)"
    - "User preferences routes have test coverage (PATCH, GET, validation)"
    - "Badge service has unit test coverage (threshold checks, duplicate prevention)"
  artifacts:
    - path: "server/routes/vocab.js"
      provides: "Language-respecting AI extraction (fix line 141)"
    - path: "server/routes/study.js"
      provides: "Badge detection on quiz finish"
    - path: "client/src/context/AuthContext.tsx"
      provides: "Extended User type with optional language fields"
    - path: "server/routes/playlists.test.js"
      provides: "Test coverage for playlist CRUD"
    - path: "server/routes/badges.test.js"
      provides: "Test coverage for badge listing"
    - path: "server/routes/user.test.js"
      provides: "Test coverage for user preferences"
    - path: "server/services/badgeService.test.js"
      provides: "Unit test coverage for badge detection"
  key_links:
    - from: "server/routes/vocab.js"
      to: "server/services/aiService.js"
      via: "Language parameter in extractVocabulary() call"
    - from: "server/services/badgeService.js"
      to: "server/routes/study.js"
      via: "Badge detection on quiz finish endpoint"
    - from: "server/routes/playlists.test.js"
      to: "server/routes/progress.test.js"
      via: "Test pattern (mockRes, route handler extraction, user setup)"
---

<objective>
Complete the backend layer: fix the hardcoded language in AI extraction, wire badge detection into existing study routes, extend the AuthContext User type, and add comprehensive test coverage for all new backend code from Plan 01A. This plan ensures quality gates are met before proceeding to frontend work.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Fix Hardcoded Language in Vocab Extraction</name>
  <files>server/routes/vocab.js</files>
  <action>
  1. Find line 141 where `extractVocabulary` is called with hardcoded 'Spanish'
  2. Add language code-to-name mapping at top of file or inline:
     const LANG_CODE_TO_NAME = { es: 'Spanish', en: 'English', fr: 'French', de: 'German', pt: 'Portuguese' };
  3. Before the AI call, resolve the target language:
     const langCode = req.user.target_language || 'es';
     const targetLangName = LANG_CODE_TO_NAME[langCode] || 'Spanish';
  4. Replace 'Spanish' with targetLangName variable
  </action>
  <done>AI vocabulary extraction uses user's target_language from profile. No more hardcoded 'Spanish'.</done>
  <verify>grep -n "Spanish" server/routes/vocab.js | grep -v "targetLangName\|LANG_CODE_TO_NAME" && echo "FAIL: hardcoded Spanish found" || echo "PASS"</verify>
</task>

<task type="auto">
  <name>Task 2: Add Badge Detection to Study Finish</name>
  <files>server/routes/study.js</files>
  <action>
  1. Add const badgeService = require('../services/badgeService') at top
  2. In POST /api/study/:sessionId/finish handler, after the XP update transaction completes (after line 137):
     - Call badgeService.checkAndUnlockBadges(userId, { checkQuiz: true })
  3. Add badges_unlocked to the response JSON
  </action>
  <done>Quiz completion triggers badge detection for perfect score, streak, and vocab count badges. Response includes badges_unlocked[].</done>
  <verify>grep -q "badgeService" server/routes/study.js && echo "PASS" || echo "FAIL"</verify>
</task>

<task type="auto">
  <name>Task 3: Extend AuthContext User Interface</name>
  <files>client/src/context/AuthContext.tsx</files>
  <action>
  1. Modify User interface from { id, email } to include optional:
     - native_language?: string
     - target_language?: string
     - genre?: string
     - difficulty?: string
     - cefr_level?: string
  2. No other changes needed — setUser() already merges whatever /auth/me returns
  </action>
  <done>User type includes all language preference fields. TypeScript compiles without errors.</done>
  <verify>grep -q "native_language" client/src/context/AuthContext.tsx && echo "PASS" || echo "FAIL"</verify>
</task>

<task type="auto">
  <name>Task 4: Test Files for New Routes + Service</name>
  <files>server/routes/playlists.test.js, server/routes/badges.test.js, server/routes/user.test.js, server/services/badgeService.test.js</files>
  <action>
  1. Create `server/routes/playlists.test.js` (follow progress.test.js mockRes + route handler extraction pattern):
     - beforeEach: ensure test user, clean playlist_songs → playlists → user_badges (FK order)
     - Test: POST / creates playlist, returns 201 with id
     - Test: GET / lists playlists with song_count
     - Test: GET /:id returns playlist with songs
     - Test: PUT /:id renames playlist, returns updated name
     - Test: DELETE /:id removes playlist, returns 200
     - Test: POST /:id/songs adds song to playlist
     - Test: DELETE /:id/songs/:songId removes song
     - Test: 404 for non-existent playlist
     - Test: 400 for empty name
     - Test: 403 for other user's playlist
  2. Create `server/routes/badges.test.js`:
     - beforeEach: ensure test user, clean user_badges
     - Test: GET / returns all 5 badges with unlocked=0 for new user
     - Test: unlocked badge shows unlocked=1 with unlocked_at date
  3. Create `server/routes/user.test.js`:
     - Test: GET /preferences returns default values
     - Test: PATCH /preferences updates native_language and target_language
     - Test: PATCH /preferences rejects invalid target_language with 400
     - Test: PATCH /preferences partial update doesn't clear other fields
  4. Create `server/services/badgeService.test.js`:
     - Test: checkAndUnlockBadges with no achievements returns empty array
     - Test: streak_7 unlocks when user_stats.streak_days >= 7
     - Test: playlist_first unlocks when playlists row exists
     - Test: duplicate unlock returns empty (already unlocked)
  </action>
  <done>All test files pass with `npm test`. Coverage for CRUD, validation, auth, edge cases, and threshold logic.</done>
  <verify>npm test 2>&1 | tail -20</verify>
</task>
</tasks>

<success_criteria>
1. AI vocab extraction uses user's target_language (Spanish no longer hardcoded)
2. Quiz completion triggers badge detection, response includes badges_unlocked[]
3. AuthContext.User type includes all language preference fields (TypeScript compiles)
4. 4 new test files pass: playlists.test.js, badges.test.js, user.test.js, badgeService.test.js
5. All existing tests still pass with new tables in place
6. Full npm test suite passes (existing + new tests)
</success_criteria>
