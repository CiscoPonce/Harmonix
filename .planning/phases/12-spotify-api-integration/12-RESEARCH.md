# Phase 12: Spotify API Integration - Research

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Account Linking Is the Priority
- **D-12-01:** Use Spotify Authorization Code with PKCE and validate OAuth state.
- **D-12-02:** Spotify account linking and management live in **Settings**, not Library.
- **D-12-03:** Place a prominent Spotify connection card directly below the user profile. It must clearly represent Connect, Connected, Reconnect, and Disconnect states.
- **D-12-04:** After successful linking, automatically open Library and load the user's Spotify playlists.
- **D-12-05:** Disconnecting immediately deletes stored Spotify tokens.

### Library and Playlist Presentation
- **D-12-06:** Follow the designer Library reference: playlist cards first, followed by song rows under **Recent Discoveries**.
- **D-12-07:** Do not place the primary Connect Spotify button in Library; connection belongs in Settings.
- **D-12-08:** Spotify and Harmonix playlists must be visually polished, clearly source-labelled, and linked using stable provider identifiers so every card opens the correct record.
- **D-12-09:** Tapping a Spotify playlist opens an in-app playlist detail showing its songs, with an **Open in Spotify** action.
- **D-12-10:** Preserve the Phase 10 light/green visual system and four-tab navigation: Discover, Library, Learn, Settings.

### Backend, Storage, and Matching
- **D-12-11:** Store access and refresh tokens encrypted in `user_spotify_tokens`; refresh access automatically before expiry and retain the latest rotated refresh token.
- **D-12-12:** Reuse `song_cache` and persist matched Spotify URIs rather than duplicating song records.
- **D-12-13:** Match by artist and track title, select the best result, cache its Spotify URI, and return successful and unmatched tracks in an export report.
- **D-12-14:** Request only playlist read/write scopes needed by the feature.
- **D-12-15:** Apply per-user Spotify rate limiting, retry 429 responses with backoff, and require a network connection for playlist synchronization.

### Claude's Discretion
- Choose whether the Library uses one unified playlist section or visually separated provider groups. Optimize for the designer reference, clarity, and minimal clutter.
- Choose the exact source badge/icon treatment and spacing, provided Spotify and Harmonix items remain unmistakable.
- Define polished loading, empty, expired-session, and provider-error states using existing app patterns.

### Deferred Ideas (OUT OF SCOPE)
- Import Spotify playlists into Harmonix learning and vocabulary extraction.
- Analyze Spotify listening history for personalization.
- Automatically maintain a Spotify playlist for daily words.
- Full-song streaming remains prohibited; Harmonix continues to limit previews to 30 seconds.
</user_constraints>

**Researched:** 2026-07-19  
**Domain:** Spotify OAuth 2.0 PKCE, Web API playlists, cross-platform callback routing, secure token custody, catalog matching  
**Confidence:** MEDIUM — current official Spotify, Flutter, Android, Next.js, and OWASP sources were checked, but no live Spotify developer application or credentials were available.

## Summary

Phase 12 should be planned as a backend-owned integration. Both clients should start an authenticated Express endpoint; Express should generate a one-time OAuth transaction containing the Harmonix user binding, a cryptographic `state`, and a PKCE verifier, then receive Spotify's single exact HTTPS callback and exchange the code. Spotify tokens must never enter Next.js, Flutter, a query string, or browser storage. This fits the existing architecture in which Express/SQLite is the source of truth for both clients. [VERIFIED: codebase] [CITED: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet]

Spotify's current platform constraints materially affect the plan. Development Mode now requires a Premium app owner, permits at most five allowlisted authenticated users, and is not a production launch mode. The February 2026 API uses `/me/playlists`, `/me/playlists` creation, and `/playlists/{id}/items`; legacy `/tracks` playlist paths are removed. Most importantly, playlist-item detail is now available only for playlists the current user owns or collaborates on even though `/me/playlists` lists owned **and followed** playlists. [CITED: https://developer.spotify.com/documentation/web-api/concepts/quota-modes] [CITED: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide] [CITED: https://developer.spotify.com/documentation/web-api/reference/get-playlists-items]

The export path should be validation-first: normalize each Harmonix song, reuse a fresh cached Spotify URI when available, otherwise perform one market-aware track search, rank the returned candidates deterministically, reject ambiguous results, then create a private Spotify playlist and add only accepted URIs in batches of at most 100. The report must preserve one outcome per source song and distinguish matched, unmatched, cached, and export-failed states. Search now defaults to five and caps at ten results, so accuracy must come from scoring and rejection rather than broad result harvesting. [CITED: https://developer.spotify.com/documentation/web-api/reference/search] [CITED: https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist]

**Primary recommendation:** Build one provider-neutral Library contract over an Express `spotifyService`, but keep Spotify playlists in a visually separated, attributed group and keep OAuth, token refresh, rate control, matching, and export orchestration entirely on the backend.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Start account linking | API / Backend | Browser / Flutter | The authenticated backend must bind the Harmonix user to a one-time OAuth transaction; clients only launch the returned authorization URL. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet] |
| Spotify callback and token exchange | API / Backend | — | The callback arrives without the Harmonix bearer token, so validated server-held state must recover the user and PKCE verifier. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow] |
| Token encryption and refresh | API / Backend | Database / Storage | Clients must never receive Spotify tokens; encrypted rows are refreshed before expiry and replaced atomically. [VERIFIED: codebase] |
| Connection status and disconnect | API / Backend | Frontend clients | Express owns connection state and deletion; Settings renders Connect, Connected, Reconnect, and Disconnect. [VERIFIED: CONTEXT.md] |
| Playlist synchronization | API / Backend | Database / Storage | The backend paginates Spotify, normalizes provider data, applies rate limits, and returns a stable client contract. [CITED: https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists] |
| Library composition | Frontend clients | API / Backend | Next.js and Flutter preserve their native UI patterns while consuming the same provider-aware DTO. [VERIFIED: codebase] |
| Playlist detail and Spotify deep link | API / Backend | Frontend clients | Backend enforces ownership/provider rules; clients render tracks and open the official `external_urls.spotify` link. [CITED: https://developer.spotify.com/documentation/design] |
| Track matching and export | API / Backend | Database / Storage | Matching requires provider calls, deterministic scoring, cache policy, and partial-failure handling. [CITED: https://developer.spotify.com/documentation/web-api/reference/search] |
| Android post-link routing | Browser / Flutter | API / Backend | Spotify returns to HTTPS; the backend completion page then routes to a verified Harmonix App Link, and Flutter selects Library. [CITED: https://developer.spotify.com/documentation/web-api/concepts/redirect_uri] [CITED: https://developer.android.com/training/app-links/about] |

## Project Constraints (from project instructions and nested rules)

- Preserve Express + SQLite as the shared backend and keep both Next.js and Flutter behind `/api/*`. [VERIFIED: CLAUDE.md] [VERIFIED: STATE.md]
- Validate provider results before persistence or export; do not turn a weak search result into a match. [VERIFIED: CLAUDE.md]
- Do not add full-song playback. Existing Harmonix audio remains limited to validated 30-second Deezer previews. [VERIFIED: CLAUDE.md] [VERIFIED: REQUIREMENTS.md]
- Add tests for new behavior and bugs, and keep `.planning/` documentation current. [VERIFIED: CLAUDE.md]
- Preserve the Phase 10 light/green Flutter design and the four tabs. [VERIFIED: 10-UI-SPEC.md]
- For Next.js 16.2.9, inspect installed-version documentation and heed deprecations before implementation; the installed package does not contain the expected `dist/docs` tree, so use current official Next.js 16 documentation during execution. [VERIFIED: client/AGENTS.md] [VERIFIED: codebase]
- No `.cursor/rules/` directory exists; there are no additional workspace rule files to apply. [VERIFIED: codebase]

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Why Standard Here |
|-------------------|---------|---------|-------------------|
| Node.js built-in `fetch`, `crypto`, `URLSearchParams` | Node 24.13.0 | Spotify HTTP calls, PKCE, random state, SHA-256, AES-256-GCM | Already available; avoids an unnecessary OAuth wrapper and avoids hand-rolled cryptographic primitives. [VERIFIED: environment] |
| Express | 4.19.2 installed | Authenticated Spotify routes and unauthenticated validated callback | Existing routing/auth boundary. [VERIFIED: server/package.json] |
| better-sqlite3 | 11.x installed | OAuth transactions, encrypted tokens, match cache metadata | Existing synchronous database and migration pattern. [VERIFIED: server/package.json] |
| Next.js / React | Next 16.2.9, React 19.2.4 | Web Settings, Library, detail, export report | Existing web frontend. [VERIFIED: client/package.json] |
| Flutter / Dart | Flutter 3.44.6, Dart 3.12.2 | Android Settings, Library, detail, callback routing | Existing Android frontend. [VERIFIED: environment] |
| `url_launcher` | 6.3.1 declared | Open Spotify authorization and content deep links | Already present in Flutter and used by playlist detail. [VERIFIED: mobile/pubspec.yaml] [VERIFIED: codebase] |

### Supporting

| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| Mocha + Chai | Mocha 11.7.6, Chai 6.2.2 | Backend service/route tests with injected HTTP fakes | Every OAuth, refresh, pagination, matching, and export branch. [VERIFIED: server/package.json] |
| `flutter_test` | Flutter SDK 3.44.6 | API-client parsing, Settings/Library states, callback routing widgets | Mobile state and navigation tests. [VERIFIED: mobile/pubspec.yaml] |
| Next.js ESLint/build checks | Next 16.2.9 | Web type/build verification | Web phase gate until a browser test framework is deliberately added. [VERIFIED: client/package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `fetch` + small `spotifyService` | Third-party Spotify SDK | No SDK is required for the small endpoint set; adding one introduces release lag risk around the February 2026 endpoint renames. Use native fetch and explicit DTOs. [CITED: https://developer.spotify.com/documentation/web-api/references/changes/february-2026] |
| Backend-owned callback | Separate callbacks in Next.js and Flutter | Harmonix selects one exact HTTPS backend callback so tokens remain server-side and both clients share one transaction boundary. Spotify currently still supports qualifying custom schemes, while recommending HTTPS and Android App Links where possible; this is a Harmonix security architecture choice, not a claim that Spotify forbids custom schemes. [CITED: https://developer.spotify.com/documentation/web-api/concepts/redirect_uri] [CITED: https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify] |
| Verified Android App Link | Custom URI scheme | Harmonix selects a verified App Link for the secret-free post-callback Android return because it proves domain ownership and supports cold/warm routing. No custom-scheme fallback is part of the Phase 12 release contract. [CITED: https://developer.android.com/training/app-links/about] |

**Installation:** No new npm or Dart package is required for the recommended implementation. Use existing dependencies and Node built-ins. [VERIFIED: codebase]

## Package Legitimacy Audit

No external package installation is recommended, so the package-legitimacy gate does not apply. [VERIFIED: research recommendation]

## Architecture Patterns

### System Architecture Diagram

```text
Settings (Next.js or Flutter)
        |
        | authenticated POST /api/spotify/auth/start { client: web|android }
        v
Express OAuth transaction service
  - random one-time state
  - PKCE verifier/challenge
  - user_id + allowlisted return target
  - short expiry
        |
        | 302 to accounts.spotify.com/authorize
        v
Spotify consent
        |
        | exact HTTPS /api/spotify/oauth/callback?code&state
        v
Express callback
  ├─ invalid/expired/replayed state -> safe error page -> Settings/Reconnect
  └─ valid state -> token exchange -> encrypt -> atomic upsert
                                      |
                       ┌──────────────┴──────────────┐
                       v                             v
                Web /playlists              Android App Link
                       |                             |
                       └──────────────┬──────────────┘
                                      v
                              Library refresh
                                      |
                           GET /api/spotify/playlists
                                      |
                  rate gate -> token refresh -> Spotify /me/playlists
                                      |
                  provider DTOs -> separated attributed playlist groups

Harmonix playlist -> POST /api/spotify/exports
        |
        v
load source songs -> fresh URI cache?
        | no
        v
market-aware Spotify search -> deterministic score -> confidence gate
        ├─ reject -> unmatched report entry
        └─ accept -> time-limited URI cache
        |
        v
create private Spotify playlist -> add URI batches (<=100) -> match/export report
```

The primary use case crosses an external OAuth boundary twice but stores credentials only in the backend. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow]

### Recommended Project Structure

```text
server/
├── routes/spotify.js                 # status, start, callback, disconnect, playlists, detail, export
├── services/spotifyService.js        # token lifecycle and typed Web API wrapper
├── services/spotifyOAuthService.js   # PKCE/state transaction lifecycle
├── services/spotifyMatchService.js   # normalization, scoring, confidence gate
├── services/spotifyCrypto.js         # AES-GCM envelope using Node crypto
└── routes|services/*.test.js         # injected-fetch route/service tests
client/src/
├── app/settings/page.tsx             # new prominent connection card
├── app/playlists/page.tsx            # provider-aware Library composition
├── app/playlists/[id]/page.tsx       # provider-aware detail
└── components/Spotify*.tsx           # status and export report UI
mobile/lib/
├── screens/settings_screen.dart      # connection card below profile
├── screens/library_screen.dart       # separated provider groups
├── screens/playlist_detail_screen.dart
├── screens/home_shell.dart           # externally set selected tab
└── services/api_client.dart          # Spotify backend calls only
```

This file mapping extends existing integration points rather than replacing them. [VERIFIED: codebase]

### Pattern 1: Backend-For-Frontend OAuth Transaction

**What:** Store a short-lived one-time OAuth transaction server-side. Persist only a hash of `state`; bind it to `user_id`, PKCE verifier, fixed client kind, fixed return path, creation/expiry, and consumed timestamp. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet]

**When to use:** Every Connect/Reconnect attempt from either client.

**Required behavior:**
- Generate at least 32 random bytes for `state`; compare the hash, reject missing/expired/consumed state, and consume it atomically before token persistence. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet]
- Generate a 43–128 character verifier and S256 challenge. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow]
- Never accept arbitrary callback return URLs; map `web` and `android` to server configuration. [ASSUMED]
- Never include Spotify access/refresh tokens in a client response, redirect, log, or analytics payload. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html]

### Pattern 2: Encrypted Token Envelope with Atomic Refresh

**What:** Store AES-256-GCM ciphertext, unique 96-bit IV, authentication tag, and key version for access and refresh tokens. Keep the 32-byte encryption key outside SQLite and source control. [ASSUMED]

**When to use:** Initial token upsert and every refresh-token rotation.

**Required behavior:**
- Refresh when `expires_at` is within a safety window, such as 60 seconds. [ASSUMED]
- Serialize refresh per user so simultaneous playlist/detail calls do not race and overwrite a rotated refresh token. [ASSUMED]
- If Spotify returns a new `refresh_token`, replace it; if omitted, retain the current one. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens]
- On `invalid_grant`, delete tokens and return a reconnect-required provider error; do not retry. [CITED: https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration]
- Track `authorized_at`: Spotify refresh tokens now expire six months from original authorization, and refresh does not extend that lifetime. Enforcement for existing apps starts 2026-07-20. [CITED: https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration]

### Pattern 3: Provider-Aware Stable IDs

**What:** Return client IDs as `{provider}:{providerId}`, for example `spotify:37i9...` and `harmonix:abc123`, while retaining separate `provider` and `provider_id` fields. [ASSUMED]

**When to use:** Library lists, routes, detail fetches, cache keys, and widget keys.

**Why:** Existing local IDs and Spotify IDs occupy unrelated namespaces; a provider discriminator prevents the wrong detail endpoint from opening. [VERIFIED: codebase]

### Pattern 4: Deterministic, Rejectable Match Pipeline

**What:** One pure scoring function ranks no more than ten current search candidates, followed by a hard acceptance gate.

**Recommended score inputs:**
1. Exact normalized title after conservative removal of `feat.`, bracketed edition labels, and punctuation. [ASSUMED]
2. Exact or token-complete primary/all-artist match. [ASSUMED]
3. ISRC equality when source metadata has an ISRC; Spotify supports `isrc:` search. [CITED: https://developer.spotify.com/documentation/web-api/reference/search]
4. Duration closeness where source duration is available. [ASSUMED]
5. Candidate is not local, is available/relinked for the user's market, and has a valid `spotify:track:` URI. [CITED: https://developer.spotify.com/documentation/web-api/concepts/track-relinking]

Reject ties, edition conflicts, missing artist/title, local tracks, unavailable tracks, and candidates below threshold. Do not use popularity as a correctness substitute. [ASSUMED]

### Pattern 5: Policy-Bounded Cache

**What:** Add nullable Spotify match fields to `song_cache`, not a duplicate song table: URI, canonical matched title/artist/ISRC, score/reason, `spotify_matched_at`, and `spotify_expires_at`. [VERIFIED: CONTEXT.md] [ASSUMED]

**When to use:** Before each export search.

Spotify permits only strictly necessary temporary caching, requires current displayed data, and says not to store Spotify Content indefinitely. Therefore a persisted URI needs an expiry/revalidation policy and disconnect/termination cleanup. A seven-day URI TTL aligns with the existing song-cache default but is not specified by Spotify and requires product/legal confirmation. [CITED: https://developer.spotify.com/terms] [VERIFIED: codebase] [ASSUMED]

### Pattern 6: Rate-Aware Provider Wrapper

**What:** All Spotify calls pass through one wrapper that performs token refresh, timeout/abort, response mapping, per-user admission control, and `Retry-After` handling.

**When to use:** Every Spotify endpoint.

Spotify's rate limit is app-wide over a rolling 30-second window, while D-12-15 additionally requires per-user limiting. Keep matching concurrency low, stop immediately on `429`, wait the exact `Retry-After` seconds with small jitter, cap retries, and propagate a structured retryable error. [CITED: https://developer.spotify.com/documentation/web-api/concepts/rate-limits] [VERIFIED: CONTEXT.md] [ASSUMED]

### Provider-Neutral API Contract

Recommended endpoints:

```text
GET    /api/spotify/status
POST   /api/spotify/auth/start
GET    /api/spotify/oauth/callback       # public route; state validation is mandatory
DELETE /api/spotify/connection
GET    /api/spotify/playlists
GET    /api/spotify/playlists/:id
POST   /api/spotify/exports
```

The callback is the only route not protected by the Harmonix JWT; its one-time state transaction is its authorization boundary. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow]

### UI Composition Recommendation

Use visually separated `Harmonix Playlists` and `Spotify Playlists` groups within the single playlist-first area, followed by the unchanged `Recent Discoveries` rows. Add a compact official Spotify icon/source label to each Spotify card and an `Open in Spotify` action in detail. This best reconciles the designer composition with Spotify's attribution and deep-link rules and avoids visually mixing Spotify content directly with content from another music provider. [CITED: https://developer.spotify.com/documentation/design]

Settings remains the only primary Connect/Reconnect/Disconnect surface. Library shows a compact provider-unavailable state with a Settings link, not a primary Connect button. [VERIFIED: CONTEXT.md]

### Anti-Patterns to Avoid

- **Client-side Spotify tokens:** violates the backend source-of-truth decision and expands XSS/device exposure. [VERIFIED: CONTEXT.md] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html]
- **Platform-specific Spotify callbacks:** Spotify currently supports qualifying custom schemes, but Harmonix deliberately uses one exact HTTPS backend callback so client apps never receive authorization codes or tokens. [CITED: https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify]
- **Legacy playlist paths:** `/users/{id}/playlists` and `/playlists/{id}/tracks` are removed for current Development Mode; use `/me/playlists` and `/items`. [CITED: https://developer.spotify.com/documentation/web-api/references/changes/february-2026]
- **Treating every followed playlist as detail-readable:** current item detail returns 403 unless the user owns or collaborates on the playlist. [CITED: https://developer.spotify.com/documentation/web-api/reference/get-playlists-items]
- **Forced best match:** “best candidate” is not necessarily a valid match; ambiguous candidates belong in `unmatched`. [ASSUMED]
- **Indefinite Spotify metadata cache:** conflicts with the Developer Terms. [CITED: https://developer.spotify.com/terms]
- **Sending Spotify content into NVIDIA NIM:** Spotify policy prohibits ingesting Spotify Content into AI/ML models. [CITED: https://developer.spotify.com/policy]
- **Logging OAuth callback URLs or token bodies:** authorization codes, state, and tokens must be redacted. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Randomness, hashing, encryption | Custom PRNG, hash, or cipher | Node `crypto.randomBytes`, `createHash('sha256')`, `createCipheriv('aes-256-gcm')` | Cryptographic primitives must be standard and authenticated. [ASSUMED] |
| OAuth CSRF binding | User ID in callback query or unsigned return URL | One-time server-side state transaction + PKCE | Prevents login CSRF, code interception, replay, and open redirects. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet] |
| Spotify deep-link construction | Concatenated `spotify:` or web URLs from user input | API-provided `external_urls.spotify` and URI fields | Official links preserve correct records and attribution. [CITED: https://developer.spotify.com/documentation/design] |
| Pagination | A single request | Follow normalized `next`/offset pages with hard limits | `/me/playlists` and item detail are paginated. [CITED: https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists] |
| Rate recovery | Blind exponential retries | Honor `Retry-After`, cap attempts, and reduce calls | Spotify specifies `Retry-After` for 429 handling. [CITED: https://developer.spotify.com/documentation/web-api/concepts/rate-limits] |
| Candidate acceptance | “Take result zero” | Deterministic score plus rejection threshold and test corpus | Search result ordering does not prove identity. [ASSUMED] |

**Key insight:** The difficult work is not HTTP syntax; it is preserving user binding, token custody, current API semantics, market-aware identity, policy-bounded caching, and honest partial-failure reports.

## Common Pitfalls

### Pitfall 1: Planning for the Pre-February-2026 API
**What goes wrong:** Calls use `/playlists/{id}/tracks` or `/users/{id}/playlists`, expect old fields, or request more than ten search results.  
**Why it happens:** Older SDKs/examples predate the Development Mode migration.  
**How to avoid:** Use `/me/playlists`, `/playlists/{id}/items`, and search `limit <= 10`; parse missing/null fields defensively. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide]  
**Warning signs:** 404/403 responses, missing `tracks`, or search validation errors.

### Pitfall 2: Assuming Development Mode Is a Launch Configuration
**What goes wrong:** More than five users cannot connect, non-allowlisted users fail, or the owner lacks Premium.  
**Why it happens:** New apps start in a restricted sandbox.  
**How to avoid:** Put Spotify app creation, owner Premium verification, five-user allowlist testing, and extended-quota go/no-go before public release. [CITED: https://developer.spotify.com/documentation/web-api/concepts/quota-modes]  
**Warning signs:** OAuth succeeds only for the developer or a small allowlist.

### Pitfall 3: Callback Loses the Harmonix User
**What goes wrong:** The callback has no app JWT and tokens are attached to the wrong account.  
**Why it happens:** The external browser does not preserve Flutter's bearer header.  
**How to avoid:** Recover the user only from a validated, one-time, server-side OAuth transaction. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow]  
**Warning signs:** Callback accepts `user_id`, `return_to`, or provider ID from query parameters.

### Pitfall 4: Refresh Races Lose Rotated Tokens
**What goes wrong:** Two requests refresh simultaneously and the older completion overwrites the newer refresh token.  
**Why it happens:** Token refresh is treated as a stateless helper.  
**How to avoid:** Serialize refresh per user and atomically retain the newest returned refresh token. [ASSUMED]  
**Warning signs:** Intermittent `invalid_grant` immediately after otherwise successful refreshes.

### Pitfall 5: Six-Month Refresh Expiry Is Treated as a Transient Error
**What goes wrong:** The backend repeatedly retries an expired token and clients show generic provider failure.  
**Why it happens:** Historically refresh tokens were often modeled as indefinite.  
**How to avoid:** On `invalid_grant`, delete the token row and return `reconnect_required`; show the Reconnect card state. [CITED: https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration]  
**Warning signs:** Repeated 400 token responses or refresh rows older than six months.

### Pitfall 6: Followed Playlist Cards Cannot Open Detail
**What goes wrong:** `/me/playlists` lists a followed playlist, but item detail returns 403.  
**Why it happens:** The current detail endpoint is owner/collaborator-only.  
**How to avoid:** Keep followed playlists visible. Their card opens a restricted in-app detail DTO populated from the normalized `/me/playlists` record (or a fresh `GET /playlists/{id}` metadata response when permitted), explains that item detail is unavailable, and exposes only the API-provided `external_urls.spotify` onward action. Direct restricted access must never be represented as an empty list. [CITED: https://developer.spotify.com/documentation/web-api/reference/get-playlists-items]  
**Warning signs:** A card works for self-created lists but fails for followed editorial/user playlists.

### Pitfall 7: Export Creates a Playlist Before Matching Completes
**What goes wrong:** A failed match pass leaves empty or duplicate Spotify playlists.  
**Why it happens:** External mutation starts before local validation.  
**How to avoid:** Complete matching first, require at least one accepted URI, then create once and batch add. Persist the external playlist ID and each batch outcome in the returned report. [ASSUMED]  
**Warning signs:** Repeated retries produce same-named empty playlists.

### Pitfall 8: UI Violates Spotify Attribution
**What goes wrong:** Cards show Spotify metadata without a Spotify mark or deep link, or Spotify content is indistinguishable from Harmonix content.  
**Why it happens:** The designer screenshot predates provider-policy composition.  
**How to avoid:** Use separated provider groups, official icon assets, and API-provided links. [CITED: https://developer.spotify.com/documentation/design]  
**Warning signs:** A Spotify track/playlist has no visible source or `Open in Spotify`.

### Pitfall 9: Disconnect Deletes Only Tokens
**What goes wrong:** Cached Spotify personal data and provider metadata remain and synchronization continues.  
**Why it happens:** D-12-05 names tokens, while Spotify terms impose broader deletion duties.  
**How to avoid:** Delete tokens immediately, invalidate pending OAuth transactions, stop provider jobs, and delete Spotify personal data/cache entries no later than five days; immediate cleanup is simpler. [CITED: https://developer.spotify.com/terms]  
**Warning signs:** Status is disconnected but old Spotify names/artwork still render.

## Code Examples

Verified protocol patterns, adapted for this architecture:

### PKCE and One-Time State Generation

```javascript
// Sources:
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
// https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet
const state = crypto.randomBytes(32).toString('base64url');
const verifier = crypto.randomBytes(64).toString('base64url');
const challenge = crypto
  .createHash('sha256')
  .update(verifier)
  .digest('base64url');

// Persist hash(state), user id, verifier, client kind, expiry; never persist a caller URL.
```

### Refresh Token Retention

```javascript
// Source: https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
const nextRefreshToken = tokenResponse.refresh_token ?? currentRefreshToken;

// Encrypt access_token and nextRefreshToken, then update both and expires_at atomically.
```

### Market-Aware Search

```javascript
// Source: https://developer.spotify.com/documentation/web-api/reference/search
const params = new URLSearchParams({
  q: `track:${title} artist:${artist}`,
  type: 'track',
  market: 'from_token',
  limit: '10',
});
```

### Add Exported Tracks in Supported Batches

```javascript
// Source: https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist
for (const uris of chunks(matchedUris, 100)) {
  await spotifyRequest(`/playlists/${playlistId}/items`, {
    method: 'POST',
    body: JSON.stringify({ uris }),
  });
}
```

### Provider-Aware Client Navigation

```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/use-router
const href =
  playlist.provider === 'spotify'
    ? `/playlists/spotify/${encodeURIComponent(playlist.provider_id)}`
    : `/playlists/${encodeURIComponent(playlist.provider_id)}`;
router.push(href);
```

Only trusted provider enums and encoded IDs may participate in navigation; never pass an OAuth callback's arbitrary URL to `router.push`. [CITED: https://nextjs.org/docs/app/api-reference/functions/use-router]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit grant | Authorization Code with PKCE | Existing clients required migration by 2025-11-27 | Phase 12's PKCE decision is mandatory-compatible. [CITED: https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025] |
| HTTP/localhost callbacks | Harmonix-selected exact HTTPS backend callback; explicit loopback IP is Spotify's local-development exception | Enforced for existing clients by 2025-11-27 | Harmonix centralizes OAuth at the backend. Spotify still supports qualifying custom schemes, but Phase 12 does not use them. [CITED: https://developer.spotify.com/documentation/web-api/concepts/redirect_uri] [CITED: https://developer.spotify.com/blog/2025-02-12-increasing-the-security-requirements-for-integrating-with-spotify] |
| 25 Development Mode users | Five allowlisted authenticated users; Premium owner; one client ID per developer | 2026-02/03 | Public rollout requires Extended Quota approval. [CITED: https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security] |
| `/users/{id}/playlists` and `/playlists/{id}/tracks` | `/me/playlists` and `/playlists/{id}/items` | 2026-02 | Stale plans/SDK examples must not define routes. [CITED: https://developer.spotify.com/documentation/web-api/references/changes/february-2026] |
| Search max 50/default 20 | Search max 10/default 5 | 2026-02 | Matching must be selective and deterministic. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide] |
| Refresh token treated as indefinite | Six months from original authorization; `invalid_grant` requires reauthorization | New apps 2026-06-18; existing apps 2026-07-20 | Reconnect is a normal lifecycle state, not an exceptional edge case. [CITED: https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration] |

**Deprecated/outdated:**
- Spotify implicit grant. [CITED: https://developer.spotify.com/blog/2025-10-14-reminder-oauth-migration-27-nov-2025]
- Playlist `/tracks` endpoints and create-for-arbitrary-user endpoint. [CITED: https://developer.spotify.com/documentation/web-api/references/changes/february-2026]
- Assuming preview URLs are broadly available from Spotify; Harmonix should retain Deezer's validated 30-second preview path and add no Spotify playback. [CITED: https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api] [VERIFIED: REQUIREMENTS.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exported playlists should be private by default so only `playlist-modify-private` is needed. | Standard Stack / scopes | User may require public exports, which adds a scope and consent text. |
| A2 | Cache policy is selected at the environment gate and must key evidence by source identity and Spotify market; reuse is forbidden across markets without revalidation. | Policy-Bounded Cache | Spotify gives no universal numeric TTL, so deployment approval must select expiry/revalidation before implementation. |
| A4 | Title, artist, optional ISRC, and duration scoring can meet the roadmap's >90% target with a rejection threshold. | Matching | No labeled fixture corpus exists, so the target is not yet evidenced. |
| A5 | Per-user refresh serialization and rate gates can be in-process for the current single Express process. | Token/rate architecture | Multiple server processes would require a database/distributed lock. |
| A6 | Provider-prefixed IDs are acceptable additions to the client API contract. | Stable IDs | Existing routes may instead require separate provider path segments only. |

## Resolved-for-Planning Decisions

| Topic | Selected outcome | Remaining environment fact / gate |
|---|---|---|
| Callback and Android return | Harmonix uses one exact deployment-owned HTTPS backend callback at `/api/spotify/oauth/callback`. The backend maps `web` to fixed Library/Settings destinations and `android` to verified App Links: success opens Library; cancellation/error opens Settings. No arbitrary return URL or custom-scheme fallback is accepted. | Blocking plan 12-01 environment gate must provide the owned host, exact callback URI, fixed web URLs, Android success/error paths, package name, and release signing SHA-256 fingerprint before implementation. |
| Quota mode | Phase 12 is a Development Mode MVP limited to a Premium owner and at most five allowlisted users. Extended Quota approval is mandatory before any public release. | Dashboard evidence records owner, allowlist, and quota status; pending/unknown means sandbox-only. |
| Followed/restricted playlists | Keep cards. Open a restricted in-app detail using complete normalized list metadata (or `GET /playlists/{id}` when permitted), show the restriction, and expose the API-provided `Open in Spotify` URL. Never fake an empty item list. | No product decision remains. Tests must cover direct restricted access and missing metadata safely. |
| Policy and AI boundary | A named Spotify policy/design review blocks release. Spotify content is never sent to NVIDIA NIM or another AI/ML system. Provider sections remain separated and attributed; current guidance caps each displayed Spotify content set at 20 and requires an onward Spotify link after the set. Harmonix does not invent local pagination when the provider contract does not expose a supported continuation. | Policy approval and official asset review remain a blocking release checkpoint. [CITED: https://developer.spotify.com/documentation/design] [CITED: https://developer.spotify.com/policy] |
| Token encryption | Require one external, versioned 32-byte `SPOTIFY_TOKEN_ENCRYPTION_KEY` supplied by the deployment secret manager. Missing, malformed, unknown-version, or unavailable keys fail closed; there is no default, generated, source-controlled, database, or plaintext fallback. | Blocking plan 12-01 gate names the secret manager, active key version, provisioning owner, and rotation owner. |
| Match cache | Cache validated evidence by Harmonix source identity plus Spotify market. Reuse only within the approved expiry and same market; otherwise revalidate URI availability for the current user's market before export. | Blocking plan 12-01 gate records the approved expiry/revalidation duration and policy owner. |

## Environment Availability

| Dependency | Required By | Available | Version / State | Fallback |
|------------|-------------|-----------|-----------------|----------|
| Node.js | Backend provider integration | ✓ | 24.13.0 | — |
| npm | Backend verification | ✓ | 11.6.2 | — |
| Flutter / Dart | Android integration | ✓ | Flutter 3.44.6 / Dart 3.12.2 | — |
| Spotify Client ID | OAuth | ✗ | `SPOTIFY_CLIENT_ID` unset | Blocking: create developer app |
| Exact HTTPS callback | OAuth | ✗ | `SPOTIFY_REDIRECT_URI` unset | ngrok debug URL only; stable domain needed for release |
| Token encryption key | Secure storage | ✗ | `SPOTIFY_TOKEN_ENCRYPTION_KEY` unset | Blocking: provision secret |
| Android App Link association | Mobile auto-return | ✗ | No callback intent filter in manifest | Debug-only secret-free secondary custom scheme [ASSUMED] |
| Spotify quota approval | Public release | Unknown | Development Mode expected for new app | Five allowlisted testers only |

**Missing dependencies with no production fallback:**
- Spotify developer application/client ID.
- Exact production HTTPS callback.
- Token-encryption key.
- Extended Quota approval for more than five users.

**Missing dependencies with a development-only fallback:**
- Stable Android App Link domain: fixed ngrok HTTPS may support a debug callback, but production verification/signing still needs a controlled domain. [ASSUMED]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | Mocha 11.7.6 + Chai 6.2.2 [VERIFIED: server/package.json] |
| Backend config | `server/package.json` test script; tests colocated under routes/services [VERIFIED: codebase] |
| Backend quick run | `NODE_ENV=test npx mocha services/spotify*.test.js routes/spotify.test.js` |
| Backend full suite | `cd server && npm test` |
| Flutter framework | `flutter_test` from Flutter SDK 3.44.6 [VERIFIED: environment] |
| Flutter quick run | `cd mobile && flutter test test/spotify_*_test.dart` |
| Flutter full suite | `cd mobile && flutter test` |
| Web checks | `cd client && npm run lint && npm run build` [VERIFIED: client/package.json] |

### Behavior → Test Map

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|--------------|
| PKCE verifier/challenge shape; state expiry, mismatch, replay, and cross-user binding | unit | `npx mocha services/spotifyOAuthService.test.js` | ❌ Wave 0 |
| AES-GCM round-trip; wrong key/tag failure; no plaintext token persistence | unit | `npx mocha services/spotifyCrypto.test.js` | ❌ Wave 0 |
| Access-token reuse, pre-expiry refresh, retained/rotated refresh token, concurrent refresh, `invalid_grant` deletion | unit | `npx mocha services/spotifyService.test.js` | ❌ Wave 0 |
| 429 honors `Retry-After`; timeout; retry cap; per-user isolation | unit | `npx mocha services/spotifyService.test.js` | ❌ Wave 0 |
| Playlist pagination, `/items` schema, null/local/unavailable tracks, owner/collaborator 403 mapping | unit | `npx mocha services/spotifyService.test.js` | ❌ Wave 0 |
| Deterministic candidate scores and rejection for ambiguity/edition mismatch | fixture unit | `npx mocha services/spotifyMatchService.test.js` | ❌ Wave 0 |
| Match accuracy against labeled multilingual/edition fixture corpus | data test | `npx mocha services/spotifyMatchCorpus.test.js` | ❌ Wave 0 |
| Export creates only after matching; zero-match behavior; 100-item batching; partial failure report | unit/integration | `npx mocha services/spotifyExportService.test.js` | ❌ Wave 0 |
| Authenticated status/start/disconnect; callback state boundary; ownership and input validation | route | `npx mocha routes/spotify.test.js` | ❌ Wave 0 |
| Settings connection states and card placement | widget | `flutter test test/spotify_settings_test.dart` | ❌ Wave 0 |
| Library provider groups, stable navigation, detail, Open in Spotify | widget | `flutter test test/spotify_library_test.dart` | ❌ Wave 0 |
| OAuth completion selects Library tab from cold/warm Android app | widget/integration | `flutter test test/spotify_deep_link_test.dart` | ❌ Wave 0 |
| Web Settings/Library/detail/export states | build + manual/browser | `npm run lint && npm run build` | ❌ No web test framework |
| Real Spotify OAuth, allowlist, callback, deep link, and playlist mutation | sandbox smoke | Manual against dedicated five-user Development Mode app | Manual-only; external side effects |

### Required Test Doubles and Fixtures

- Inject `fetch` into `spotifyService`; never call live Spotify from unit tests. [VERIFIED: existing `deezerService` pattern]
- Use fixed encrypted token fixtures only in the test database and assert that plaintext sentinel values are absent from queried rows. [ASSUMED]
- Add labeled match fixtures covering diacritics, multiple artists, `feat.`, remaster/live/acoustic/remix collisions, clean/explicit variants, same-title songs, relinked tracks, local tracks, null tracks, and duration disagreement. [ASSUMED]
- Use a fake clock for token expiry, six-month reauthorization, OAuth state TTL, cache TTL, and `Retry-After`. [ASSUMED]
- Make route tests clean `user_spotify_tokens`, OAuth transaction rows, and Spotify match columns between cases. [VERIFIED: existing route test pattern]

### Sampling Rate

- **Per task commit:** targeted Spotify service/route or Flutter test file under 30 seconds.
- **Per wave merge:** backend full suite, Flutter full suite, web lint/build.
- **Phase gate:** all local suites green plus one sandbox smoke on web and one Android device, including reconnect and disconnect cleanup.

### Wave 0 Gaps

- [ ] `server/services/spotifyOAuthService.test.js`
- [ ] `server/services/spotifyCrypto.test.js`
- [ ] `server/services/spotifyService.test.js`
- [ ] `server/services/spotifyMatchService.test.js`
- [ ] `server/services/spotifyMatchCorpus.test.js` plus labeled fixtures
- [ ] `server/services/spotifyExportService.test.js`
- [ ] `server/routes/spotify.test.js`
- [ ] `mobile/test/spotify_settings_test.dart`
- [ ] `mobile/test/spotify_library_test.dart`
- [ ] `mobile/test/spotify_deep_link_test.dart`
- [ ] Decide whether to add a web component/E2E framework; none is currently configured. [VERIFIED: codebase]
- [ ] Repair backend native dependency baseline before relying on CI: `npm test` currently fails because the installed `better-sqlite3` binary did not self-register under Node 24.13.0. Rebuild/reinstall it for the active Node ABI without changing source behavior. [VERIFIED: environment]

### Current Baseline

- Flutter: `flutter test` passes 2 tests. [VERIFIED: environment]
- Backend: `npm test` does not reach tests because `better-sqlite3.node` fails with `ERR_DLOPEN_FAILED` / “Module did not self-register.” [VERIFIED: environment]
- Web: no test script or test framework is configured. [VERIFIED: client/package.json]

## Security Domain

### Applicable ASVS Categories

OWASP ASVS 5.0.0 is the current released ASVS baseline. [CITED: https://owasp.org/www-project-application-security-verification-standard/]

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing Harmonix JWT authenticates start/status/data routes; Spotify authorization uses PKCE and reconnect on expired grant. [VERIFIED: codebase] [CITED: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow] |
| V3 Session Management | yes | One-time short-lived OAuth state transaction; no Spotify tokens in browser/device storage. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet] |
| V4 Access Control | yes | Derive `user_id` from `req.user.id`; callback derives it only from validated state; every local playlist export verifies ownership. [VERIFIED: codebase] |
| V5 Input Validation | yes | Allowlist client kind/provider, validate IDs and playlist names, cap pagination and export sizes, reject arbitrary return URLs. [ASSUMED] |
| V6 Cryptography | yes | Node crypto AES-256-GCM with unique IV, external 32-byte key, authentication tag, and versioned envelope; never custom crypto. [ASSUMED] |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| OAuth login CSRF/account misbinding | Spoofing | Random one-time state securely bound to the authenticated user and PKCE transaction. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet] |
| Authorization-code interception/replay | Spoofing | S256 PKCE, exact HTTPS redirect, one-time transaction consumption. [CITED: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow] |
| Token disclosure from DB/log/client | Information Disclosure | AES-GCM at rest, key outside DB, redaction, never return provider tokens. [ASSUMED] |
| Cross-user playlist access/export | Elevation of Privilege | `req.user.id` ownership checks and provider-prefixed IDs; do not trust client user IDs. [VERIFIED: codebase] |
| Open redirect after callback | Spoofing | Server-side enum maps `web|android` to fixed destinations. [ASSUMED] |
| Refresh race/token rollback | Tampering | Per-user lock and atomic compare/update. [ASSUMED] |
| API quota exhaustion | Denial of Service | Per-user admission limit, low matching concurrency, cache, `Retry-After`, bounded retries. [CITED: https://developer.spotify.com/documentation/web-api/concepts/rate-limits] |
| SQL injection | Tampering | Existing `better-sqlite3` prepared statements; never interpolate IDs or tokens. [VERIFIED: codebase] |
| Stale personal data after disconnect | Privacy / Information Disclosure | Immediate token deletion and provider-data cleanup; stop future processing. [CITED: https://developer.spotify.com/terms] |

### Required Security Verification

- Assert invalid, missing, expired, already-consumed, and wrong-user state all fail before token exchange.
- Assert callback logs contain neither authorization code nor state.
- Assert database rows do not contain plaintext token sentinels.
- Assert decrypt fails closed for modified IV/ciphertext/tag.
- Assert disconnect is idempotent and subsequent provider calls return disconnected.
- Assert `invalid_grant` cannot enter a retry loop.
- Assert arbitrary callback return URLs and `javascript:` navigation values are rejected. [CITED: https://nextjs.org/docs/app/api-reference/functions/use-router]

## Planning Implications

Plan in dependency order:

1. **External prerequisites and policy gate:** Spotify app, Premium owner, five-user allowlist, exact HTTPS callback, scopes, branding assets, domain/App Link decision, encryption key.
2. **Wave 0 validation:** repair `better-sqlite3` test ABI and add service/route/mobile test scaffolds and matching corpus.
3. **Persistence/security foundation:** OAuth transaction table, encrypted token table, match-cache fields, cleanup migration, crypto helper.
4. **OAuth lifecycle:** status/start/callback/disconnect/reconnect, six-month expiry, client-specific safe completion.
5. **Provider wrapper:** token refresh serialization, timeout, rate gate, `Retry-After`, normalized errors.
6. **Read APIs:** owned/collaborative playlist list/detail, pagination, stable provider DTOs, null/restricted item handling.
7. **Export pipeline:** validation-first matching, cache TTL/revalidation, private playlist creation, 100-item batching, report and partial failures.
8. **Web UI:** create Settings surface first, then Library/detail/export states.
9. **Flutter UI and App Link:** Settings card, provider groups, detail/deep link, HomeShell tab selection on completion.
10. **Sandbox/release gate:** web + physical Android OAuth, disconnect cleanup, quota/policy checkpoint, docs.

Do not preserve the existing four stale PLAN.md files as constraints; regenerate plans from current context and current Spotify API semantics. [VERIFIED: user instruction]

## Sources

### Primary (HIGH authority, classified MEDIUM confidence by research seam)

- https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow — PKCE parameters, verifier, state, exact redirect.
- https://developer.spotify.com/documentation/web-api/concepts/redirect_uri — HTTPS, loopback, localhost/custom-scheme constraints.
- https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens — refresh behavior and token retention.
- https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration — six-month refresh-token lifecycle.
- https://developer.spotify.com/documentation/web-api/concepts/scopes — playlist scopes.
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes — five-user/Premium Development Mode.
- https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security — 2026 access changes.
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide — current endpoints, renamed fields, search cap.
- https://developer.spotify.com/documentation/web-api/references/changes/february-2026 — endpoint changelog.
- https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists — list semantics/pagination.
- https://developer.spotify.com/documentation/web-api/reference/get-playlists-items — item semantics and owner/collaborator restriction.
- https://developer.spotify.com/documentation/web-api/reference/create-playlist — current create endpoint.
- https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist — 100-URI batch and snapshot.
- https://developer.spotify.com/documentation/web-api/reference/search — filters, market, result fields.
- https://developer.spotify.com/documentation/web-api/concepts/track-relinking — market/relinking semantics.
- https://developer.spotify.com/documentation/web-api/concepts/rate-limits — rolling window and `Retry-After`.
- https://developer.spotify.com/terms — caching and disconnection/deletion duties.
- https://developer.spotify.com/policy — attribution, AI, and analysis restrictions.
- https://developer.spotify.com/documentation/design — visual attribution and deep links.
- https://docs.flutter.dev/ui/navigation/deep-linking — Flutter deep-link routing.
- https://developer.android.com/training/app-links/about — verified Android App Links.
- https://developer.android.com/training/app-links/configure-assetlinks — `assetlinks.json`.
- https://nextjs.org/docs/app/api-reference/functions/use-router — current client navigation.
- https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet — OAuth PKCE/state security.
- https://owasp.org/www-project-application-security-verification-standard/ — ASVS baseline.

### Internal Primary

- `12-CONTEXT.md`, `ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, `CLAUDE.md`.
- Existing Express, SQLite, Next.js, and Flutter files listed in `12-CONTEXT.md`.
- Canonical designer reference `design/spotify-library-designer-reference.png`.

### Tertiary (LOW confidence)

- None used as authority. Recommendations tagged `[ASSUMED]` are enumerated in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing runtime/dependencies were inspected; no new packages are recommended.
- Spotify API and policy: MEDIUM — official current sources were cross-checked, but no live developer app was exercised.
- Architecture: MEDIUM — strongly aligned with codebase and OAuth guidance; callback domain and quota mode remain unresolved.
- Matching: MEDIUM-LOW — endpoint fields are verified, but the acceptance threshold and >90% target need a labeled corpus.
- Validation: HIGH for identified gaps — test files/scripts and current baseline were inspected and executed.

**Research date:** 2026-07-19  
**Valid until:** 2026-07-26 — Spotify's platform and OAuth policies are fast-moving; re-check changelog, quota modes, refresh-token enforcement, and endpoint reference before implementation.
