# Plan 001: Unblock Next/New when Deezer IDs collide but catalog keys remain

> **Executor instructions**: Follow step by step. Run every verification command.
> If a STOP condition hits, stop and report — do not improvise.
> When done, set this plan’s status to DONE in `plans/README.md`.
>
> **Drift check (run first)**:  
> `git diff --stat 6ced6d9..HEAD -- server/services/dailyWordService.js server/services/dailyWordService.test.js`  
> If those files changed, re-read the “Current state” excerpts before editing.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6ced6d9`, 2026-07-25

## Why this matters

Production shows a red banner `song_already_used` when the user taps **New word**. Generation rejects a Deezer `track.id` already in history, but `hasUnusedSongCandidates` still returns true because it only checks artist|title **keys**. Relax-reuse never runs → cold Next/New returns 503 → personalization feels broken. Users cannot get a new tailored word.

## Current state

- `server/services/dailyWordService.js` — `tryValidateSongCandidate` rejects used Deezer IDs:

```javascript
// ~351-353
if (!allowSongReuse && seenSongIds.has(String(track.id))) {
  console.warn(`daily word reject: song_already_used ${label}`);
  return { error: "song_already_used" };
}
```

- Same file — relax only when unused **keys** are gone:

```javascript
// ~1086-1096
let result = await runOnce(false);
if (!result.valid.length && !hasUnusedSongCandidates(user.id, langCode, genre)) {
  result = await runOnce(true); // relaxSongReuse
} else if (!result.valid.length) {
  console.warn(`... catalog still has unused — not reusing songs`);
}
```

- `hasUnusedSongCandidates` (~724-735) filters curated/verified by artist|title keys only — not resolved Deezer IDs.
- No tests cover `song_already_used` → relax path (grep empty in `dailyWordService.test.js`).

**Conventions:** Match existing mocha + chai tests in `server/services/dailyWordService.test.js`. Use `NODE_ENV=test` and JWT env vars as in other server tests. Prefer minimal logic change over catalog dump.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `cd server && JWT_SECRET=test JWT_REFRESH_SECRET=test NODE_ENV=test npx mocha 'services/dailyWordService.test.js' --timeout 15000` | exit 0, all pass |
| Genre grep tests | same file `--grep 'song_already_used\|relax\|unused'` | new cases pass |

## Steps

### 1. Add a helper that decides whether to force relax after a failed unused pass

In `server/services/dailyWordService.js`, after `runOnce(false)` fails:

- If `!result.valid.length` **and** (`result.lastError === "song_already_used"` **or** every candidate in the attempted pool resolved to used IDs / no_suitable_word with no remaining *validatable* unused tracks), call `runOnce(true)`.
- Keep the existing path: if `!hasUnusedSongCandidates(...)`, also relax (unchanged).
- Log clearly: `unused pass yielded only song_already_used — allowing song reuse for new words`.

**Do not** expand genre to `any` in this plan (that is plan 005).

Verification: unit test below fails before the code change, passes after.

### 2. Characterization test — ID collision while keys remain

In `server/services/dailyWordService.test.js`, add a test that:

1. Seeds `daily_words` with a song that used Deezer id `"100"` (artist A / title T).
2. Stubs AI/curated so the only candidate is artist A / title T **or** a different title that Deezer mock resolves to id `"100"`.
3. Ensures `hasUnusedSongCandidates` would still be true if other unused catalog keys exist (stub `getCuratedSongCandidates` / verified to include unused keys that mockFetch cannot validate — OR stub so keys look unused but Deezer always returns id 100).
4. Calls `generateDailyWord` / `generateNextDailyWord` with `force: true` and mockFetch.
5. **Expect:** a valid payload is returned (relax path), **not** throw with `song_already_used`.

Use the existing `stubSongPipeline` + mockFetch patterns in the same file (~lines 25–47, 225–270).

### 3. Keep uniqueness as default when unused *validatable* songs remain

Do not always relax. Only force relax when the unused pass produced zero valid payloads and lastError indicates exhaustion via ID collision (or equivalent). Add a second test: when mockFetch returns a **new** unused Deezer id for an unused catalog song, that song is preferred and history song is not reused.

## Done criteria

- [ ] Cold Next/New no longer 503s solely because of `song_already_used` when the unused key pool is non-empty but unvalidatable / ID-colliding.
- [ ] New mocha tests pass; full `dailyWordService.test.js` suite passes.
- [ ] Logs distinguish “catalog key exhaustion” vs “ID collision → relax”.

## STOP conditions

- If product owner requires **never** reusing a Deezer track even when New Word would fail — STOP and ask; do not silently expand to other genres here.
- If `generateValidatedBatch` structure has been refactored so `lastError` is no longer available — STOP and re-spec.

## Out of scope

- Friendly UI error strings (plan 002)
- Genre expand to `any` (plan 005)
- Hear-it timing (plan 004)
- Flutter UI

## Test plan

| Case | Expect |
|------|--------|
| History has Deezer id X; candidate resolves to X; unused keys still listed | relax → deliver word |
| Unused candidate resolves to new id Y | deliver from Y; no relax needed |
| True catalog exhaustion (no unused keys) | existing relax path still works |

## Maintenance

Any future uniqueness rule must keep **key-space** and **Deezer ID-space** aligned, or always treat “unused pass empty + song_already_used” as relax trigger.
