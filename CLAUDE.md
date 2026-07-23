# Harmonix — Project Instructions

## Context
Harmonix is an AI-first language learning platform that teaches vocabulary through song lyrics.
Core Value: Personalizing language learning through real music lyrics with 100% accuracy via automated validation.

## Current product (v1.8)
- **Nav:** Discover · Library · Settings (Learn folded into Discover)
- **Home:** `/discover` — Word of the Day, practice strip, song search
- **Library:** Harmonix + Spotify playlists; Spotify account chip in **header only**
- **Settings:** Languages, music style, voice gender, Spotify Connect
- **Live:** https://harmonix.peeporunclub.co.uk · branch `main`

## Tech Stack
- Backend: Node.js (Express) + SQLite
- Web: Next.js / React (PWA shell)
- Mobile: Flutter Android (`mobile/`) primary; Capacitor legacy fallback
- AI: NVIDIA NIM + OpenRouter fallback
- Music: LRCLib, Deezer, Spotify Web API / Web Playback SDK
- TTS: Pocket-TTS (host daemon `:3002`)
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
- Phases 1–15 are **complete**; next work starts with a new milestone discuss.
- Use `/gsd:progress` to check status.
- **Production deploy:** `git push origin main` (Actions → `scripts/coolify-redeploy.sh`). Manual: SSH VPS and run that script. Legacy rollback only: `bash run_env.sh`.

---
*Updated: July 23, 2026*
