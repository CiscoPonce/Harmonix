# Phase 12: Spotify API Integration

**Status:** Planned  
**Milestone:** v1.5 — Spotify Integration  
**Goal:** Enable users to view their Spotify playlists and export Harmonix playlists to Spotify.

## Phase Boundary

1. **Backend Integration**: 
   - Implement Spotify OAuth 2.0 authentication flow (Authorization Code with PKCE).
   - Create `spotifyService.js` following the existing `deezerService.js` pattern.
   - Add SQLite tables for storing user Spotify tokens (`user_spotify_tokens`).
   - Create `/api/spotify/auth` endpoints for OAuth flow initiation and callback.
   - Create `/api/spotify/playlists` endpoints for fetching user playlists and exporting songs.
   - Implement song matching logic to map Harmonix tracks (Deezer-based) to Spotify URIs.
   - Add rate limiting specific to Spotify API calls.

2. **Frontend Integration (Web + Flutter)**:
   - Add "Connect Spotify" button in Settings/Profile page.
   - Display connected Spotify account status.
   - Show user's Spotify playlists in Library section.
   - Add "Export to Spotify" button on Harmonix playlists.
   - Deep link to Spotify app using `spotify:` URIs or web player.

3. **Data Flow**:
   - User authorizes Harmonix → Backend receives access/refresh tokens → Store encrypted in DB.
   - Fetch user playlists on-demand with token refresh logic.
   - Export: Match Harmonix song_cache entries to Spotify tracks via artist/title search → Create Spotify playlist → Return Spotify playlist URL/URI.

## Implementation Decisions

- **D-12-01:** Use Spotify Authorization Code with PKCE flow for enhanced security (no client secret exposure in frontend).
- **D-12-02:** Store Spotify tokens encrypted in a new `user_spotify_tokens` table with automatic refresh before expiry.
- **D-12-03:** Reuse existing `song_cache` table; add `spotify_uri` field if not already populated (Phase 12 will populate this field systematically).
- **D-12-04:** Song matching strategy: Search Spotify API by `artist + track_title` → Select best match by popularity score → Cache Spotify URI in `song_cache`.
- **D-12-05:** Rate limiting: Max 10 Spotify API calls per user per minute; exponential backoff on 429 responses.
- **D-12-06:** Offline support: Cached Spotify URIs work offline; playlist sync requires connection.
- **D-12-07:** Privacy: Users can disconnect Spotify at any time, triggering immediate token deletion.
- **D-12-08:** Environment variables: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` required.

## Technical Requirements

### New Database Schema

```sql
-- Spotify OAuth tokens (encrypted)
CREATE TABLE user_spotify_tokens (
    user_id INTEGER PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    scopes TEXT, -- comma-separated list
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add spotify_uri to song_cache if not exists (check schema)
-- ALTER TABLE song_cache ADD COLUMN spotify_uri TEXT;
```

### New API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/spotify/auth/url` | Get Spotify OAuth authorization URL | Yes |
| GET | `/api/spotify/callback` | OAuth callback handler (redirect from Spotify) | No (uses code) |
| GET | `/api/spotify/status` | Check if user has connected Spotify | Yes |
| DELETE | `/api/spotify/disconnect` | Disconnect Spotify (delete tokens) | Yes |
| GET | `/api/spotify/playlists` | Fetch user's Spotify playlists | Yes |
| GET | `/api/spotify/playlists/:id/tracks` | Fetch tracks from a Spotify playlist | Yes |
| POST | `/api/spotify/playlists` | Create new Spotify playlist from Harmonix playlist | Yes |
| POST | `/api/spotify/export` | Export Harmonix playlist to Spotify (bulk match + create) | Yes |

### Service Layer (`server/services/spotifyService.js`)

Functions to implement:
- `getAuthUrl(state)` — Generate Spotify OAuth URL with PKCE
- `exchangeCodeForTokens(code, codeVerifier)` — Exchange auth code for tokens
- `refreshAccessToken(refreshToken)` — Refresh expired access token
- `getUserPlaylists(accessToken)` — Fetch user playlists
- `createPlaylist(accessToken, name, description)` — Create new playlist
- `addTracksToPlaylist(accessToken, playlistId, trackUris)` — Add tracks
- `searchTrack(artist, title)` — Search Spotify for track match
- `getToken(userId)` — Get valid token (auto-refresh if needed)
- `saveTokens(userId, tokens)` — Encrypt and save tokens
- `deleteTokens(userId)` — Delete stored tokens

### Security Considerations

- Encrypt tokens at rest using existing encryption utilities (or add `crypto` module).
- Use PKCE to prevent authorization code interception attacks.
- Validate OAuth `state` parameter to prevent CSRF.
- Scope limitation: Request only `playlist-read-private`, `playlist-modify-public`, `playlist-modify-private`.
- Token rotation: Always use latest refresh token; Spotify invalidates old ones.

## Success Criteria

| Scenario | Target |
|----------|--------|
| OAuth flow completion | < 5 seconds |
| Playlist fetch (cached) | < 500ms |
| Export 20-song playlist | < 10 seconds |
| Song match accuracy | > 90% (manual verification sample) |
| Token refresh transparency | 100% (user never sees auth errors) |
| Rate limit compliance | 0 Spotify API bans |

## Dependencies

- Existing `song_cache` table with Deezer data
- User authentication system (JWT)
- Encryption utilities for token storage
- Environment variable configuration for Spotify Developer App

## Rollout Plan

1. **Plan 12-01:** Spotify Developer App setup & environment configuration
2. **Plan 12-02:** Backend OAuth service + token storage
3. **Plan 12-03:** Playlist fetch + display endpoints
4. **Plan 12-04:** Export functionality (match + create playlist)
5. **Plan 12-05:** Web frontend integration (Settings + Library UI)
6. **Plan 12-06:** Flutter mobile integration
7. **Plan 12-07:** Testing, documentation, and release

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Spotify API rate limits | Export fails for heavy users | Aggressive caching, queue exports, user-facing rate limit messages |
| Song matching failures | Exported playlist incomplete | Show match report to user, allow manual correction |
| Token expiry during operation | API calls fail | Auto-refresh before every call, retry logic |
| Spotify policy changes | Feature breaks | Monitor Spotify Developer changelog, abstract service layer for easy updates |
| Low match rate | Poor UX | Improve matching algorithm, fallback to fuzzy search, log unmatched for review |

## Future Enhancements (Post-Phase 12)

- Import Spotify playlists into Harmonix for vocabulary extraction
- Sync Harmonix daily words to a dedicated Spotify playlist automatically
- Spotify listening history analysis for personalized word recommendations
- Share Harmonix achievements to Spotify social feed
