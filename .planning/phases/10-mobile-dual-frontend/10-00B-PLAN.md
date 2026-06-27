---
phase: 10-mobile-dual-frontend
plan: 00B
type: execute
wave: 2
depends_on: [10-00A]
autonomous: false
---

<objective>
Prepare for Google Play public / internal track — requires stable HTTPS domain and store compliance.
</objective>

<tasks>
- Production HTTPS domain (replace ngrok as primary origin)
- Privacy policy hosted on domain
- Google Play Console account ($25)
- Domain verification if using TWA
</tasks>

<exit_criteria>
App reachable at `https://yourdomain.com`; Play Console ready for internal track upload.
</exit_criteria>

**Estimate:** 1–2 days (+ domain purchase)

**Note:** Not required to **start** Option B (10-00A). Complete before 10-02 public/internal release.
