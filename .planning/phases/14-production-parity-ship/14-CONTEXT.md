# Phase 14: Production Parity & Ship - Context

**Gathered:** 2026-07-22  
**Status:** Ready for replanning  
**Milestone:** v1.7 — Ship  

<domain>
## Phase Boundary

Consolidate and finish all remaining open items across 7 sub-plans (web polish, mobile Flutter parity, Spotify Connect UX, Capacitor fallback retention, and release/ops readiness).

</domain>

<decisions>
## Implementation Decisions

### Spotify Connect UX (Web & Mobile)
- **D-14-01 (Web OAuth Flow):** Spotify OAuth consent on Web opens in a popup window (`window.open`), handles authentication, posts back authorization confirmation via `postMessage`, and auto-closes without interrupting or resetting current browser page state.
- **D-14-02 (Web Library CTA):** Show a prominent inline "Connect Spotify" banner/button directly inside the empty Library tab (`/playlists`) when disconnected from Spotify.
- **D-14-03 (Flutter OAuth Flow):** On Flutter mobile, trigger Spotify OAuth via system external browser (`url_launcher`) and return authorization code to the app via custom deep-link scheme `harmonix://spotify-callback`.
- **D-14-04 (Flutter Playback Strategy):** Use **Honest Fallback** on Android: retain 30-second Deezer previews inside the Flutter app and present explicit "Open in Spotify App" deep links for Spotify tracks, reserving full Web Playback SDK for Web.

### Mobile & Frontend Parity
- **D-14-05 (Mobile Codebase Strategy):** Retain legacy Capacitor build scripts in the repository as a fallback option alongside primary Flutter mobile app (`mobile/`).
- **D-14-06 (Web Polish & Design Parity):** Match Word of the Day card to `design/learn-word-of-day.png`, add persistent bottom audio player on Library tab, wire global AppShell header search bar to `/discover` search API, and add Dyslexic font and stats/achievements toggles in Settings.

### Release & Ops Strategy
- **D-14-07 (Release Target):** Build standalone Android APK (`app-release.apk`) for direct distribution, document VPS ngrok/domain deployment steps in release runbook, fix 2 failing server unit tests (Pocket-TTS pronounce timeout and Spotify `/status` contract drift), and prepare Spotify Extended Quota submission payload.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing:**

### Core Roadmap & Architecture
- `.planning/ROADMAP.md` — Phase 14 entry and consolidated scope
- `.planning/STATE.md` — Current VPS runtime health and live stack status
- `docs/SPOTIFY-INTEGRATION.md` — Spotify integration ops runbook (scopes, PKCE, token proxy)
- `SECURITY.md` — Security principles, token handling & sandbox policies

### Platform & Prior Phase Context
- `.planning/phases/12.5-spotify-connect-ux/12.5-CONTEXT.md` — Spotify Connect UX requirements
- `.planning/phases/12.6-spotify-in-app-playback/12.6-CONTEXT.md` — Spotify Web Playback SDK & token proxy patterns
- `.planning/phases/13-web-design-system/13-CONTEXT.md` — AppShell design system tokens & mock references
- `.planning/phases/10-mobile-dual-frontend/10-CONTEXT.md` — Dual-frontend architecture decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/app/playlists/page.tsx`: Library view ready for inline Spotify Connect CTA banner and bottom player bar.
- `client/src/components/AppShell.tsx`: Global layout header search bar ready for API wiring.
- `mobile/lib/screens/settings_screen.dart`: Settings tab ready for native/target language selection.
- `server/src/routes/spotify.js`: Token proxy endpoints (`/api/spotify/login`, `/api/spotify/callback`, `/api/spotify/player/token`).

### Established Patterns
- **Token Security:** Refresh tokens are stored server-side encrypted; client surfaces only receive short-lived access tokens via backend proxy endpoints.
- **Player Fallback:** Spotify-first with Deezer 30s preview fallback when Spotify access or Premium status is absent.

</code_context>

<specifics>
## Specific Ideas

- **Web OAuth Popup:** Popup window calls `window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS' })` upon landing on `/callback`.
- **Flutter Deep Link:** App manifest / Intent filter handles `harmonix://spotify-callback` deep link redirect.

</specifics>

<deferred>
## Deferred Ideas

- **Wear OS / Apple Watch App:** Deferred to future hardware/wearables milestone.
- **In-App Spotify SDK Audio Control on Android:** Deferred to v2.0 after standalone APK ship.

</deferred>

---

*Phase: 14-Production Parity & Ship*  
*Context gathered: 2026-07-22*
