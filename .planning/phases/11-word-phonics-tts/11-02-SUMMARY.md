---
phase: 11-word-phonics-tts
plan: 02
subsystem: ui
tags: [tts, pronunciation, lucide, volume2, audio-playback, blob-url]

# Dependency graph
requires:
  - phase: 11-word-phonics-tts
    plan: 01
    provides: [GET /api/daily-word/pronounce endpoint, Pocket-TTS daemon, TTS service with SQLite cache]
provides:
  - DailyWordCard pronunciation button with Volume2 icon
  - On-demand audio playback via Blob URL
  - Language-gated visibility for 6 supported languages
  - Pulsing animation during playback
  - Error toast on pronunciation failure
affects: [frontend pronunciation UX, DailyWordCard]

# Tech tracking
tech-stack:
  added: [Volume2 lucide-react icon, Blob URL audio pattern]
  patterns: [isSpeaking guard, retry-with-error-toast, animate-pulse feedback]

key-files:
  created: []
  modified:
    - client/src/components/DailyWordCard.tsx

key-decisions:
  - "Used Blob URL pattern (URL.createObjectURL/revokeObjectURL) for pronunciation audio instead of HTML audio element src"
  - "Retry logic: 2 attempts (attempt 0 + attempt 1) with 'Pronunciation unavailable' toast on final failure"
  - "Used existing refreshError state for pronunciation error display with 3-second auto-clear"

patterns-established:
  - "Blob URL audio: fetch blob from apiFetch, create ObjectURL, play via new Audio(), revoke on end/error"
  - "Language-gated UI: SUPPORTED_LANGUAGES.includes(user?.target_language) for conditional rendering"

requirements-completed: ["PHONICS-01"]

# Metrics
duration: 1min
completed: 2026-07-11
---

# Phase 11 Plan 02: Pronunciation Button Summary

**Volume2 speaker icon with Blob URL audio playback, pulsing animation, and language-gated visibility on DailyWordCard**

## Performance

- **Duration:** 1 min
- **Started:** 2026-07-11T17:01:14Z
- **Completed:** 2026-07-11T17:02:26Z
- **Tasks:** 1 (auto) + 1 (checkpoint:human-verify, deferred to end-of-phase)
- **Files modified:** 1

## Accomplishes

- Volume2 icon from lucide-react added to DailyWordCard imports
- SUPPORTED_PRONUNCIATION_LANGUAGES constant matching backend VOICE_MAP keys
- isSpeaking state + pronunciationAudioRef for playback management
- playPronunciation async function with retry loop (2 attempts), Blob URL creation, and error toast
- Speaker button rendered after pronunciation span, hidden for unsupported languages
- animate-pulse feedback during playback, normal state after onended/onerror
- e.stopPropagation() prevents parent flip button from triggering
- TypeScript compiles cleanly (npx tsc --noEmit passes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Pronunciation Button + Audio Playback to DailyWordCard** - `dff8fea` (feat)

## Files Created/Modified

- `client/src/components/DailyWordCard.tsx` - Added Volume2 import, SUPPORTED_PRONUNCIATION_LANGUAGES constant, isSpeaking state, pronunciationAudioRef, playPronunciation function, and pronunciation button with language gating

## Decisions Made

- **Blob URL pattern over HTML audio src:** Fetch WAV blob from apiFetch, create ObjectURL, play via new Audio(), revoke on ended/error events. More control over lifecycle than setting audio.src directly.
- **Reuse refreshError for pronunciation errors:** Avoids adding new toast state; 3-second auto-clear via setTimeout keeps UX clean.
- **No loading spinner for pronunciation:** Per D-11-13, immediate play on click. The animate-pulse on Volume2 icon serves as the "playing" indicator. If the first click doesn't produce audio within 200ms, the pulse animation already provides feedback.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Human Verification (Deferred to End-of-Phase)

Task 2 verification steps for end-of-phase review:
1. Speaker icon visible next to phonics for supported languages (es, fr, de, pt, en, it)
2. Speaker icon hidden for unsupported languages (e.g., zh)
3. Audio plays on click via /api/daily-word/pronounce
4. Pulsing animation (animate-pulse) during playback
5. Error toast "Pronunciation unavailable" on TTS failure after retry
6. No regression in existing DailyWordCard functionality (flip, song preview, queue status)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Frontend pronunciation feature complete (backend from 11-01 + frontend from 11-02)
- Pocket-TTS daemon must be running for pronunciation to work
- Phase 11 complete, ready for verification or next phase

---
*Phase: 11-word-phonics-tts*
*Completed: 2026-07-11*

## Self-Check: PASSED
