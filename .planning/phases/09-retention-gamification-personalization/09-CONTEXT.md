# Phase 9: Retention, Gamification & Personalization - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver four capabilities that transform Harmonix from a stateless utility into a sticky daily habit:
1. **Localization / Language Selection Flow** — onboarding for native/target language, AI prompt integration
2. **User Playlists & Collections** — CRUD for curated song collections
3. **Gamification Expansion (Badges & Milestones)** — 5 unlockable achievement badges
4. **Spaced Repetition "Review Room"** — dedicated flashcard practice using existing SM-2 engine

</domain>

<decisions>
## Implementation Decisions

### Onboarding UX
- **D-09-01:** Use a dedicated `/onboarding` route (not modal). New users are redirected here after registration before reaching `/dashboard`.
- **D-09-02:** Existing users without language set (null `native_language` or `target_language`) see the onboarding on their next dashboard visit.
- **D-09-03:** Language changeable later via a Settings page + a dashboard badge in the nav header (e.g., `EN → ES`).
- **D-09-04:** Fields: native_language + target_language (step 1), then optional genre + difficulty (step 2).
- **D-09-05:** No browser locale pre-fill — always ask from empty selects.
- **D-09-06:** Soft-block with defaults — users can skip onboarding with a "Skip → Use defaults" option (default: EN → ES). Defaults changeable in settings.
- **D-09-07:** Onboarding redirect is state-checked once per session. If user leaves mid-flow, they see it again on next visit until completed.

### Badges & Achievements
- **D-09-08:** Launch with 5 core badges — one per category: Streak (7-Day), Vocabulary (50 Words), Quiz (Perfect Score), Playlist (First Created), Daily Word (7-Day Collector).
- **D-09-09:** Badges live in a dashboard card ("Achievements") with a grid of visual badge icons. Grayscale/silhouette for locked, full-color for unlocked.
- **D-09-10:** Unlock notification is a toast/banner, not a full-screen modal.
- **D-09-11:** Unlock detection via background check on relevant API calls (quiz complete, playlist save, etc.). Server evaluates thresholds and returns badge data in the response.

### the agent's Discretion
- SRS Review Room flashcard UX (user only selected 2 of 6 areas) — planner/researcher should propose interaction pattern.
- Playlist UI/API design — not discussed, standard CRUD approach.
- Dashboard integration for "X words to review today" — not discussed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema & Existing Services
- `server/db.js` — Core DB schema (users, user_vocab_progress, user_stats, daily_words). Contains existing `target_language` and `genre` columns on users table that this phase extends.
- `server/services/srsEngine.js` — Existing SM-2 algorithm. Used by Review Room — do not duplicate.
- `server/routes/progress.js` — Existing `/stats`, `/review`, `/due` endpoints. `/review` already calculates SRS interval updates.

### Frontend Patterns
- `client/src/app/dashboard/page.tsx` — Dashboard grid with Stats/Recent/Daily cards. New badges card and review room integration go here.
- `client/src/components/DailyWordCard.tsx` — Reference pattern for card components with loading/error/refreshing states.
- `client/src/components/ui/Button.tsx` — Reusable Button with variant/size props.
- `client/src/lib/api.ts` — apiFetch utility with auth token management.
- `client/src/context/AuthContext.tsx` — Auth context; language fields will be added to user object.

### Design System
- `client/src/app/layout.tsx` — App layout with ThemeProvider + AuthProvider.

### Requirements
- `.planning/REQUIREMENTS.md` — STUDY-01 (SRS), STUDY-03 (gamification) scoped. AI-02 (personalization) relevant to AI prompt changes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **srsEngine.js** (`server/services/srsEngine.js`) — SM-2 algorithm with `calculateNextReview`, `correctnessToPerformance`, `nextReviewDate`. Ready to use for Review Room.
- **user_vocab_progress** table — Already has `stability`, `difficulty`, `next_review`, `reps` columns. No schema migration needed for SRS.
- **user_stats** table — Already has `streak_days`, `total_xp`, `last_study_date`. Badge streak tracking can hook into this.
- **progress.js routes** — `/review` endpoint already updates SRS intervals. `/due` endpoint already queries due words.
- **Dashboard card pattern** — Stats/Recent/Daily cards use consistent `rounded-2xl border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950 p-8` styling.
- **Button component** — Variant/size system. Can add dashboard nav buttons.

### Established Patterns
- **Tailwind dark mode** — `bg-zinc-50 dark:bg-black` page background, cards use the border+rounded pattern.
- **Express Router** — All API routes follow `router.get/post` pattern with `db.prepare` for SQLite queries.
- **DB migrations** — Gradual ALTER TABLE pattern in `db.js` (check columns, add if missing).
- **Lucide icons** — `lucide-react` already imported in dashboard.

### Integration Points
- **Dashboard page** (`app/dashboard/page.tsx`) — Add badges card and review room link to the feature grid (lines 145-243).
- **Nav header** — Add language badge next to email display.
- **User context** — Extend `User` interface in `AuthContext.tsx` with `native_language`, `target_language`.
- **AI service** (`server/services/aiService.js`) — Modify prompt to accept language parameters.
- **DB schema** (`server/db.js`) — Add playlists, playlist_songs, badges, user_badges tables.
- **New routes** — Playlist CRUD endpoints.

</code_context>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments from discussion. Open to standard approaches that follow existing patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 9-Retention, Gamification & Personalization*
*Context gathered: 2026-06-25*
