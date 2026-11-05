# Plan 012: Make Spotify connections finish, explain failures, and feed taste into song picks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c7eb9ff..HEAD -- server/services/spotifyService.js server/services/spotifyProfileService.js server/routes/spotify.js server/routes/spotify.test.js server/services/spotifyService.test.js server/services/spotifyProfileService.test.js server/.env.example client/src/app/settings/page.tsx client/src/components/SpotifyConnectionCard.tsx client/src/components/AndroidSpotifyReturn.tsx client/src/lib/spotifyContracts.ts client/src/lib/i18n.dictionary.ts mobile/lib/state/home_navigation_controller.dart mobile/lib/screens/settings_screen.dart mobile/lib/spotify/spotify_contracts.dart mobile/lib/widgets/spotify_connection_card.dart mobile/lib/utils/i18n.dart mobile/test/spotify_deep_link_test.dart docs/SPOTIFY-INTEGRATION.md`
> If any of these changed, compare the "Current state" excerpts with the live
> code. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (OAuth callback path; covered by existing route tests)
- **Depends on**: none. Ship after 006 if possible, because 006 also touches server dependencies.
- **Category**: bug / direction
- **Planned at**: commit `c7eb9ff`, 2026-11-05

## Why this matters

Spotify is meant to personalise song picks: `dailyWordService.getCuratedCandidatesForBatch` moves songs by a learner's top artists to the front. In production (checked 2026-11-05) it does nothing:

1. **The permission is never requested.** Production sets `SPOTIFY_SCOPES` to the eight playlist and playback scopes from `server/.env.example`. That env value *replaces* the code default, so `user-top-read` is never asked for. `/me/top/artists` fails and `user_spotify_profiles` has **0 rows**.
2. **Taste is never synced automatically.** `syncUserProfile` only runs from `POST /api/user/sync-spotify-profile` and an admin button.
3. **Failed sign-ins are invisible and strand Android users.** When Spotify sends the user back with `?error=access_denied` (they tapped Cancel) or without a code, the callback always redirects to the **web** error page, logs nothing, and leaves the transaction unconsumed. There are 6 unconsumed Android transactions (the latest on 2026-11-04) and only 1 completed Android connection, ever.
4. **Accounts that aren't allowlisted show as "Connected" but nothing works.** Spotify Development Mode allows **at most 5 allowlisted users**. Anyone else can approve the consent screen, but every API call returns 403. Today `fetchSpotifyProfile` swallows that 403 and the tokens are saved anyway. 2 of the 3 stored connections have `spotify_user_id = NULL`, which is the signature of this.

Spotify no longer grants Extended Quota to individuals (organisations with 250k+ monthly users only, since May 2025). So the 5-user cap is permanent for Harmonix. This plan makes Spotify work properly for those 5, and tells everyone else plainly instead of failing silently.

## Current state

### Server

- `server/services/spotifyService.js`
  - Lines 22-34: `DEFAULT_SCOPES` includes `'user-top-read'` and `'user-read-recently-played'`. Nothing reads recently-played; grep finds it only here.
  - Lines 36-42: `PLAYBACK_REQUIRED_SCOPES` (`streaming`, `user-read-email`, `user-read-private`, `user-modify-playback-state`, `user-read-playback-state`).
  - Lines 181-187:

    ```js
    function scopesFromEnv() {
      const raw = process.env.SPOTIFY_SCOPES;
      if (!raw || typeof raw !== 'string' || raw.trim() === '') {
        return DEFAULT_SCOPES;
      }
      return raw.trim().split(/[\s,]+/).filter(Boolean).join(' ');
    }
    ```

  - Lines 311-319: `parseScopeSet`, `missingPlaybackScopes`.
  - Lines 969-979: `fetchSpotifyProfile` returns `{ id: null, display_name: null }` when `!res.ok`, with no status.
  - Lines 981-1013: `completeAuthorization` consumes state, exchanges the code, calls `fetchSpotifyProfile`, then **always** `persistTokenRow(...)`. On error it sets `err.clientKind = consumed.clientKind` and rethrows.
  - `providerError(code, message, extra)` at line 158 is the error helper. Use it.
  - Module exports (lines 1080-1104) include `missingPlaybackScopes` and `PLAYBACK_REQUIRED_SCOPES`.
- `server/routes/spotify.js`
  - Lines 61-103: `GET /status` reads `scopes` from `user_spotify_tokens` and returns `{ status, display_name, reason, redirect_uri, client_id_prefix, playback_scopes_ok }`.
  - Lines 275-306: `GET /callback`. The error branch:

    ```js
    if (oauthError || !code || !state || typeof state !== 'string' || typeof code !== 'string') {
      // Attempt to resolve client kind from a non-consuming peek is unsafe; default web error URL.
      try {
        const url = oauth.resolveReturnUrl(clientKind, 'error');
        return res.redirect(302, url);
      ...
    ```

    In the success path, `completeAuthorization` returns `{ clientKind, successUrl }`.
  - `safeLog(label, err)` (lines 14-18) redacts tokens. The docs (`docs/SPOTIFY-INTEGRATION.md` §10) forbid logging tokens, codes, PKCE verifiers, raw `state`, or full callback query strings. Logging high-level error codes is allowed.
- `server/services/spotifyOAuthService.js`: `consumeOAuthTransaction({ state })` validates the hashed state and marks it consumed, then returns `{ userId, pkceVerifier, clientKind }`. It throws on an unknown, consumed, or expired state. `resolveReturnUrl(clientKind, 'error')` returns the fixed env URL (production Android: `https://harmonix.peeporunclub.co.uk/app/settings?spotify=error`).
- `server/services/spotifyProfileService.js`: `syncUserProfile(userId)` fetches `/me/top/artists` and `/me/top/tracks`, each in its own `try`. **Even if both fail, it upserts empty lists** and returns `synced: true`. `getUserMusicProfile(userId)` returns `{ top_genres, top_artists, last_synced_at }` or `null`. It requires `./spotifyService`, so `spotifyService.js` must **not** require `spotifyProfileService` (circular). Call it from the route layer instead.
- `server/index.js:367-375`: `/api/spotify/oauth` mounts the callback router. `/callback` is a 302 alias that keeps the query.

### Web (`client/`, Next.js 16; read `client/AGENTS.md` first)

- `client/src/app/settings/page.tsx`:
  - Line 56: `const callbackOutcome = parseSpotifyCallbackOutcome(searchParams.get('spotify'));`
  - Lines 164-172 clear the query with `router.replace('/settings', { scroll: false })`.
  - Line 174: `const recoveryMessage = callbackOutcome === 'error' ? t('spotify_auth_failed') : message;`
  - Lines 198-199: `if (dto.state === 'reconnect') { setMessage('Your Spotify connection expired. Reconnect to continue.'); }`
  - Line 638: `<SpotifyConnectionCard state=... message={recoveryMessage} ... />`
- `client/src/components/SpotifyConnectionCard.tsx`: props `state, displayName, message, onConnect, onReconnect, ...`. In the `connected` state it shows `t('spotify_connected_browse', ...)` and a "View library" link (lines 56-63).
- `client/src/lib/spotifyContracts.ts` lines 51-60 (`SpotifyConnectionDto`, which already has `playback_scopes_ok?`) and lines 259-276 (`parseSpotifyStatusResponse`). Tests are in `client/src/lib/spotifyContracts.test.ts` (node:test, run with `npm run test:spotify`).
- `client/src/components/AndroidSpotifyReturn.tsx` lines 11-21 build `intent://spotify-callback?spotify=${outcome}#Intent;scheme=harmonix;package=...;end` and drop every other query parameter.
- `client/src/lib/i18n.dictionary.ts` has six language blocks (en, es, fr, de, pt, it). `spotify_auth_failed` is at lines 666, 800, 934, 1068, 1202 and 1336.

### Android (`mobile/`, Flutter)

- `mobile/lib/state/home_navigation_controller.dart`:
  - Lines 59-67: `selectSettingsOnce({String? reason})` stores the reason only if `_isAllowlistedReason`.
  - Lines 82-97: the `harmonix://spotify-callback` branch calls `selectSettingsOnce(reason: 'error')`.
  - Lines 116-121: the HTTPS `/app/settings` branch, which does the same.
  - Lines 127-129: `_isAllowlistedReason` returns `reason == 'error'`.
- `mobile/lib/screens/settings_screen.dart`:
  - Lines 49-58: on a recovery reason, sets `_spotifyMessage = 'Spotify authorization didn’t finish. You can try connecting again.'` (hard-coded English).
  - Lines 81-86 show `spotify.reason` **raw** for `reconnect` states other than `authorization_expired`.
- `mobile/lib/spotify/spotify_contracts.dart` lines 59-81: `SpotifyConnectionStatus { state, displayName, reason }` and `parseSpotifyStatusResponse`.
- `mobile/lib/widgets/spotify_connection_card.dart`: mirrors the web card. `connected` shows `spotify_connected_browse`.
- `mobile/lib/utils/i18n.dart`: six maps in the same language order. `spotify_reconnect_body` is at lines 356, 444, 532, 620, 708 and 796.
- `mobile/test/spotify_deep_link_test.dart`: tests for `handleIncomingUri` / `consumeRecoveryReason`. Lines 100-117 expect `'error'` for both `spotify=error` and `spotify=cancelled`.

### Docs

- `docs/SPOTIFY-INTEGRATION.md` §3 (lines 80-95) says: "Do **not** request listening history". This is decision D-12-14 from Phase 12. Commit `4c037c1` later added `user-top-read` for personalisation without updating the doc. This plan updates the doc to match.
- `server/.env.example:49`: `SPOTIFY_SCOPES=` lists the eight scopes without `user-top-read`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Server tests | `cd server && npm test` | all pass |
| Spotify server subset | `cd server && NODE_ENV=test npx mocha services/spotifyService.test.js services/spotifyProfileService.test.js routes/spotify.test.js` | all pass |
| Web contract tests | `cd client && npm run test:spotify` | all pass |
| Web typecheck | `cd client && npx tsc --noEmit` | exit 0 |
| Flutter tests | `cd mobile && flutter test` | all pass |
| Flutter analyze | `cd mobile && flutter analyze --no-fatal-infos` | no errors |

## Scope

**In scope:**
- `server/services/spotifyService.js`, `server/services/spotifyProfileService.js`, `server/routes/spotify.js`
- `server/services/spotifyService.test.js`, `server/services/spotifyProfileService.test.js`, `server/routes/spotify.test.js`
- `server/.env.example`, `docs/SPOTIFY-INTEGRATION.md`
- `client/src/app/settings/page.tsx`, `client/src/components/SpotifyConnectionCard.tsx`, `client/src/components/AndroidSpotifyReturn.tsx`, `client/src/lib/spotifyContracts.ts`, `client/src/lib/spotifyContracts.test.ts`, `client/src/lib/i18n.dictionary.ts`
- `mobile/lib/state/home_navigation_controller.dart`, `mobile/lib/screens/settings_screen.dart`, `mobile/lib/spotify/spotify_contracts.dart`, `mobile/lib/widgets/spotify_connection_card.dart`, `mobile/lib/utils/i18n.dart`, `mobile/test/spotify_deep_link_test.dart`

**Out of scope:**
- `server/services/spotifyOAuthService.js`: reuse `consumeOAuthTransaction` as-is.
- Return URLs from the caller. They stay rejected. The only new thing is a server-chosen `reason` from a fixed allowlist, appended to the fixed env URL.
- `dailyWordService.js`: it already reads `getUserMusicProfile`. Don't change the ranking.
- Production env / Coolify settings. Step 1 makes the code request the needed scopes regardless of `SPOTIFY_SCOPES`.
- `mobile/pubspec.yaml` version. The owner bundles this into the next Android release.
- Spotify Developer Dashboard (the allowlist is an owner task; see Maintenance notes).

## Git workflow

- Branch: `advisor/012-spotify-connect-and-taste`
- Commit style: plain sentence, like `git log` (`Backup: switch the copy out of WAL so the read-only integrity check can open it`).
- Do NOT push.

## Steps

### Step 1: Always request the scopes the code depends on

In `server/services/spotifyService.js`:

- Remove `'user-read-recently-played'` from `DEFAULT_SCOPES` (unused, so least privilege).
- Add `const PERSONALIZATION_SCOPES = ['user-top-read'];` next to `PLAYBACK_REQUIRED_SCOPES`.
- Change `scopesFromEnv()` so it returns the env list (or `DEFAULT_SCOPES` when unset) **plus** any of `PLAYBACK_REQUIRED_SCOPES` and `PERSONALIZATION_SCOPES` that are missing. Keep it space-joined, deduplicated, with the env order first.
- Add `function missingPersonalizationScopes(grantedScopes)`, modelled on `missingPlaybackScopes`. Export it and `PERSONALIZATION_SCOPES` from the module's bottom `module.exports`.

Update `server/.env.example:49` to append ` user-top-read`.

**Verify**: add a test in `server/services/spotifyService.test.js`:
- With `SPOTIFY_SCOPES='playlist-read-private'`, `client.startAuthorization('svc-user-a', 'web')` returns an `authorizationUrl` whose `scope` search param contains `user-top-read` and `streaming`, and contains `playlist-read-private` exactly once.
- `missingPersonalizationScopes('playlist-read-private')` deep-equals `['user-top-read']`.

Then run `cd server && NODE_ENV=test npx mocha services/spotifyService.test.js` → all pass.

### Step 2: Don't save connections Spotify refuses (not allowlisted)

In `completeAuthorization`:
- Make `fetchSpotifyProfile` also return `status: res.status`.
- If `status === 403`, throw `providerError('spotify_not_allowlisted', 'Spotify account is not enabled for this app')` **before** `persistTokenRow`. The existing `catch` attaches `clientKind`.
- Other non-OK statuses keep today's behaviour (save with null id).

**Verify**: new test in `server/routes/spotify.test.js`, copying the fetch stub style of the test at lines 150-191:
- Stub `/api/token` OK and `/v1/me` with `{ ok: false, status: 403 }`.
- The callback should redirect to `SPOTIFY_WEB_ERROR_URL` with `reason=not_allowlisted` (see Step 3).
- No `user_spotify_tokens` row exists for `sp-route-a`.

### Step 3: Callback, so every outcome returns to the right app with a safe reason, and is logged

In `server/routes/spotify.js`:

```js
const CALLBACK_REASONS = new Set(['denied', 'not_allowlisted']);

function errorRedirectUrl(clientKind, reason) {
  const url = new URL(oauth.resolveReturnUrl(clientKind, 'error'));
  if (CALLBACK_REASONS.has(reason)) url.searchParams.set('reason', reason);
  return url.toString();
}

function safeSpotifyErrorCode(value) {
  return typeof value === 'string' && /^[a-z_]{1,40}$/.test(value) ? value : 'other';
}
```

Rewrite the callback branches:

1. **Spotify returned an error or no code, but a state is present**:
   - `try { clientKind = oauth.consumeOAuthTransaction({ state }).clientKind; } catch { /* unknown or expired: keep 'web' */ }`
   - This burns the transaction, so it can't linger.
   - Log `console.log(\`[spotify-callback] outcome=error client=${clientKind} spotify_error=${safeSpotifyErrorCode(oauthError)}\`)`.
   - Redirect to `errorRedirectUrl(clientKind, oauthError === 'access_denied' ? 'denied' : null)`.
   - Delete the old "non-consuming peek is unsafe" comment. Consuming isn't a peek, and the destinations are fixed config.
2. **No state at all**: keep today's behaviour (web error URL), plus the same log line with `client=unknown`.
3. **Success**: after `completeAuthorization` returns:
   - Log `[spotify-callback] outcome=connected client=${clientKind}`.
   - Start the taste refresh from Step 4 without awaiting: `spotifyProfile.refreshInBackground(result.userId, { force: true })`.
   - Then redirect as today.
4. **Catch block**:
   - Log `[spotify-callback] outcome=failed client=${clientKind} code=${safeSpotifyErrorCode(err && err.code)}`. Keep the existing `safeLog` call too.
   - Redirect to `errorRedirectUrl(clientKind, err && err.code === 'spotify_not_allowlisted' ? 'not_allowlisted' : null)`.

Never put `code`, `state`, or the raw query in a log line.

**Verify**: new tests in `server/routes/spotify.test.js`:
- An Android transaction plus `{ error: 'access_denied', state }` redirects to `SPOTIFY_ANDROID_ERROR_URL` plus `&reason=denied`. A second identical call redirects to the **web** error URL, because the state was consumed.
- `{ error: 'access_denied' }` with no state redirects to `SPOTIFY_WEB_ERROR_URL` exactly.
- The existing tests at lines 193-231 and 233-247 still pass unchanged. `errorRedirectUrl` with a null reason must return the env URL string unchanged.
- Captured `console.log` and `console.error` output never contains the state value. Capture `console.log` the same way the file captures `console.error` (lines 113-116), and restore it in `afterEach`.

### Step 4: Refresh taste automatically, and never overwrite good data with empty data

In `server/services/spotifyProfileService.js`:

- In `syncUserProfile`, if **both** Spotify requests failed (`topArtistsRes` and `topTracksRes` are null), return `{ synced: false, reason: 'spotify_error' }` and do **not** upsert.
- Add:

  ```js
  const STALE_MS = 7 * 24 * 60 * 60 * 1000;
  const RETRY_GAP_MS = 60 * 60 * 1000;
  const lastAttempt = new Map();

  function refreshInBackground(userId, { force = false, now = Date.now() } = {}) {
    if (!userId) return false;
    const tried = lastAttempt.get(userId);
    if (tried && now - tried < RETRY_GAP_MS) return false;
    if (!force) {
      const profile = getUserMusicProfile(userId);
      const synced = profile && Date.parse(profile.last_synced_at);
      if (synced && now - synced < STALE_MS) return false;
    }
    lastAttempt.set(userId, now);
    syncUserProfile(userId).catch((err) => {
      console.warn(`[SpotifyProfile] background sync failed for ${userId}: ${err && err.message}`);
    });
    return true;
  }
  ```

  Export `refreshInBackground`, plus `_resetRefreshAttemptsForTests: () => lastAttempt.clear()`.

In `GET /status` (`server/routes/spotify.js`), where the token row is already read:
- Compute `personalization_scopes_ok = Boolean(row) && spotifyService.missingPersonalizationScopes(row.scopes).length === 0`.
- Add it to the JSON.
- When `status.status === 'connected' && row && row.spotify_user_id == null`, respond with `status: 'reconnect_required', reason: 'not_allowlisted'`. This covers the 2 existing broken rows.
- When connected **and** `personalization_scopes_ok`, call `spotifyProfile.refreshInBackground(userId)` (no await).

Require `../services/spotifyProfileService` at the top of the route file.

**Verify**: tests in `server/services/spotifyProfileService.test.js`, stubbing `spotifyService` the same way as the existing test at lines 18-50:
- Both requests throw → `synced: false` and no row is written.
- `refreshInBackground` returns `true` the first time, then `false` on an immediate second call.
- With a fresh `last_synced_at` and `force: false` → `false`.

Tests in `server/routes/spotify.test.js`:
- `/status` for a row seeded with `'user-top-read'` scopes includes `personalization_scopes_ok: true`.
- The existing seed (scopes `'playlist-read-private'`) gives `false`.
- A row with `spotify_user_id` NULL gives `status: 'reconnect_required'` and `reason: 'not_allowlisted'`.

**Update the existing deep-equal at lines 137-146** to include `personalization_scopes_ok: false`.

Then run `cd server && npm test` → all pass.

### Step 5: Web, with clear messages and a personalisation nudge

1. **`client/src/lib/spotifyContracts.ts`**: add `personalization_scopes_ok?: boolean` to `SpotifyConnectionDto`, and parse it as `obj.personalization_scopes_ok === true`. Add a test in `spotifyContracts.test.ts` next to the existing `parseSpotifyStatusResponse` tests (line 226).
2. **`client/src/lib/i18n.dictionary.ts`**: add these keys to all six language blocks, next to `spotify_auth_failed`.

| key | en | es | fr | de | pt | it |
|---|---|---|---|---|---|---|
| `spotify_not_allowlisted` | Spotify only lets Harmonix connect invited accounts for now. Ask us to add your Spotify email, then connect again. | Por ahora Spotify solo permite a Harmonix conectar cuentas invitadas. Pídenos que añadamos tu correo de Spotify y vuelve a conectar. | Pour l’instant, Spotify ne permet à Harmonix de connecter que des comptes invités. Demandez-nous d’ajouter votre e-mail Spotify, puis reconnectez-vous. | Spotify erlaubt Harmonix derzeit nur eingeladene Konten. Bitte uns, deine Spotify-E-Mail hinzuzufügen, und verbinde dich dann erneut. | Por enquanto, o Spotify só permite que o Harmonix conecte contas convidadas. Peça para adicionarmos seu e-mail do Spotify e conecte de novo. | Per ora Spotify consente a Harmonix di collegare solo account invitati. Chiedici di aggiungere la tua email Spotify, poi collegati di nuovo. |
| `spotify_denied` | You cancelled the Spotify connection. Nothing was changed. | Cancelaste la conexión con Spotify. No se cambió nada. | Vous avez annulé la connexion Spotify. Rien n’a changé. | Du hast die Spotify-Verbindung abgebrochen. Nichts wurde geändert. | Você cancelou a conexão com o Spotify. Nada foi alterado. | Hai annullato il collegamento a Spotify. Non è cambiato nulla. |
| `spotify_personalize_body` | Reconnect Spotify so Harmonix can pick songs by the artists you play most. | Vuelve a conectar Spotify para que Harmonix elija canciones de los artistas que más escuchas. | Reconnectez Spotify pour que Harmonix choisisse des chansons des artistes que vous écoutez le plus. | Verbinde Spotify erneut, damit Harmonix Songs deiner meistgehörten Künstler auswählt. | Reconecte o Spotify para o Harmonix escolher músicas dos artistas que você mais ouve. | Ricollega Spotify così Harmonix sceglie canzoni degli artisti che ascolti di più. |
| `spotify_invite_only` | Spotify connections are invite-only while Harmonix is in testing. | Las conexiones con Spotify son solo por invitación mientras Harmonix está en pruebas. | Les connexions Spotify sont sur invitation pendant la phase de test de Harmonix. | Spotify-Verbindungen sind nur auf Einladung möglich, solange Harmonix getestet wird. | As conexões com o Spotify são só por convite enquanto o Harmonix está em testes. | I collegamenti a Spotify sono solo su invito mentre Harmonix è in fase di test. |

3. **`client/src/app/settings/page.tsx`**:
   - Read `const callbackReason = searchParams.get('reason');` next to line 56.
   - `recoveryMessage` becomes `t('spotify_denied')` when the reason is `'denied'`, `t('spotify_not_allowlisted')` when it is `'not_allowlisted'`, and otherwise `t('spotify_auth_failed')`.
   - At lines 198-199, when `dto.reason === 'not_allowlisted'`, use `t('spotify_not_allowlisted')`. Otherwise use `t('spotify_reconnect_body')`, replacing the hard-coded English.
   - Keep `personalization_scopes_ok` in state and pass `personalizationNeeded={state === 'connected' && personalizationScopesOk === false}` to the card.
4. **`client/src/components/SpotifyConnectionCard.tsx`**:
   - Add an optional `personalizationNeeded?: boolean` prop. When it's true in the `connected` state, render `t('spotify_personalize_body')` and a secondary button labelled `t('reconnect_spotify')` that calls `onReconnect ?? onConnect`.
   - In the `connect` (default) and `disconnected` states, add `t('spotify_invite_only')` as a second muted line under the body. Match the existing muted text classes in this file.
5. **`client/src/components/AndroidSpotifyReturn.tsx`**: when the outcome is `error`/`cancelled` and `reason` is `denied` or `not_allowlisted`, append `&reason=${reason}` to the `intent://` URL. Ignore any other value.

**Verify**: `cd client && npm run test:spotify` → all pass. `cd client && npx tsc --noEmit` → exit 0.

### Step 6: Android, same messages

1. **`mobile/lib/state/home_navigation_controller.dart`**:
   - In both Settings branches (lines 90-95 and 116-121), pass `reason: uri.queryParameters['reason'] ?? 'error'`.
   - Change `_isAllowlistedReason` to accept `'error'`, `'denied'` and `'not_allowlisted'`.
   - In `selectSettingsOnce`, when the given reason is not allowlisted, store `'error'` instead of nothing, so a recovery message still shows.
2. **`mobile/lib/spotify/spotify_contracts.dart`**: add `final bool personalizationScopesOk;` (default `false`) and parse `raw['personalization_scopes_ok'] == true`.
3. **`mobile/lib/utils/i18n.dart`**: add the same four keys with the same strings to all six maps, next to `spotify_reconnect_body`, plus `spotify_auth_failed` (see item 4).
4. **`mobile/lib/screens/settings_screen.dart`**:
   - Lines 49-58: map the reason to `context.tr('spotify_denied')`, `context.tr('spotify_not_allowlisted')`, or `context.tr('spotify_auth_failed')`. `spotify_auth_failed` does **not** exist in the Dart map today, so add it to all six maps with the same strings as the web dictionary (`client/src/lib/i18n.dictionary.ts` lines 666, 800, 934, 1068, 1202, 1336).
   - Lines 81-86: never show `spotify.reason` raw. Use `not_allowlisted` → `context.tr('spotify_not_allowlisted')`, otherwise `context.tr('spotify_reconnect_body')`.
   - Store `spotify.personalizationScopesOk` and pass it to the card.
5. **`mobile/lib/widgets/spotify_connection_card.dart`**: add `this.personalizationNeeded = false`. Mirror the web card: the personalise body and Reconnect button when connected, and the `spotify_invite_only` line in the connect and disconnected states.
6. **`mobile/test/spotify_deep_link_test.dart`**: add tests.
   - `harmonix://spotify-callback?spotify=error&reason=denied` → `consumeRecoveryReason() == 'denied'`.
   - `https://<approved>/app/settings?spotify=error&reason=evil` → `'error'`.
   - Keep the existing expectations at lines 100-117 passing.

**Verify**: `cd mobile && flutter test` → all pass. `cd mobile && flutter analyze --no-fatal-infos` → no errors.

### Step 7: Docs

In `docs/SPOTIFY-INTEGRATION.md`:
- §3: list `user-top-read`. Replace "Do **not** request listening history…" with:
  - Harmonix requests `user-top-read` only to rank song suggestions by the learner's top artists; it is cached in `user_spotify_profiles`, never sent to AI, and deleted on disconnect.
  - Do not request `user-read-recently-played`, library save, or `playlist-modify-public`.
- §1 table, `SPOTIFY_SCOPES` row: "Code always adds playback and `user-top-read` scopes."
- §14 Troubleshooting: add the row "Settings says invited accounts only | Spotify 403 on `/me` (not on the Development Mode allowlist) | Add the user's Spotify email in Dashboard → User Management (max 5), then they Reconnect". Add a second row: "Find callback outcomes | `docker logs api-… \| grep spotify-callback` (archived logs under `/home/ubuntu/logs/harmonix` once plan 011 lands)".
- §15.1 Requested Scopes: add `user-top-read`.

**Verify**: `grep -n "user-top-read" docs/SPOTIFY-INTEGRATION.md` → at least 3 matches.

**Disconnect must delete the cached taste.** Today `disconnectUser` (`spotifyService.js` lines 1015-1046) does not touch `user_spotify_profiles`; the only reference is the upsert in `spotifyProfileService.js`. Add `db.prepare('DELETE FROM user_spotify_profiles WHERE user_id = ?').run(userId);` inside the transaction, next to `deletePlaylists.run(userId)`. The table always exists (`server/db.js:60`), so no `try` is needed. In the existing disconnect test in `server/routes/spotify.test.js` (line 249), insert a profile row for `sp-route-a` and assert it's gone after disconnect.

**Verify**: `cd server && NODE_ENV=test npx mocha routes/spotify.test.js` → all pass.

## Test plan

- **Server** (mocha + chai, patterned on `server/routes/spotify.test.js`), new tests for:
  - Scope union (Step 1).
  - A 403 on `/me` saves no tokens and redirects with `not_allowlisted` (Step 2).
  - Denied on Android goes back to Android with `reason=denied` and the transaction is burned; no state goes to web; logs contain no state (Step 3).
  - Sync doesn't overwrite on total failure; background refresh dedupe and staleness (Step 4).
  - `/status` personalization flag and the `not_allowlisted` mapping (Step 4).
  - Disconnect clears the profile (Step 7).
- **Web**: `parseSpotifyStatusResponse` keeps `personalization_scopes_ok`.
- **Flutter**: reason handling in the deep-link controller.
- Run `cd server && npm test`, `cd client && npm run test:spotify && npx tsc --noEmit`, and `cd mobile && flutter test`. All pass.

## Done criteria

- [ ] `cd server && npm test` exits 0 with the new tests present.
- [ ] `cd client && npm run test:spotify` exits 0, and `npx tsc --noEmit` exits 0.
- [ ] `cd mobile && flutter test` exits 0, and `flutter analyze --no-fatal-infos` reports no errors.
- [ ] `grep -n "non-consuming peek is unsafe" server/routes/spotify.js` → no matches.
- [ ] `grep -n "user-read-recently-played" server/services/spotifyService.js` → no matches.
- [ ] `grep -c "spotify_not_allowlisted" client/src/lib/i18n.dictionary.ts mobile/lib/utils/i18n.dart` → 6 in each.
- [ ] `grep -rn "spotify.reason ??" mobile/lib/screens/settings_screen.dart` → no matches.
- [ ] `git status` shows only in-scope files modified.
- [ ] `plans/README.md` row for 012 updated.

## STOP conditions

- The callback code or `completeAuthorization` doesn't match the excerpts above.
- An existing Spotify route test (lines 150-247 of `server/routes/spotify.test.js`) needs its **expected redirect URL** changed to pass. That means the null-reason path altered the URL. Fix `errorRedirectUrl`, don't edit the test.
- You'd need to require `spotifyProfileService` from `spotifyService.js` (circular import).
- Flutter `i18n.dart` or web `i18n.dictionary.ts` has a key-parity test that fails and the fix isn't simply adding the missing key.
- You find that Spotify's `error` values include something other than lowercase/underscore codes in the existing tests. Report it, don't widen the regex.

## Maintenance notes

- **Owner actions (no code):**
  1. Make sure the Spotify Developer account that owns the app has Premium; the app stops working without it.
  2. In Dashboard → User Management, allowlist up to 5 testers' Spotify emails. Pick the most active learners.
  3. After deploy, the 3 existing connections should press Reconnect. The 2 with no Spotify id will see the invited-accounts message; the one working connection will see the personalise prompt because it lacks `user-top-read`.
- **The 5-user ceiling is permanent.** Spotify grants Extended Quota only to registered organisations with 250k+ monthly users. Don't build features that need Spotify for most learners. If taste-based picks matter for everyone, a "pick 3 favourite artists" step that writes the same `top_artists` shape is the scalable route (not planned; see `plans/README.md`).
- If plan 007 (usage events) has landed, a reviewer may want `recordEvent('spotify_connect', …)` on the callback outcomes. That needs `spotify_connect` added to 007's `EVENT_NAMES` allowlist, so do it as a follow-up, not here.
- Reviewers should check that no log line includes `state`, `code`, or the query string, and that `reason` only ever comes from `CALLBACK_REASONS`.
- `refreshInBackground` keeps attempts in memory, so a restart allows one immediate retry per user. That's fine at this scale; revisit if there are multiple API replicas.
