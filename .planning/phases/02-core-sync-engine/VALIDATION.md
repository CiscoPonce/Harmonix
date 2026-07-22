# Phase 2 Validation Strategy: Core Sync Engine

This document defines the automated and manual verification procedures for Phase 2 of LyricWord.

## 1. Automated Verification Strategy

### Backend (Proxy APIs)
- **Search Integration**: Verify `/api/search` returns Deezer results with preview URLs.
- **Track Detail & Heuristics**: Verify `/api/tracks/:id` returns calculated `preview_offset`.
  - Test case: Track > 60s (ID: 132143) -> `preview_offset: 30`.
- **Lyrics Integration**: Verify `/api/lyrics` returns `syncedLyrics` from LRCLib for known tracks.

### Frontend (Sync Engine Hook)
- **LRC Parsing**: Verify `useSyncEngine` correctly populates `lines` array from LRC string.
- **Sync Accuracy**: Verify `currentLineIndex` updates when `audio.currentTime` is simulated.
- **Latency Compensation**: Verify the sync loop incorporates the -150ms constant in its calculation.
- **Bounds Checking**: Verify `seekTo` logic clamps values to the 0-30s range.

## 2. Manual Verification Checklist (UAT)

| Step | Action | Expected Outcome |
|------|--------|------------------|
| 1 | Load `/player/132143` (Daft Punk) | Metadata and lyrics load successfully. |
| 2 | Press Play | Audio starts; lyrics begin to highlight in sync. |
| 3 | Click a lyric line at ~15s | Audio jumps to correct position in the 30s snippet. |
| 4 | Click a lyric line outside 30s bounds | Audio jumps to 0s or 30s (whichever is closer). |
| 5 | Observe sync quality | Highlights match audio cues with no perceptible drift. |

## 3. Automated Smoke Test Script

The following script should be run after executing Plan 02-01:

```bash
#!/bin/bash
# proxy-smoke-test.sh

# 1. Test Search
curl -s "http://localhost:3001/api/search?q=daft+punk" | grep -q "preview" && echo "PASS: Search Proxy"

# 2. Test Offset Calculation (Daft Punk - One More Time, 320s)
curl -s "http://localhost:3001/api/tracks/132143" | grep -q "\"preview_offset\":30" && echo "PASS: Offset Heuristic"

# 3. Test Lyrics Proxy
curl -s "http://localhost:3001/api/lyrics?artist_name=Daft+Punk&track_name=One+More+Time&duration=320" | grep -q "syncedLyrics" && echo "PASS: Lyrics Proxy"
```

## 4. Success Criteria Alignment

- [ ] **PLAYER-01**: High-precision sync engine (>30fps) with `requestAnimationFrame`.
- [ ] **PLAYER-02**: Interactive lyric lines supporting click-to-seek functionality.
- [ ] **Heuristics**: Deezer preview start-times are correctly accounted for using duration-based logic.
- [ ] **Accuracy**: Latency compensation ensures tight alignment on varied hardware.
