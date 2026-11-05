# Plan 006: Patch Next.js and server libraries, and stop the audio proxy fetching arbitrary URLs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c7eb9ff..HEAD -- client/package.json client/package-lock.json server/package.json server/package-lock.json server/routes/audio.js server/services/deezerService.js server/services/coverArtService.js server/routes/playlists.js`
> If any of these changed, compare the "Current state" excerpts below against
> the live code before editing; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW–MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c7eb9ff`, 2026-11-05

## Why this matters

Harmonix is live at https://harmonix.peeporunclub.co.uk. Three problems are fixable in a day:

1. The website runs **Next.js 16.3.4**. `npm audit` reports critical advisories for `next` 16.0.0–16.4.0, including remote code execution in the `next/og` image route (this app has one: `client/src/app/share/[id]/opengraph-image.tsx`) and an image-optimizer SSRF. The latest 16.x on npm is **16.4.5**.
2. The API's Express stack pulls in **proxy-addr 2.0.7 (critical)**, **body-parser ≤1.20.8 (high)** and **nanoid ≤3.3.17 (high)**.
3. The **public** endpoint `GET /api/audio/preview/:trackId` fetches whatever URL is stored as `preview` in the `song_cache` table, and any signed-in user can write that field through `POST /api/playlists/:id/songs`. That lets a user make the server request internal or third-party addresses (server-side request forgery).

## Current state

- `client/package.json:29` — `"next": "16.3.4"`; line 42 — `"eslint-config-next": "^16.3.4"`. React is `19.2.4`.
- `server/package.json` — `"express": "^4.19.2"`, `"nanoid": "^3.3.7"`. `body-parser` and `proxy-addr` come in through Express.
- `server/routes/playlists.js:141-156` — authenticated; trusts `req.body.track` and caches it:

```javascript
router.post('/:id/songs', async (req, res) => {
  const userId = req.user.id;
  const { song_id, track } = req.body;
  ...
    const normalized = await ensureTrackCover(String(song_id), track || {});
    try {
      upsertTrackCache(String(song_id), normalized);
```

- `server/services/coverArtService.js:16-24` — `upsertTrackCache` writes the whole object to `song_cache.track_json`; `ensureTrackCover` (line 29+) starts from `{ ...parseTrackJson(trackInput) }`, so every client field — including `preview` — survives.
- `server/services/deezerService.js:516-536` — `resolvePreviewForTrackId` falls back to the cached preview with only a prefix check:

```javascript
  if (cachedPreview && typeof cachedPreview === 'string' && cachedPreview.startsWith('http')) {
    return { previewUrl: cachedPreview, track: null };
  }
```

- `server/routes/audio.js:8-45` — reads `cached.track.preview`, calls `resolvePreviewForTrackId`, then `fetch(previewUrl, …)` (line 30) and on failure `fetch(itunes.preview, …)` (line 40). Mounted **without auth** at `server/index.js:341` (`app.use('/api/audio', audioRouter);`).
- **Production fact** (checked 2026-11-05): every real preview URL in `song_cache` uses `https://cdnt-preview.dzcdn.net/…` (709 rows) or `https://audio-ssl.itunes.apple.com/…` (247 rows). Nothing else is legitimate.
- An existing host-allowlist helper to imitate: `server/services/shareOg.js:9` `isAllowedCoverUrl(url)` (checks `host.endsWith('dzcdn.net')`, `mzstatic.com`, `itunes.apple.com`). Match its style.
- Tests: mocha + chai, files next to the code (`server/routes/*.test.js`, `server/services/*.test.js`). Route tests call the handler directly with a mock `res`; see `server/routes/progress.test.js:1-42` for the pattern (`router.stack.find(s => s.route.path === '/stats').route.stack[0].handle`).
- `client/AGENTS.md`: "This version has breaking changes … Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." Only a version bump is planned here, so no Next code is written.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Server tests | `cd server && npm test` | `443 passing` or more, 0 failing |
| Server audit | `cd server && npm audit --omit=dev` | no `critical` or `high` lines |
| Web audit | `cd client && npm audit --omit=dev` | no `critical`/`high` for `next` |
| Web typecheck | `cd client && npx tsc --noEmit -p .` | exit 0 |
| Web build | `cd client && npm run build` | exit 0; route list includes `/share/[id]` |
| Web unit tests | `cd client && node --experimental-strip-types --test 'src/lib/*.test.ts'` | `fail 0` |

## Scope

**In scope**
- `client/package.json`, `client/package-lock.json`
- `server/package.json`, `server/package-lock.json`
- `server/services/deezerService.js` (add `isAllowedPreviewUrl`, use it)
- `server/routes/audio.js`
- `server/services/coverArtService.js` (strip untrusted `preview` before caching)
- `server/services/deezerService.test.js`, `server/routes/audio.test.js` (create), `server/services/coverArtService.test.js` (create if absent)

**Out of scope**
- `client/android/`, `@capacitor/*` packages — legacy wrapper, not shipped; their advisories are not part of this plan.
- Any change to response shapes of `/api/audio/preview` or `/api/playlists/:id/songs`.
- Adding auth to `/api/audio/preview` — browsers load it directly from `<audio src>`, and public share pages use it.
- Content-Security-Policy headers.

## Git workflow

- Branch `advisor/006-security-patch`. Conventional commits, matching `git log` (e.g. `fix(security): allowlist preview hosts in the audio proxy`).
- Do not push or deploy unless the operator says so. (Production deploys on push to `main`.)

## Steps

### Step 1: Upgrade Next.js

`cd client && npm install next@16.4.5 eslint-config-next@16.4.5 --save-exact` (keep the existing exact-pin style for `next`; keep `^` for `eslint-config-next` if npm writes it that way).

**Verify**: `node -e "console.log(require('./node_modules/next/package.json').version)"` → `16.4.5`; `npx tsc --noEmit -p .` → exit 0; `npm run build` → exit 0 and the route table lists `/share/[id]`, `/discover`, `/app/library`; `npm audit --omit=dev | grep -c '^next '` → `0`.

### Step 2: Patch the server's dependencies

`cd server && npm install express@^4.21.2 nanoid@^3.3.18` then `npm audit fix --omit=dev` (no `--force`).

**Verify**: `node -e "for (const p of ['body-parser','proxy-addr','nanoid','express']) console.log(p, require(p + '/package.json').version)"` → body-parser ≥ 1.20.9, proxy-addr ≥ 2.0.8, nanoid ≥ 3.3.18; `npm audit --omit=dev` shows no critical/high; `npm test` → all passing.

### Step 3: Add a preview-host allowlist in `deezerService.js`

Add and export:

```javascript
/** Song previews come only from the Deezer and Apple CDNs. */
function isAllowedPreviewUrl(url) {
  try {
    const { protocol, hostname } = new URL(String(url));
    if (protocol !== 'https:') return false;
    const host = hostname.toLowerCase();
    return host === 'dzcdn.net' || host.endsWith('.dzcdn.net')
      || host === 'itunes.apple.com' || host.endsWith('.itunes.apple.com');
  } catch {
    return false;
  }
}
```

In `resolvePreviewForTrackId`, use the cached preview only when `isAllowedPreviewUrl(cachedPreview)`; also return a Deezer/iTunes result only if its preview passes (otherwise fall through to the next option, ending in the existing `no_preview` error).

**Verify**: add unit tests to `server/services/deezerService.test.js`: allowed — `https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/x.mp3`, `https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a`; rejected — `http://cdnt-preview.dzcdn.net/x.mp3`, `https://dzcdn.net.evil.example/x`, `https://169.254.169.254/latest`, `https://localhost/x`, `not a url`. And a `resolvePreviewForTrackId` test where `fetchTrack` fails (stub `fetchImpl` returning `{ ok: false }`) and `cachedPreview` is `https://example.com/x.mp3` with no artist/title → rejects with `no_preview`. `npm test` → all pass.

### Step 4: Re-check right before fetching in `routes/audio.js`

Before `fetch(previewUrl, …)` (line 30) and before `fetch(itunes.preview, …)` (line 40), require `deezer.isAllowedPreviewUrl(url)`. If it fails, respond `404` with `{ error: 'no_preview' }` (same shape the route already uses for missing previews) without calling `fetch`.

**Verify**: create `server/routes/audio.test.js`. Stub `validation.getCachedSong` to return `{ track: { preview: 'https://169.254.169.254/x' } }` and stub `deezer.fetchTrack` / global `fetch` so nothing real is called; assert status 404 and that the stubbed `fetch` was never called with the bad URL. Add a happy-path test (preview `https://cdnt-preview.dzcdn.net/x.mp3`, stubbed fetch returns 200 with a small body) → status 200. `npm test` → all pass.

### Step 5: Stop caching client-supplied preview URLs

In `coverArtService.ensureTrackCover`, after building `track`, delete `track.preview` unless `deezer.isAllowedPreviewUrl(track.preview)`. Do not otherwise change the returned shape.

**Verify**: test in `server/services/coverArtService.test.js` (create; follow `progress.test.js` style): `ensureTrackCover('x', { cover: 'https://e-cdns-images.dzcdn.net/c.jpg', preview: 'https://169.254.169.254/x' })` resolves to an object without `preview`; with `preview: 'https://cdnt-preview.dzcdn.net/x.mp3'` it is kept. `npm test` → all pass.

## Test plan

New tests: allowlist cases (Step 3), resolver fallback rejection (Step 3), audio route blocks a bad cached URL and serves a good one (Step 4), cover service strips bad preview (Step 5). Pattern: `server/routes/progress.test.js` (direct handler calls with a mock `res`).

## Done criteria

- [ ] `client/node_modules/next/package.json` version is `16.4.5`
- [ ] `cd client && npm audit --omit=dev` has no critical/high for `next`
- [ ] `cd client && npx tsc --noEmit -p . && npm run build` exit 0
- [ ] `cd server && npm audit --omit=dev` has no critical/high
- [ ] `cd server && npm test` exits 0 with the new tests passing
- [ ] `grep -n "startsWith('http')" server/services/deezerService.js` no longer matches inside `resolvePreviewForTrackId`
- [ ] Only in-scope files changed (`git status`)
- [ ] `plans/README.md` row for 006 updated

## STOP conditions

- `npm run build` fails after the Next upgrade with errors in app code (not just warnings) — report the errors; do not refactor pages.
- `npm audit fix` wants `--force` or a major Express upgrade (5.x).
- A legitimate preview host other than `*.dzcdn.net` / `*.itunes.apple.com` turns up in tests or code (e.g. a fixture using `mzstatic.com` for audio). Report it rather than widening the list on your own.

## Maintenance notes

- After deploy, smoke-test: open https://harmonix.peeporunclub.co.uk/discover, flip a card and press play on the preview; open any `/share/<id>` page and confirm its preview image renders.
- If a new music source is added, its preview host must be added to `isAllowedPreviewUrl`, with a test.
- Rows already in `song_cache` with a non-allowlisted preview are harmless after Step 4 (blocked at fetch time); no data migration needed.
