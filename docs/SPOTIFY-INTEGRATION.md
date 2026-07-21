# Spotify Integration — Operations & Release Runbook

**API baseline:** February 2026 Spotify Web API  
**Capability matrix:** [`.planning/phases/12-spotify-api-integration/COVERAGE.md`](../.planning/phases/12-spotify-api-integration/COVERAGE.md)  
**Validation evidence:** [`.planning/phases/12-spotify-api-integration/12-VALIDATION.md`](../.planning/phases/12-spotify-api-integration/12-VALIDATION.md)  
**Release process:** [`docs/RELEASES.md`](./RELEASES.md)

Harmonix owns OAuth, tokens, Spotify HTTP, matching, and mutations on Express. Next.js and Flutter consume only Harmonix `/api/spotify/*` DTOs. Spotify content must never be sent to NVIDIA NIM or any other AI/ML system.

**Development Mode is never a public-release substitute.** Five allowlisted users and a Premium app owner are sandbox-only. Public release beyond that ceiling requires Spotify Extended Quota approval (gate in plan 12-11).

---

## 1. Environment configuration

Copy names from `server/.env.example`. Never commit secret values.

| Variable | Purpose | Constraints |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Dashboard Client ID | Required for live OAuth |
| `SPOTIFY_REDIRECT_URI` | Exact HTTPS backend callback | Must match Dashboard redirect URI character-for-character |
| `SPOTIFY_WEB_SUCCESS_URL` | Post-OAuth web Library landing | Fixed env value — not caller-supplied |
| `SPOTIFY_WEB_ERROR_URL` | Post-OAuth web Settings recovery | Fixed env value |
| `SPOTIFY_ANDROID_SUCCESS_URL` | Verified App Link → Library | Fixed env value; production needs controlled domain |
| `SPOTIFY_ANDROID_ERROR_URL` | App Link → Settings | Fixed env value |
| `SPOTIFY_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key | Exactly **32 bytes**, base64-encoded |
| `SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION` | Active key version label | e.g. `v1`; must match envelopes |
| `SPOTIFY_TOKEN_KEY_CUSTODY_OWNER` | Human/ops owner of key material | Document who rotates |
| `SPOTIFY_SCOPES` | D-12-14 scopes only | See §3 |
| `SPOTIFY_MATCH_CACHE_POLICY` | Cache TTL / revalidate / delete | Default `ttl=7d;revalidate_on_export;delete_on_disconnect` |
| `SPOTIFY_QUOTA_MODE` | `development` or release mode marker | Development Mode ≠ production entitlement |

### Callback and return destinations

- **Callback (backend-owned):** `{SPOTIFY_REDIRECT_URI}` → path `/api/spotify/oauth/callback`
- **Web success:** Library (`/playlists?spotify=connected` or configured absolute URL)
- **Web error:** Settings (`/settings?spotify=error…` with allowlisted reason)
- **Android success:** App Link into Library (`…/app/library?spotify=connected`)
- **Android error:** App Link into Settings (`…/app/settings?spotify=error…`)

Sandbox may use the development ngrok HTTPS host recorded in plan 12-01. **Ngrok is not a production release assumption.** Production Android return requires a controlled HTTPS domain, release signing certificate fingerprint, and matching Digital Asset Links (`assetlinks.json`) before verified App Links are treated as release-ready.

### Validate before starting the server

```bash
# From repo root — names only; values come from local server/.env
node -e "
require('dotenv').config({ path: 'server/.env' });
const req = [
  'SPOTIFY_CLIENT_ID','SPOTIFY_REDIRECT_URI',
  'SPOTIFY_WEB_SUCCESS_URL','SPOTIFY_WEB_ERROR_URL',
  'SPOTIFY_ANDROID_SUCCESS_URL','SPOTIFY_ANDROID_ERROR_URL',
  'SPOTIFY_TOKEN_ENCRYPTION_KEY','SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION',
  'SPOTIFY_SCOPES'
];
for (const k of req) if (!process.env[k]) throw new Error('missing '+k);
const key = Buffer.from(process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY, 'base64');
if (key.length !== 32) throw new Error('encryption key must decode to 32 bytes');
if (!process.env.SPOTIFY_REDIRECT_URI.startsWith('https://')) throw new Error('callback must be https');
console.log('Spotify env shape OK; quota mode=', process.env.SPOTIFY_QUOTA_MODE || '(unset)');
"
```

---

## 2. Spotify Developer Dashboard checklist

| Fact | Sandbox (Development Mode) | Public release |
|---|---|---|
| App owner | Spotify Premium required | Same |
| Allowlisted users | **Maximum 5** authenticated users | Not sufficient — need Extended Quota |
| Redirect URI | Exact `SPOTIFY_REDIRECT_URI` | Production HTTPS callback only |
| Client secret | Not used (PKCE public client on backend) | Same |
| Extended Quota | **Not requested / not approved** for sandbox | **Hard gate** before any non-allowlisted user |

Record Premium owner identity and the five-user allowlist outside the repo (ops secret store). Do not invent Client IDs.

---

## 3. Scopes (D-12-14)

Request only:

```text
playlist-read-private
playlist-read-collaborative
playlist-modify-private
```

Do **not** request playback, history, library, or `playlist-modify-public`. Exports create **private** playlists only.

---

## 4. February 2026 Spotify endpoints Harmonix uses

| Capability | Spotify path | Harmonix surface |
|---|---|---|
| List current-user playlists | `GET /me/playlists` | `GET /api/spotify/playlists` |
| Playlist metadata | `GET /playlists/{id}` | Used for header / ownership when permitted |
| Playlist items | `GET /playlists/{id}/items` | `GET /api/spotify/playlists/:id` |
| Create private playlist | `POST /me/playlists` | Inside `POST /api/spotify/exports` |
| Add items | `POST /playlists/{id}/items` | Export mutation (batches ≤ **100**) |
| Search tracks | `GET /search?type=track&limit≤10` | Matching only |

**Forbidden legacy paths:** `/users/{id}/playlists`, `/playlists/{id}/tracks`.

Official references:

- [February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)
- [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
- [Get playlist items](https://developer.spotify.com/documentation/web-api/reference/get-playlists-items)
- [Design / attribution](https://developer.spotify.com/documentation/design)

---

## 5. Data model & sync lifecycle

### `user_spotify_tokens`

- Access + refresh tokens encrypted with AES-256-GCM (`SPOTIFY_TOKEN_ENCRYPTION_KEY`).
- Envelopes store `key_version`; decrypt **fails closed** on wrong/inactive version (no plaintext fallback).
- `authorized_at` drives **six months** refresh-token lifetime; `invalid_grant` or six-month expiry deletes credentials and returns `reconnect_required` without retry.

### `user_spotify_playlists` (composite PK: `user_id` + `spotify_playlist_id`)

- Normalized list snapshot from complete `/me/playlists` sync only.
- **Upsert + prune** only after a **complete** sync succeeds.
- Partial failure, timeout, or 429 **preserves** prior rows (no destructive prune).
- Fields include ownership, collaborative, `detail_access` (`full` \| `restricted`), artwork, external URL, `synced_at` / `expires_at` (metadata TTL, typically 7 days).
- Restricted (followed) playlists may appear in list; items may 403 — detail uses fresh same-user normalized metadata or revalidates via full `/me/playlists` sync. Direct access without authorized metadata fails safely (non-disclosing 404), never a fake empty track list.

### Match cache (`song_cache` Spotify columns)

- Keyed by Harmonix source identity + Spotify **market**.
- Policy: `ttl=7d;revalidate_on_export;delete_on_disconnect`.
- Reuse requires same market and approved freshness; otherwise revalidate URI availability.

### Export jobs (`spotify_export_jobs`)

- Server-owned job identity; clients restore via authenticated `GET /api/spotify/exports/latest?source_playlist_id=…` and `GET /api/spotify/exports/:id`.
- Order: classify all source songs → create one private playlist → add accepted `spotify:track:` URIs in batches of ≤100.
- Distinguish pre-create failure (no destination) from post-create/partial-add failure (report exact partial state + safe destination URL).

---

## 6. Client UX constraints

- Settings hosts Connect / Connected / Reconnect / Disconnect (not Library).
- Library shows provider-separated Spotify group; Spotify failures must not clear Harmonix content.
- Display at most **20** Spotify items in a content set; continuation is the **API-provided** HTTPS `open.spotify.com` onward link (no invented local pagination).
- Open in Spotify: only API-provided HTTPS URLs after client validation.
- Provider tokens, codes, PKCE verifiers, and OAuth state never enter clients, query strings, analytics, or logs.

---

## 7. Rate limiting & Retry-After

- Per-user admission control on Spotify HTTP.
- Search concurrency kept low for export matching.
- On HTTP **429**, wait the exact `Retry-After` seconds (capped retries); do not invent exponential backoff that ignores the header.
- Offline / network errors surface as recoverable client copy; do not prune playlist rows.

---

## 8. Encryption key rotation (external, versioned, no fallback)

1. Generate a new 32-byte key: `openssl rand -base64 32`
2. Provision under a **new** `SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION` (e.g. `v2`) in the deployment secret store. Custody owner: `SPOTIFY_TOKEN_KEY_CUSTODY_OWNER`.
3. There is **no dual-key decrypt fallback** in code. Rotating the key without re-linking users makes existing ciphertext undecryptable → treat as forced reconnect.
4. Operational procedure for production rotation:
   - Announce maintenance window.
   - Deploy new key + version together.
   - Force disconnect / require reconnect for all linked users (or run a controlled migration tool if one is added later — none ships in Phase 12).
5. Never log key material, ciphertext, IVs, or tags.

---

## 9. Disconnect & deletion procedure

`DELETE /api/spotify/connection` (authenticated) must:

1. Delete encrypted tokens for that user.
2. Invalidate outstanding OAuth transactions.
3. Stop in-flight provider work for that user.
4. Delete `user_spotify_playlists` rows for that user.
5. Clear Spotify-derived match-cache evidence for that user’s songs.
6. Soft-delete / remove that user’s export jobs so latest/by-id cannot restore stale reports.
7. Return acknowledgement before clients clear Connected UI.

Idempotent: repeated DELETE is success. Covered by backend route tests and Flutter/web resilience matrix (12-09).

---

## 10. Logging & redaction

Never log: access/refresh tokens, authorization codes, PKCE verifiers, raw OAuth `state`, encryption keys, or full Spotify callback query strings.

Safe to log: Harmonix user id (internal), playlist stable ids after validation, high-level error codes (`reconnect_required`, `rate_limited`, `restricted`, `offline`).

---

## 11. No-AI boundary

Matching and export must not call NVIDIA NIM, OpenAI, Anthropic, Pocket-TTS, or daily-word AI paths. Automated proof: injected AI spy + fetch-host rejection + source import scan in `spotifyExportService.test.js` / match modules.

---

## 12. Automated local release matrix

Documented runnable commands (from a clean install/runtime):

```bash
# Backend ABI + full suite (requires test encryption key)
cd server
npm rebuild better-sqlite3
NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= npm test

# Spotify-focused backend (release-candidate evidence when full suite has unrelated debt)
NODE_ENV=test SPOTIFY_TOKEN_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
  npx mocha services/spotifyOAuthService.test.js services/spotifyCrypto.test.js \
  services/spotifyService.test.js routes/spotify.test.js \
  services/spotifyPlaylistList.test.js routes/spotifyPlaylistList.test.js \
  services/spotifyPlaylistDetail.test.js routes/spotifyPlaylistDetail.test.js \
  services/spotifyMatchService.test.js services/spotifyMatchCorpus.test.js \
  services/spotifyExportService.test.js routes/spotifyExport.test.js

# Web
cd ../client
npm run test:spotify
npx eslint src/lib/spotifyContracts.ts src/lib/spotifyContracts.test.ts \
  src/components/SpotifyConnectionCard.tsx src/components/SpotifyExportDialog.tsx \
  src/components/SpotifyMatchReport.tsx
npm run build
# Note: repo-wide `npm run lint` may still fail on pre-existing non-Spotify ESLint debt.

# Flutter
cd ../mobile
flutter test
flutter analyze --no-fatal-infos
```

Observed 12-10 evidence is recorded in `12-VALIDATION.md`. Do not fabricate green counts.

### Fault-injected automated suites (not real sandbox)

These are **code-level** proofs — do not claim them as live Spotify observations:

| Scenario | How proven |
|---|---|
| Six-month refresh expiry | Fake clock → `reconnect_required`, credentials deleted |
| Exact Retry-After 429 | Injected 429 + `Retry-After` header |
| Zero accepted matches | Controlled matching → no playlist create |
| Pre-create failure | Fail before `POST /me/playlists` → no destination |
| Post-create / partial add | Fail after create or mid-batch → partial report + safe URL |
| No-AI boundary | Spy + host rejection + import scan |

---

## 13. Real sandbox smoke (manual — plan 12-11)

Feasible only with Premium owner + allowlisted account + live Client ID:

1. **OAuth connect** from web Settings → consent → Library lands with Spotify group.
2. **OAuth connect** from Android Settings → App Link return → Library selected once.
3. **List** owned + followed playlists; open owned detail (tracks) and restricted detail (no fake empty list).
4. **Export** owned Harmonix playlist → private Spotify playlist created → items added → report + Open in Spotify.
5. **Disconnect** → tokens/rows gone; UI returns to Connect; no stale Spotify cards.
6. **Deep link** cold/warm Android return for success and allowlisted error reasons.

---

## 14. Troubleshooting

| Symptom | Likely cause | Operator action |
|---|---|---|
| Offline / network error copy | Device or server cannot reach Spotify | Restore network; do not prune local Spotify rows |
| Rate limited / wait message | HTTP 429 with `Retry-After` | Wait exact seconds; reduce concurrent export/search |
| `reconnect_required` / invalid_grant | Refresh revoked or **six months** since `authorized_at` | User must Connect again; credentials already deleted |
| Restricted detail / owner-collaborator message | Followed playlist; items 403 | Keep card; show metadata + Open in Spotify; do not invent tracks |
| Pre-create export failure | Matching/classify or create rejected before mutation | No Spotify playlist created; fix source playlist / reconnect |
| Post-create / partial export | Create succeeded; add batch failed or interrupted | Report shows partial counts + destination URL; do not retry blindly without reading job status |
| Callback error → Settings | State replay, mismatch, expired transaction, open-return attempt | Restart Connect from Settings; never paste callback URLs |
| Decrypt / misconfigured errors | Missing key, wrong version, non-32-byte key | Fix env; users must reconnect after key rotation |
| Android App Link does not open app | assetlinks / signing fingerprint / domain mismatch | Fix Digital Asset Links; ngrok is sandbox-only |

---

## 15. Extended Quota & release gate

- **Sandbox:** Development Mode, ≤5 users, Premium owner.
- **Public release:** Blocked until Spotify Extended Quota is approved for the production app.
- Cache duration, mixed-provider branding, and 20-item shelf + onward-link policy require explicit policy approval (12-11).
- Rollback: disable Client ID / unset `SPOTIFY_CLIENT_ID` in deployment to fail closed; disconnect existing users if token custody is compromised; rotate encryption key and force reconnect (§8).

### Incident response (short)

1. Revoke or rotate Spotify app credentials in Dashboard if leak suspected.
2. Rotate `SPOTIFY_TOKEN_ENCRYPTION_KEY` + version; force reconnect.
3. Confirm disconnect path deletes tokens + `user_spotify_playlists` + export jobs.
4. Check logs for accidental secret emission; scrub and rotate again if found.
5. Do not broaden scopes or enable Extended Quota without product/security approval.

---

## 16. Coverage & OPT-OUT reminder

Every Spotify capability disposition lives in [`COVERAGE.md`](../.planning/phases/12-spotify-api-integration/COVERAGE.md). Deferred/out-of-scope reminders include: Spotify playback deferred to **Phase 12.6**, no listening history, no saved-library→NIM import, no extra profile storage, no playlist item editing, no public playlist creation, no manual match override.

When changing endpoints or scopes, update COVERAGE.md and this runbook together so operators are never guessing against stale February 2026 facts.
