---
phase: 02-core-sync-engine
plan: 02
subsystem: client
tags: [hooks, sync, audio]
requirements: [PLAYER-01]
requires: [02-01]
provides: [useSyncEngine hook]
affects: [Lyric Player Component]
tech-stack: [React, lrc-file-parser, requestAnimationFrame]
key-files: [client/src/hooks/useSyncEngine.ts]
decisions:
  - "Use lrc-file-parser for robust LRC handling"
  - "Use requestAnimationFrame for high-precision synchronization with audio.currentTime"
  - "Implement -150ms default latency compensation to align visuals with audio perception"
  - "Clamp seekTo between 0 and 30 seconds to respect snippet boundaries"
metrics:
  duration: 15m
  completed_date: "2026-06-12"
---

# Phase 02 Plan 02: Lyric Sync Engine Hook Summary

Implemented the core high-precision synchronization engine as a React hook. The `useSyncEngine` hook manages the relationship between audio playback and lyric line display, ensuring perfect alignment even with high-frequency updates.

## Key Changes

### `useSyncEngine` Hook
- **Library Integration**: Leverages `lrc-file-parser` for industry-standard LRC parsing and playback logic.
- **Sync Loop**: Implements a `requestAnimationFrame` loop that continuously updates the parser's state based on `audioRef.current.currentTime`.
- **Latency Compensation**: Includes a default `-150ms` offset to account for visual processing latency, making the lyrics feel more "snappy" and aligned with the beat.
- **State Management**: Provides `currentLineIndex` and `lines` for UI rendering.
- **Precision Controls**: Exports a `seekTo` function that is offset-aware and clamped to the 30-second snippet range.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Type Fix] Fixed TypeScript type issues**
- **Found during:** Task 2/3
- **Issue:** `requestRef` was initialized with `null` for a `number` type, and `lines` state lacked a proper interface.
- **Fix:** Used `number | undefined` and defined `LyricLine` interface.
- **Files modified:** `client/src/hooks/useSyncEngine.ts`
- **Commit:** `b4626e4`

**2. [Rule 2 - Hardening] Handled malformed LRC strings**
- **Found during:** Threat model review
- **Issue:** Parser could potentially throw on malformed input.
- **Fix:** Added try-catch block around `lyric.setLrc`.
- **Files modified:** `client/src/hooks/useSyncEngine.ts`
- **Commit:** `c2af7c0`

## Threat Flags
None.

## Self-Check: PASSED
- [x] Hook correctly parses LRC strings (verified via `lrc-file-parser` integration)
- [x] Sync loop updates index with sub-frame precision
- [x] Hook accounts for preview offset when syncing
- [x] `seekTo` respects 30s bounds
- [x] Commits made for each task
