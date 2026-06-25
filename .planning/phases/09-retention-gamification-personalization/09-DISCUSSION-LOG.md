# Phase 9: Retention, Gamification & Personalization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 9-Retention, Gamification & Personalization
**Areas discussed:** Onboarding UX, Badges & Achievements

---

## Onboarding UX

| Option | Description | Selected |
|--------|-------------|----------|
| Modal/dialog on first dashboard visit | Full-screen modal on first /dashboard load | |
| Dedicated /onboarding route | Separate route after registration, before dashboard | ✓ |
| Yes — on next dashboard visit | One-time redirect for existing users without language | ✓ |
| No — settings only | Only new users see onboarding | |
| Settings page + dashboard badge | Nav badge shows current pair + link to settings | ✓ |
| Profile dropdown only | Language in profile section only | |
| Native + target language only | Minimal two-field onboarding | |
| Language + optional preferences | Two-step: language then optional genre/difficulty | ✓ |
| Pre-fill from browser locale | Detect navigator.language and pre-fill | |
| Always ask (no pre-fill) | Start with empty selects | ✓ |
| Blocking — must complete | Cannot access dashboard until done | |
| Soft-block — dismissible with default | Skip with EN→ES default, change later | ✓ |
| After registration, before dashboard | Onboarding redirect after login/register | ✓ |
| On dashboard load if language not set | Extra redirect hop | |
| Once — redirect with persistent state | Redirects every visit until completed | ✓ |
| Smart — dismissible reminder | Banner re-appears after 24h | |

**User's choice:** Dedicated /onboarding route, soft-block with defaults, always ask, language + optional preferences
**Notes:** Existing users (null language) see onboarding on next visit. Language badge in nav. Settings page for later changes.

## Badges & Achievements

| Option | Description | Selected |
|--------|-------------|----------|
| Core 5 badges | Streak, vocab, quiz, playlist, daily word | ✓ |
| Full 10 badges | More comprehensive, more test effort | |
| Dedicated Trophy Room page | Separate /achievements route | |
| Dashboard card + mini section | Achievements card on dashboard grid | ✓ |
| Streak, vocab, quiz, playlist, daily word | One badge per category | ✓ |
| Mix of early + long-term milestones | Two tiers per category (bronze/silver) | |
| Background check on API call | Server evaluates thresholds, returns badge data | ✓ |
| Separate badge check endpoint | Periodic GET /badges/check | |
| List view (text + icon) | Compact list with icon and name | |
| Grid of visual badge icons | Medal/ribbon icons, grayscale when locked | ✓ |
| Toast notification | Brief banner, auto-dismiss | ✓ |
| Full-screen celebration modal | Overlay with badge art | |

**User's choice:** Core 5, dashboard card, one-per-category, background API check, visual badge grid, toast notification
**Notes:** Grayscale/silhouette for locked, full-color for unlocked badges.

## the agent's Discretion

- SRS Review Room flashcard UX (not discussed — planner to propose)
- Playlist UI/API design (not discussed — standard CRUD approach)
- Dashboard "X words to review today" integration (not discussed)

## Deferred Ideas

None.
