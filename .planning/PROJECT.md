# Harmonix

## What This Is

Harmonix is an AI-first language learning platform that teaches vocabulary through song lyrics. It dynamically generates personalized content based on user preferences and proficiency, strictly validated against real-world music APIs (LRCLib, Deezer) to ensure accuracy.

## Core Value

Contextual language learning through real music lyrics with 100% accurate, AI-personalized content.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **AI-Personalized Vocabulary**: Generate daily words based on user profile (language, difficulty, genre).
- [ ] **Lyric Validation Loop**: Cross-check AI-generated content against LRCLib and Deezer to prevent hallucinations.
- [ ] **Interactive PWA**: Web-based Progressive Web App with offline caching support.
- [ ] **Audio Integration**: 30-second song previews for contextual listening.
- [ ] **User Authentication**: JWT-based auth for personalized learning history.
- [ ] **SQLite Caching**: Persistent storage for validated songs and daily words to optimize API usage.
- [ ] **Open-Source Core**: MIT-licensed codebase for transparency and community trust.

### Out of Scope

- [ ] **Native Mobile Apps (v1)** — Deferred to Phase 4 (Flutter) to prioritize web validation.
- [ ] **Wear OS Support** — Deferred to future mobile phase.
- [ ] **Full Song Streaming** — Out of scope due to copyright; restricted to 30s previews.
- [ ] **Proprietary SRS Algorithms** — Kept in separate private repositories.

## Context

Harmonix aims to bridge the gap between traditional vocabulary apps and real-world media consumption. It leverages NVIDIA NIM for free AI inference and existing music databases for validation, keeping infrastructure costs near zero.

## Constraints

- **Tech Stack**: Node.js (Express), SQLite, Next.js/React.
- **Budget**: Zero-budget MVP (utilizing existing VPS and free-tier APIs).
- **API Limits**: Must respect rate limits for NVIDIA NIM, LRCLib, and Deezer.
- **Licensing**: Core must be MIT-compliant; lyrics must respect Fair Use/Copyright.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Node.js (Express) | Lightweight, excellent API support, fast for PWA development. | — Pending |
| SQLite | Zero-config, perfect for MVP scale and local caching. | — Pending |
| Minimalistic UI | Prioritizing focus and speed for language learning. | — Pending |
| PWA First | Faster validation of concept before committing to native mobile. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: June 12, 2026 after initialization*
