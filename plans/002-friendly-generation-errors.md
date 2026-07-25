# Plan 002: Never show raw generation codes like `song_already_used`

> **Drift check**: `git diff --stat 6ced6d9..HEAD -- client/src/components/DailyWordCard.tsx mobile/lib/services/api_client.dart`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (parallel with 001)
- **Category**: bug
- **Planned at**: commit `6ced6d9`, 2026-07-25

## Why this matters

Screenshot: red banner shows `song_already_used`. API returns `{ error: "daily_word_unavailable", reason }` and web/Flutter fall through to displaying `reason` raw when unmapped. Users see internals, not help.

## Current state

Web (`DailyWordCard.tsx` ~242-256) maps only:

- `invalid_ai_daily_word_response`
- `daily_word_generation_failed` / `generation_failed`
- `ai_rate_limit` / `429`
- `cooldown_active`
- `batch_in_progress`

Else: `msg = body.reason` → thrown → red banner.

Flutter (`api_client.dart` `friendlyDailyWordError` ~35-59) same gap; default returns `reason`.

Server (`dailyWord.js` ~59-67) correctly keeps `reason` for clients — do **not** remove it; map on clients.

## Steps

### 1. Web — extend reason map in `DailyWordCard.tsx`

Add cases (copy tone of existing messages):

| reason | Message |
|--------|---------|
| `song_already_used` | "We're finding a fresh song match — tap New word again in a moment." |
| `lyrics_not_found` / `deezer_not_found` / `lyrics_validation_failed` / `lyric_outside_preview` / `no_suitable_word` | "Couldn't match a song with synced lyrics right now. Try again shortly." |
| `lyrics_wrong_language` | "That song didn't match your learning language. Trying another…" |
| `stale_preferences` | "Your learning preferences changed — loading a new word…" |
| `daily_word_stale_preferences` | same |

Keep unknown reasons as a **generic** sentence, **never** the raw code:  
`"Couldn't load a new word right now. Please try again."`  
Optionally `console.warn` the raw reason for debugging.

### 2. Flutter — extend `friendlyDailyWordError` in `api_client.dart`

Mirror the same reason → string map. Ensure `nextDailyWord` / `getDailyWord` paths use this helper (they already should).

### 3. Smoke test

- Manual or unit: for web, extract mapping to a tiny pure function `friendlyDailyWordReason(reason)` in `client/src/lib/dailyWordErrors.ts` + node test (optional but preferred).
- Flutter: add a small unit test next to existing tests if pattern exists; else rely on switch coverage.

## Done criteria

- [ ] No user-visible banner can display `song_already_used` or other snake_case codes.
- [ ] Known reasons have specific copy; unknown → generic sentence.
- [ ] Server still returns `reason` for logs.

## STOP conditions

- Do not change HTTP status codes without product ask.
- Do not hide the error entirely (user must know to retry).

## Out of scope

- Fixing the underlying uniqueness failure (plan 001)
- Translation badge (plan 003)
