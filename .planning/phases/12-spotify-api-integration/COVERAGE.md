# Phase 12 Spotify Web API Coverage

**API baseline:** February 2026 Spotify Web API  
**Integration boundary:** Express owns OAuth, tokens, Spotify HTTP calls, matching, and mutation. Next.js and Flutter consume only Harmonix `/api/spotify/*` DTOs.

| Capability | Disposition | Harmonix surface | Contract / reason |
|---|---|---|---|
| Authorization Code with PKCE | INTEGRATE | `POST /api/spotify/auth/start`, `GET /api/spotify/oauth/callback` | Backend creates S256 PKCE and a one-time hashed, expiring, Harmonix-user-bound state transaction. Harmonix selects one exact configured HTTPS backend callback and fixed web/App Link returns. Spotify currently supports qualifying custom schemes, but Phase 12 intentionally does not use them because the backend must own code exchange and token custody. |
| OAuth scopes | INTEGRATE | authorization URL | Request only `playlist-read-private`, `playlist-read-collaborative`, and `playlist-modify-private`; exported playlists are private. No playback, history, library, or public-playlist scope. |
| Token exchange and refresh | INTEGRATE | backend token lifecycle | Encrypt access and refresh tokens with AES-256-GCM, refresh before expiry, serialize per user, retain the prior refresh token when omitted, and persist a rotated token atomically. |
| Six-month refresh expiry | INTEGRATE | status/provider error contract | Track original `authorized_at`; `invalid_grant` or six-month expiry deletes credentials and returns `reconnect_required` without retrying. |
| Connection status | INTEGRATE | `GET /api/spotify/status` | Return connection state, safe display name, and last-sync metadata only; never return tokens, scopes beyond UI need, email, or internal IDs. |
| Disconnect | INTEGRATE | `DELETE /api/spotify/connection` | Immediately delete tokens, invalidate OAuth transactions, stop provider work, and remove Spotify personal/cache data so stale content cannot render. |
| Current-user playlists | INTEGRATE | `GET /api/spotify/playlists` | Use `/me/playlists`, paginate all supported pages with bounded limits, normalize nullable fields, and return provider-aware IDs. |
| Playlist items | INTEGRATE | `GET /api/spotify/playlists/:id` | Obtain complete header metadata through current `GET /playlists/{id}` or a user-scoped persisted normalized `/me/playlists` DTO, then use `/playlists/{id}/items` for readable items. Preserve source order and null/local/unavailable rows. The clients display at most 20 item rows and continue through the API-provided playlist link, not invented local pagination. |
| Followed/restricted playlists | INTEGRATE | playlist list/detail | `/me/playlists` may list records whose items return 403. Keep the card, return restricted detail from user-scoped normalized metadata (or current metadata endpoint when permitted), explain the owner/collaborator limit, and expose the API-provided Spotify link. Direct access without authorized normalized metadata fails safely rather than leaking or showing a fake empty list. |
| Track search | INTEGRATE | export matching | Use market-aware `type=track` searches with `limit <= 10`; deterministically score artist/title plus optional ISRC/duration and reject ties, edition conflicts, local/unavailable results, and weak matches. Popularity is not evidence of identity. |
| Create playlist | INTEGRATE | `POST /api/spotify/exports` | After all source songs are classified and at least one match is accepted, call `/me/playlists` to create one private destination. |
| Add playlist items | INTEGRATE | export mutation | Add only accepted `spotify:track:` URIs through `/playlists/{id}/items` in batches of at most 100 and report each batch outcome. |
| Export report | INTEGRATE | web and Android Harmonix detail | Persist user-owned job identity server-side. Return one factual outcome per source song plus total, matched, unmatched, exported, failed, destination ID, and API-provided external URL. Authenticated `GET /exports/latest?source_playlist_id=…` and `GET /exports/:id` enforce ownership and restore web/Android progress after refresh, route recreation, or process recreation. |
| External links and attribution | INTEGRATE | cards, detail, report | Use official Spotify assets unchanged and API-provided links; label Spotify content and provide item-level `Open in Spotify`. Current official design guidance also limits a displayed Spotify content set to 20 items and requires an onward Spotify link at its end. |
| Pagination | INTEGRATE | backend synchronization only | Backend may follow current `next`/offset semantics with defensive maximums to normalize user-scoped data, but each client content set displays no more than 20 Spotify items. UI continuation is the API-provided Spotify onward link; Phase 12 does not invent unsupported local pagination. |
| Rate handling | INTEGRATE | all Spotify requests | Apply per-user admission control, low export-search concurrency, timeout/abort, bounded retries, and exact `Retry-After` seconds for 429 responses. |
| Policy-bounded cache | INTEGRATE | `song_cache` Spotify match columns | Persist only validated URI/match evidence keyed by Harmonix source identity and Spotify market. Reuse requires the same market and approved freshness; otherwise revalidate URI availability against the current user market. Clear Spotify-derived personal/cache data on disconnect. |
| Spotify playback / Web Playback SDK | DEFERRED → Phase 12.6 | all clients | Phase 12 does not stream Spotify audio. Harmonix playback remains the validated Deezer 30-second preview path. **Phase 12.6** plans Premium in-app playback via Web Playback SDK (see `12.6-CONTEXT.md`). |
| Recently played / listening history | OPT-OUT | personalization | Explicitly deferred by D-12 phase boundary; would require additional scopes and is not needed for linking, browsing, or export. |
| Saved-library import | OPT-OUT | learning flows | Importing Spotify tracks into Harmonix learning, lyrics, vocabulary extraction, or NVIDIA NIM is out of scope and conflicts with the policy prohibition on sending Spotify content to AI/ML. |
| Spotify profile data beyond required display | OPT-OUT | status | Do not add a profile endpoint or store email, followers, images, country, product tier, or other profile data. A provider-returned display name may be shown transiently when required for connection identity. |
| Editing/removing/reordering Spotify playlist items | OPT-OUT | Spotify detail | Phase 12 Spotify detail is read-only. Export creates a new private playlist and adds matched tracks; unsupported editing would expand scope and permissions without serving the user story. |
| Public playlist creation | OPT-OUT | export | Exports are private, so `playlist-modify-public` is unnecessary and must not be requested. |
| Manual match override | OPT-OUT | export report | Validation-first behavior rejects ambiguity. Manual overrides are outside Phase 12 and could bypass the labeled-corpus confidence gate. |

## Blocking facts and release gates

- Implementation must not start until the Spotify developer app, Premium owner, five-user Development Mode allowlist, exact HTTPS callback, fixed web/Android return destinations, and 32-byte `SPOTIFY_TOKEN_ENCRYPTION_KEY` provisioning/rotation owner are confirmed.
- Android production return requires a controlled HTTPS domain, release signing fingerprint, and matching `assetlinks.json`; an ngrok callback is development-only and is not a release assumption.
- Cache duration and mixed-provider branding require explicit policy approval before external release.
- Current official design/policy review must confirm the maximum 20-item shelf/detail sets and mandatory API-provided onward Spotify links before release.
- Public release beyond five allowlisted users requires Spotify Extended Quota approval.

## Prohibitions

- No Spotify token, authorization code, PKCE verifier, state value, or arbitrary return URL may enter a client response, redirect query, browser/device storage, analytics, or logs.
- No Spotify content may be sent to NVIDIA NIM or any other AI/ML system.
- No legacy `/users/{id}/playlists` or `/playlists/{id}/tracks` endpoint may be used.
