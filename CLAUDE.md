# Harmonix — Project Instructions

## Context
Harmonix is an AI-first language learning platform that teaches vocabulary through song lyrics.
Core Value: Personalizing language learning through real music lyrics with 100% accuracy via automated validation.

## Current product (v1.9)
- **Nav:** Discover · Library (`/playlists`) · Settings
- **Home:** `/discover` — Word of the Day, practice strip, song search
- **Library:** Harmonix + Spotify playlists; Spotify account chip in **header only**
- **Settings:** Languages, music style, voice gender, Spotify Connect, change password
- **Live:** https://harmonix.peeporunclub.co.uk · branch `main`
- **Android:** Flutter (`mobile/`) is the Play Store app. Capacitor is not shipped.
- **Phases 1–16:** complete. Next: Play Store listing.

## Tech Stack
- Backend: Node.js (Express) + SQLite
- Web: Next.js / React
- Mobile: Flutter Android (`mobile/`) only for store release
- AI: NVIDIA NIM + OpenRouter fallback
- Music: LRCLib, Deezer, Spotify Web API / Web Playback SDK
- TTS: Host Pocket-TTS daemon `:3002` (API image may contain Kokoro but production uses `TTS_SKIP_SPAWN`)
- Deploy: Coolify Traefik + Compose (`api`/`web`); push to `main` → GitHub Actions redeploy

## Rules & Conventions
- **Minimalist Aesthetic**: High-contrast, dark mode, forest-green design system, no clutter.
- **Validation First**: AI output must be validated against music APIs.
- **Copyright Compliance**: Limit audio to 30s previews (Deezer); Spotify Premium for in-app streaming.
- **Test-Driven**: Add tests for new features and bug fixes.
- **Documentation**: Keep `.planning/ROADMAP.md`, `.planning/STATE.md`, `README.md`, and `CHANGELOG.md` synchronized after meaningful product changes.

## Workflow (GSD)
- Follow the Phased Roadmap in `.planning/ROADMAP.md`.
- Track state in `.planning/STATE.md`.
- Phases 1–16 are **complete**.
- **Production deploy:** `git push origin main` (Actions → `scripts/coolify-redeploy.sh`). Manual: SSH VPS and run that script. Legacy rollback only: `bash run_env.sh`.

---
*Updated: September 3, 2026*
