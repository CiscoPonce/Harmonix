# Phase 3 Plan 02: Vocab API & Persistence Summary

Exposed vocabulary extraction through a REST API and ensured results are persisted to the SQLite database.

## Key Changes

### Backend
- **Vocab Router**: Implemented `server/routes/vocab.js` with `GET /:songId` endpoint.
  - Handles caching: checks `song_vocab_map` before triggering AI extraction.
  - Orchestrates extraction: fetches track info from Deezer, lyrics from LRCLib, extracts vocab via `aiService`, and maps it via `alignment` utility.
  - Persists results: saves to `vocab_items` and `song_vocab_map` within a database transaction.
  - Handles unmapped words: stores words that failed to align with `line_index = -1`.
- **API Integration**: Mounted the vocab router at `/api/vocab` in `server/index.js` and protected it with JWT authentication middleware.
- **Tests**: Created `server/routes/vocab.test.js` covering caching logic, extraction flow, and mapped/unmapped item handling.

## Verification Results

### Automated Tests
- `server/routes/vocab.test.js` passed with 2/2 tests.
- Manual `curl` verification confirmed that the endpoint is protected by auth and correctly processes requests (passing auth and reaching external API calls).

### Success Criteria
- [x] User can request vocabulary for a specific song.
- [x] Extracted vocabulary is cached in the database.
- [x] System handles missing lyrics gracefully (returns 404 if lyrics not found).
- [x] REST endpoint `/api/vocab/:songId` returns `mapped` and `unmapped` arrays.

## Deviations
None - plan executed as written.

## Self-Check: PASSED
- [x] `server/routes/vocab.js` exists and is implemented.
- [x] `server/routes/vocab.test.js` exists and passes.
- [x] `server/index.js` correctly mounts the router.
- [x] All commits made for each task.
