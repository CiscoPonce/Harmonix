---
phase: 10-mobile-dual-frontend
plan: 00A
type: execute
wave: 1
depends_on: [09.5-word-queue]
autonomous: true
---

<objective>
Start mobile work without a custom domain — ngrok HTTPS is sufficient for Capacitor debug APK and team sideload testing.
</objective>

<tasks>
- Point Capacitor `server.url` at production ngrok: `https://moral-sparrow-nationally.ngrok-free.app`
- Ensure VPS serves stable `next build` for WebView
- Document env strategy: `NEXT_PUBLIC_API_URL` for web vs Capacitor vs future Flutter
- Export app icon + splash from [10-UI-SPEC.md](./10-UI-SPEC.md) tokens
- Document debug APK sideload steps for team phones
</tasks>

<exit_criteria>
Debug APK loads Harmonix via ngrok; login → daily word → player works on 2 physical devices.
</exit_criteria>

**Estimate:** 2–3 days
