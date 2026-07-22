# Security

## Secrets

- Store secrets only in local / VPS `.env` files (never in git).
- Templates: `server/.env.example`, `client/.env.example`.
- Rotate immediately if a secret is pasted into chat, logs, or a commit.

## Auth

- Access tokens: short-lived JWT (`Authorization: Bearer`).
- Refresh tokens: httpOnly cookie (and body for mobile); use HTTPS / secure cookies in production.
- Spotify: Authorization Code + PKCE; tokens encrypted in SQLite; player uses short-lived access tokens from `GET /api/spotify/player/token`.

## Data & copyright

- Audio: Deezer 30s previews and Spotify user-licensed playback only — do not host full tracks.
- Lyrics: validated via LRCLib; do not invent lyric text for playback sync.

## Reporting

For security issues in this private/personal deploy, contact the repo owner directly. Do not open public issues with secret values.
