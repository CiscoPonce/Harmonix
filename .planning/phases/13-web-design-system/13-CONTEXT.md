# Phase 13: Web Design System — Linguistic Resonance

**Gathered:** 2026-07-21  
**Status:** In progress (shell + core screens shipped)  
**Designer refs:** `design/discover.png`, `design/library.png`, `design/learn-word-of-day.png`, `design/settings.png`

## Boundary

Apply the light forest-green Harmonix web shell (sidebar Discover / Library / Learn / Settings) across authenticated web pages, matching designer screens.

## Shipped (2026-07-21)

- `AppShell` sidebar + header search + footer
- `/discover` page (hero search, Global Echo, Personal Resonance)
- Learn (`/dashboard`), Library (`/playlists`), Settings wrapped in shell
- Fonts: Fraunces (display) + DM Sans; default theme light
- Post-login redirect → `/discover`

## Remaining polish

- Pixel-perfect Word of the Day card match to learn mock
- Library playlist card grid + bottom player full controls
- Settings stats / achievements / dyslexic font toggle
- Wire header search globally to Discover/search API
