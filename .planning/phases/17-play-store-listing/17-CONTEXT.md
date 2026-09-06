# Phase 17 — Play Store listing

**Status:** In progress (opened 2026-09-06)  
**Milestone:** v2.0  
**Surfaces:** Flutter Android (`mobile/`) only. Capacitor is not shipped.

## Goal

Put Harmonix on Google Play via **Internal testing first**, then Production when that track works on a real phone.

## Already done (do not redo)

| Item | Where |
|------|--------|
| Live API + web | https://harmonix.peeporunclub.co.uk |
| Privacy / terms | `/privacy`, `/terms` — mailbox `hello@peeporunclub.co.uk` |
| Listing copy + Data safety answers | [`docs/PLAY-CONSOLE-LISTING.md`](../../../docs/PLAY-CONSOLE-LISTING.md) |
| App icon 512×512 | `mobile/store/app-icon-512.png` |
| Feature graphic 1024×500 | `mobile/store/feature-graphic.png` |
| Application ID | `com.harmonix.app` |
| Flutter version for this upload | `1.0.8+11` in `mobile/pubspec.yaml` |
| JDK 17 on this PC | `$HOME/.local/jdk/jdk-17` (Temurin, user-local — no sudo) |

## Decisions locked

| ID | Decision |
|----|----------|
| D-17-01 | Play Store client is **Flutter only** (`mobile/`). Capacitor stays unpublished. |
| D-17-02 | Internal testing **before** Production. No production submit until Hear-it + login work on a tester phone. |
| D-17-03 | Support mailbox is the domain address `hello@peeporunclub.co.uk` (swap in `client/src/lib/contact.ts` if the box name changes). |
| D-17-04 | Upload keystore stays **off git** (`mobile/android/*.jks`, `key.properties`). Lose it and you cannot update the listing. |
| D-17-05 | Audio in-app is **30-second previews** (iTunes fallback when Deezer 403s). Full tracks open externally. |
| D-17-06 | Spotify Connect is optional for reviewers until Extended Quota is approved. |
| D-17-07 | Testers install from the **Play Internal testing link**, not a sideload debug APK. |

## Remaining work

Follow **[17-CHECKLIST.md](./17-CHECKLIST.md)** — that file is the operator list.

Plans (same work, split for tracking):

| Plan | Name |
|------|------|
| [17-01](./17-01-PLAN.md) | Keystore + signed AAB on this PC |
| [17-02](./17-02-PLAN.md) | Play Console listing, Data safety, content rating |
| [17-03](./17-03-PLAN.md) | Internal testing, reviewer login, then Production |

## Non-goals

- iOS / TestFlight
- Wear OS
- Capacitor store build
- Paid AI models
- Containerizing Pocket-TTS
- Coolify port lockdown / kernel reboot (ops, not store)

## Canonical refs

- `docs/PLAY-CONSOLE-LISTING.md` — paste-ready Console copy
- `mobile/PLAY-STORE.md` — keystore + build commands
- `PLAY_STORE_PUBLISH_GUIDE.md` — short publish guide
- `mobile/store/README.md` — graphic files
