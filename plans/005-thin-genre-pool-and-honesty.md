# Plan 005: Thin genre×language pools — expand only after exhaustion, with honesty

> **Drift check**: `git diff --stat 6ced6d9..HEAD -- server/services/aiService.js server/services/dailyWordService.js client/src/components/DailyWordCard.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-unblock-next-song-reuse.md
- **Category**: bug / direction
- **Planned at**: commit `6ced6d9`, 2026-07-25

## Why this matters

Settings music style **is wired** (purge queue, stamp `preferred_genre`, hard filter). For thin combinations (e.g. `it`+`hip-hop`, `en`+`reggaeton`, many `fr`/`de` hip-hop), verified pools are empty or tiny. After uniqueness + validation failures, users get errors or the same few tracks — feels like “style does nothing.” Expanding silently to mixed `any` was removed for fidelity; we need a **controlled, honest** widen after true on-style exhaustion.

## Current state

- Hard genre filter: `dailyWordService.js` `validateAllCandidates` — no mixed fallback.
- Empty curated: `aiService.js` `getCuratedSongCandidates` returns `[]` when no hits.
- Verified empty: `getVerifiedSongCandidates` returns `[]` (no curated relabel).
- Catalog sizes (approx at `6ced6d9`): `en/reggaeton` 0; `fr/de/pt/it hip-hop` verified 0; curated thin.
- Product promise: CLAUDE.md / Settings — music style personalizes daily songs.

## Steps

### 1. Define exhaustion clearly

On-style pool is exhausted when **all** of:

1. Plan 001 relax already ran (or unused keys empty), **and**
2. `generateValidatedBatch` still returns zero valid payloads for `user.genre`, **and**
3. Preference epoch unchanged.

Only then allow widen.

### 2. Controlled widen policy (pick one; recommended A)

**A (recommended):** Second pass with `genre: "any"` for candidate fetch only; stamp `preferred_genre` / `song.genre` with the **actual** catalog genre; set payload flag `style_relaxed: true`.

**B:** Adjacent map only (e.g. hip-hop→pop) — more complex, reject unless product insists.

Implement A in `generateValidatedBatch` / `generateAndDeliverBatch`:

```text
try on-style → (001) relax reuse on-style → if still empty, one any-pass
```

Never forge user’s requested genre onto the song (keep verifiedGenreIndex truth from recent fix).

### 3. UI honesty

When `style_relaxed: true` (or `preferred_genre` ≠ user genre):

- Web DailyWordCard: muted one-line note under WOTD:  
  `Couldn't find more {genre} tracks — showing a close match.`
- Flutter learn_screen: same SnackBar or subtitle once per delivery.
- Do not show raw codes (plan 002).

### 4. Grow thin verified catalogs (data, not AI)

Add **real** verified songs (with correct genre labels) for the emptiest cells first:

- `en` reggaeton / latin urban (if product wants that style for English learners — or hide reggaeton for `en` in Settings)
- `fr`/`de`/`it`/`pt` hip-hop with real artists already used in curated strings

Prefer quality over volume; each row needs Deezer + LRCLib viability (smoke manually or with existing validation).

### 5. Tests

- Exhaust on-style stub → any-pass delivers with `style_relaxed: true` and honest genre stamp.
- Non-exhausted on-style → never sets `style_relaxed`.
- UI: optional component test; at least assert payload field documented in server test.

## Done criteria

- [ ] Thin genre users get a word after on-style failure, with visible honesty — not silent mislabel, not raw 503.
- [ ] On-style songs never stamped as wrong genre.
- [ ] At least one empty verified cell filled **or** Settings hides impossible genre×lang combos.
- [ ] Mocha coverage for widen gate.

## STOP conditions

- If product requires **hard fail** rather than widen — implement UI-only honesty (“no more songs in this style”) and skip any-pass.
- Do not reintroduce AI genre forgery (`genre: genreNorm` overwrite).

## Out of scope

- Hear-it (004)
- Dyslexia font
- Spotify streaming on Flutter

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Server tests | `cd server && JWT_SECRET=test JWT_REFRESH_SECRET=test NODE_ENV=test npx mocha 'services/dailyWordService.test.js' --timeout 20000` | pass |
| Catalog sanity | `node -e` loop genresCompatible over verified+curated | no leaks |
