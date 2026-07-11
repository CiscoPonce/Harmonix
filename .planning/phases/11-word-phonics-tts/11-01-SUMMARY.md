---
phase: 11-word-phonics-tts
plan: 01
subsystem: api
tags: [tts, pocket-tts, sqlite, wav, pronunciation, daemon]

# Dependency graph
requires:
  - phase: 09-word-queue
    provides: [daily word generation, word queue service, pre-cache hook points]
provides:
  - GET /api/daily-word/pronounce endpoint returning cached/fresh WAV audio
  - Pocket-TTS daemon lifecycle management (start/stop/restart/healthCheck)
  - TTS service with SQLite caching, WAV silence padding, voice mapping
  - word_pronunciation_cache table
  - Pre-caching hooks on daily word generation
affects: [11-02, frontend pronunciation button]

# Tech tracking
tech-stack:
  added: [pocket-tts 2.1.0, child_process.spawn daemon]
  patterns: [WAV silence padding, SQLite BLOB cache, daemon health check with retry]

key-files:
  created:
    - server/services/ttsDaemon.js
    - server/services/ttsService.js
  modified:
    - server/db.js
    - server/index.js
    - server/routes/dailyWord.js
    - server/routes/dailyWord.test.js

key-decisions:
  - "D-11-10: Cache key is word only (not word+language) — same word in different languages shares cache"
  - "Corrected voice names from RESEARCH.md: de→juergen, pt→rafael, en→alba, it→giovanni (D-11-03 originals were invalid)"
  - "Single Pocket-TTS instance per user language, restart on language change"

patterns-established:
  - "Daemon lifecycle: child_process.spawn with stderr readiness detection, SIGTERM→SIGKILL stop, health check fetch"
  - "WAV padding: 44-byte header + silence + PCM + silence, update chunk/data size fields"

requirements-completed: ["PHONICS-01"]

# Metrics
duration: 5min
completed: 2026-07-11
---

# Phase 11 Plan 01: Word Phonics TTS Integration Summary

**Pocket-TTS daemon management, SQLite-cached pronunciation proxy with WAV silence padding, and authenticated /pronounce endpoint with pre-cache hooks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-11T16:53:20Z
- **Completed:** 2026-07-11T16:59:05Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishes

- word_pronunciation_cache table with word-only cache key (D-11-10)
- ttsDaemon.js singleton managing Pocket-TTS process lifecycle (start/stop/restart/healthCheck)
- ttsService.js with VOICE_MAP, padWavWithSilence, SQLite cache, and retry-on-language-change
- GET /pronounce endpoint with auth, input validation, cache, and Pocket-TTS proxy
- Pre-cache hooks in handleDailyWord and POST /next (fire-and-forget)
- 4 new pronounce tests (400, 404, cache hit, cache miss) + existing tests unbroken

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DB Migration + TTS Daemon + TTS Service** - `07c84ef` (feat)
2. **Task 2: Add /pronounce Route + Pre-cache Hook + Tests** - `71233ff` (feat)

## Files Created/Modified

- `server/services/ttsDaemon.js` - Pocket-TTS process lifecycle management (start/stop/restart/healthCheck)
- `server/services/ttsService.js` - TTS proxy, SQLite cache, WAV padding, voice mapping (6 languages)
- `server/db.js` - Added word_pronunciation_cache table (word TEXT PRIMARY KEY, audio_blob BLOB)
- `server/index.js` - Start Pocket-TTS daemon with English default on boot
- `server/routes/dailyWord.js` - GET /pronounce endpoint + pre-cache hooks in handleDailyWord and /next
- `server/routes/dailyWord.test.js` - 4 new pronounce tests + mockRes expanded with setHeader/send

## Decisions Made

- **Corrected voice names from RESEARCH.md:** D-11-03 specified helena/brasil/amy/fiamma which don't exist in Pocket-TTS. Replaced with validated names: de→juergen, pt→rafael, en→alba, it→giovanni (es→lola, fr→estelle unchanged)
- **Single daemon instance:** Restart on language change instead of running 6 instances (saves ~2GB RAM)
- **Cache key is word only:** Per D-11-10, same word in different languages shares cache

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend TTS infrastructure complete (daemon, service, endpoint, cache, tests)
- Ready for Plan 11-02: Frontend pronunciation button in DailyWordCard
- Pocket-TTS binary must be installed (`pip install pocket-tts` or vendored venv) before daemon can start in production

---
*Phase: 11-word-phonics-tts*
*Completed: 2026-07-11*
