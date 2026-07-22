# Phase 14: Production Parity & Ship - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22  
**Phase:** 14-Production Parity & Ship  
**Areas discussed:** Spotify Connect UX (Web & Mobile), Mobile Codebase Strategy, Release & Ops Strategy  

---

## Spotify Connect UX (Web)

| Option | Description | Selected |
|--------|-------------|----------|
| Popup Window | OAuth opens in a popup window, posts back access confirmation, and auto-closes without resetting current page state. | ✓ |
| Full Redirect | Redirect the main browser page to Spotify OAuth and return via /callback URL. | |

**User's choice:** Popup Window  
**Notes:** Keeps user state intact on Next.js web app.

---

## Spotify Library Integration (Web)

| Option | Description | Selected |
|--------|-------------|----------|
| Inline Connect Banner | Show a prominent 'Connect Spotify' banner/button directly inside the empty Library tab. | ✓ |
| Settings Link Only | Keep Library minimal and show a simple link redirecting the user to Settings. | |

**User's choice:** Inline Connect Banner  
**Notes:** Improves discovery and onboarding for Spotify sync.

---

## Flutter Android Spotify Playback

| Option | Description | Selected |
|--------|-------------|----------|
| Honest Fallback | Use 30s Deezer previews in-app and provide an explicit 'Open in Spotify' deep link button for full Spotify tracks on mobile. | ✓ |
| Native Android SDK | Attempt native Spotify App Remote SDK integration in Flutter mobile app. | |

**User's choice:** Honest Fallback  
**Notes:** Minimizes binary bloat and native plugin friction for v1.7.

---

## Flutter Mobile Spotify OAuth

| Option | Description | Selected |
|--------|-------------|----------|
| External Browser with Deep Link | Open system browser via url_launcher and return to app via custom scheme `harmonix://spotify-callback`. | ✓ |
| In-App Webview Sheet | Open an in-app bottom sheet webview for Spotify consent. | |

**User's choice:** External Browser with Deep Link  
**Notes:** Preferred standard OAuth security pattern on mobile.

---

## Mobile Codebase Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Complete Removal | Remove Capacitor folder/scripts and standardize Flutter (`mobile/`) as the sole Android app. | |
| Keep Fallback | Retain Capacitor build scripts in repo alongside Flutter. | ✓ |

**User's choice:** Keep Fallback  
**Notes:** Retains Capacitor scripts as legacy backup.

---

## Release & Ops Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone APK + Release Runbook | Generate signed APK for direct distribution, document VPS ngrok/domain deployment, fix 2 failing server unit tests, and prepare Spotify Quota submission. | ✓ |
| Play Store Publishing | Focus on Play Store Developer Console listing setup as top priority. | |

**User's choice:** Standalone APK + Release Runbook  
**Notes:** Establishes direct APK distribution first.

---

## Deferred Ideas

- Wear OS / Apple Watch App (deferred to future hardware milestone)
- In-App Spotify SDK Audio Control on Android (deferred to v2.0)
