# Phase 12: Spotify API Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 12-spotify-api-integration
**Areas discussed:** Spotify account linking and Library organization

---

## Spotify Account Linking and Library Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Link from Library | Use the designer screenshot's bottom Connect Spotify button | |
| Link from Settings | Put account connection and status management in Settings | ✓ |
| Unified provider list | Mix Spotify and Harmonix playlists with source badges | Builder discretion |
| Separate provider sections | Group Spotify and Harmonix playlists separately | Builder discretion |
| Provider tabs | Switch between Harmonix and Spotify playlist lists | |
| In-app Spotify detail | Open playlist songs inside Harmonix and provide Open in Spotify | ✓ |
| Direct Spotify launch | Send playlist taps immediately to Spotify | |

**User's choice:** Make account linking the priority and manage it from Settings. Display playlists and songs like the designer Library guide. After linking, open Library automatically; playlist taps should open an in-app song list with an Open in Spotify action.

**Notes:** The supplied Library screenshot is the visual reference for playlist cards and Recent Discoveries song rows. Its Connect Spotify button is intentionally superseded by the Settings-first account-link decision.

---

## Claude's Discretion

- Choose unified versus grouped playlist presentation based on clarity and visual fit.
- Define source badges, provider-aware loading states, and polished errors.
- Ensure every playlist and track links to the correct provider record using stable IDs.

## Deferred Ideas

- Spotify playlist import into learning flows.
- Listening-history personalization.
- Automatic Spotify daily-word playlists.
