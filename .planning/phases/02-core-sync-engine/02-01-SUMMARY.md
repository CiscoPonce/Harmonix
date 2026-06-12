---
phase: 02-core-sync-engine
plan: 01
subsystem: backend
tags: [deezer, lrclib, proxy, sync-engine]
dependency_graph:
  requires: []
  provides: [media-api]
  affects: [server/index.js]
tech_stack:
  added: []
  patterns: [proxy, fetch]
key_files:
  created: []
  modified: [server/index.js]
decisions:
  - "Use native fetch for proxying requests in Node.js backend."
  - "Implement preview offset heuristic: 30s for tracks > 60s, (duration-30) for tracks > 30s, else 0."
  - "Proxy LRCLib results to expose only syncedLyrics field."
metrics:
  duration: 15m
  completed_date: "2025-03-05"
---

# Phase 02 Core Sync Engine Plan 01: Backend Media Proxy Summary

Implemented backend proxy endpoints to fetch track metadata from Deezer and lyrics from LRCLib, bypassing CORS and implementing necessary timing heuristics for the player.

## Key Changes

### server/index.js
- Added `GET /api/search` endpoint to proxy Deezer search.
- Added `GET /api/tracks/:id` endpoint to proxy Deezer track details.
- Implemented `preview_offset` calculation logic based on track duration to support audio-lyric synchronization.
- Added `GET /api/lyrics` endpoint to proxy LRCLib lyric retrieval.
- Integrated error handling for external API failures.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

### Automated Tests
- Verified `GET /api/tracks/:id` returns correct metadata and `preview_offset`.
- Verified `GET /api/lyrics` returns `syncedLyrics` LRC string.
- Verified `GET /api/search` returns valid track list from Deezer.

```bash
# Example verification call
curl -s "http://localhost:3001/api/tracks/136889400"
# Output: {"id":136889400,"title":"Starboy","artist":"The Weeknd",...,"duration":230,"preview_offset":30}
```

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: proxy | server/index.js | Proxies requests to Deezer and LRCLib APIs. |

## Self-Check: PASSED
- [x] Endpoints /api/search, /api/tracks/:id, /api/lyrics implemented.
- [x] Preview offset logic verified.
- [x] Commits made for changes.
- [x] Summary created.
