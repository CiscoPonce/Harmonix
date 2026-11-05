# Plan 010: Turn shared postcards into installs and sign-ups you can count

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c7eb9ff..HEAD -- "client/src/app/share/[id]/page.tsx" client/src/app/register/page.tsx client/src/context/AuthContext.tsx client/src/lib/contact.ts server/index.js`
> On unexpected changes to the excerpts below, STOP.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: plans/007-usage-events-and-retention-report.md (`recordEvent` and the `signup` event)
- **Category**: direction
- **Planned at**: commit `c7eb9ff`, 2026-11-05

## Why this matters

Word postcards are Harmonix's most-used voluntary feature: 6 people made 57 postcards. Each one is a public page, `https://harmonix.peeporunclub.co.uk/share/<id>`, that people send to friends. That page's only call to action is a link to web sign-up. There's no link to the Android app and no record of whether anyone joined from a postcard. This plan adds a Google Play button and tags sign-ups that came from a postcard, so growth from sharing can be measured. While the app is in closed testing, the Play button can point to the tester opt-in page instead, which also helps recruit the 12 testers Google requires for public release.

## Current state

- `client/src/app/share/[id]/page.tsx` is a client component (`'use client'`, `useParams()` at lines 50-52). Its action buttons are at lines 222-264. The last one:

```tsx
<Link
  href="/register"
  className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 text-sm font-bold uppercase tracking-widest text-white transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
>
  Learn this word on Harmonix
</Link>
```

- `client/src/lib/contact.ts` holds site constants (`SUPPORT_EMAIL`, `SITE_ORIGIN = 'https://harmonix.peeporunclub.co.uk'`). Add the Android URL here.
- Register page: `client/src/app/register/page.tsx` calls `register(email, password)` from `useAuth()` (line 16, 32). `client/src/context/AuthContext.tsx:115-121`:

```tsx
const register = async (email: string, password: string) => {
  const res = await apiFetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
```

- Server sign-up: `server/index.js:97-123`. After plan 007 it calls `recordEvent('signup', { userId: id, req })` (from `server/services/usageEvents.js`), whose props accept short strings.
- `client/AGENTS.md`: Next.js 16 has breaking changes, so read `client/node_modules/next/dist/docs/` before writing Next code. The register page already uses `useSearchParams` inside `<Suspense>` (see `client/src/app/login/page.tsx` for the pattern: inner component + `Suspense` wrapper in the default export).
- Play package: `uk.co.peeporunclub.harmonix`. Public store URL: `https://play.google.com/store/apps/details?id=uk.co.peeporunclub.harmonix`. Closed-test opt-in URL: `https://play.google.com/apps/testing/uk.co.peeporunclub.harmonix`. The opt-in link only works for accounts on the tester list (or in its Google Group).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd client && npx tsc --noEmit -p .` | exit 0 |
| Lint touched files | `cd client && npx eslint "src/app/share/[id]/page.tsx" src/app/register/page.tsx src/context/AuthContext.tsx src/lib/contact.ts src/lib/signupSource.ts` | exit 0 |
| Web unit tests | `cd client && node --experimental-strip-types --test 'src/lib/*.test.ts'` | `fail 0` |
| Server tests | `cd server && npm test` | all passing |
| Build | `cd client && npm run build` | exit 0 |

## Scope

**In scope**
- `client/src/lib/contact.ts` (add `ANDROID_APP_URL`)
- `client/src/lib/signupSource.ts` (create) + `client/src/lib/signupSource.test.ts` (create)
- `client/src/app/share/[id]/page.tsx` (Play button; tag the register link)
- `client/src/app/register/page.tsx` (read `?src=` and keep it)
- `client/src/context/AuthContext.tsx` (send `source` with register)
- `server/index.js` (accept `source`, pass to the `signup` event)
- `server/services/usageEvents.js` + `server/services/usageEvents.test.js` (add `normalizeSignupSource`)

**Out of scope**
- The Flutter app; OG image generation (`shareOg.js`); postcard creation.
- Storing the source on the `users` table (the event is enough).

## Git workflow

Branch `advisor/010-share-to-signup`; conventional commits (e.g. `feat(share): link postcards to the Android app`). Do not push unless told.

## Steps

### Step 1: Android URL constant

In `contact.ts` add:

```ts
/** Closed testing uses the opt-in page; switch to the store page at public launch. */
export const ANDROID_APP_URL = 'https://play.google.com/apps/testing/uk.co.peeporunclub.harmonix';
```

**Verify**: `npx tsc --noEmit -p .` → exit 0.

### Step 2: Signup-source helper

Create `client/src/lib/signupSource.ts`:
- `normalizeSignupSource(raw: string | null): string | null` → returns a lowercase value matching `/^[a-z0-9_-]{1,40}$/`, else `null`.
- `rememberSignupSource(raw)` stores the normalized value in `sessionStorage` under `harmonix_signup_source` (guard `typeof window`).
- `readSignupSource(): string | null`.

Test in `signupSource.test.ts` (same style as `client/src/lib/shelf.test.ts`; node test runner, pure functions only): `'postcard'` ok; `'Postcard'` → `'postcard'`; `'a b'`, `''`, 41 chars, `'<x>'` → `null`.

**Verify**: web unit tests → `fail 0`.

### Step 3: Share page buttons

In `share/[id]/page.tsx`:
- Change the register link to `href={`/register?src=postcard`}`.
- Add, before it, an `<a href={ANDROID_APP_URL} target="_blank" rel="noopener noreferrer">` styled like the existing outline button, labelled "Get the Android app".

**Verify**: lint touched files → exit 0; `npm run build` → exit 0.

### Step 4: Register page keeps the source

In `register/page.tsx`, read `useSearchParams().get('src')` and call `rememberSignupSource(...)` once on mount. If the page doesn't already wrap `useSearchParams` in `<Suspense>`, follow the `login/page.tsx` pattern. In `AuthContext.register`, include `source: readSignupSource() ?? undefined` in the JSON body.

**Verify**: typecheck + lint touched files → exit 0.

### Step 5: Server records it

`server/index.js` doesn't export the Express app, so the sign-up handler has no tests. Keep the logic in the tested helper:
- In `server/services/usageEvents.js`, export `normalizeSignupSource(raw)` → lowercase string matching `/^[a-z0-9_-]{1,40}$/`, else `null`.
- In `server/index.js` sign-up, pass `props: { source: normalizeSignupSource(req.body?.source) }` to `recordEvent('signup', …)` (the helper already drops null props). Don't change the response.

**Verify**: in `server/services/usageEvents.test.js`, add cases for `normalizeSignupSource` (`'postcard'` ok, `'Postcard'` → `'postcard'`, `'<bad>'`, `''`, 41 chars → `null`) and one asserting `recordEvent('signup', { userId, props: { source: 'postcard' } })` stores `props_json` containing `postcard`. `npm test` → all pass.

## Test plan

`signupSource.test.ts` (Step 2) and the `normalizeSignupSource` / signup-event tests in `usageEvents.test.js` (Step 5). Manual: open a production postcard URL, check both buttons, register through `?src=postcard`, then run plan 007's report and confirm one `signup` with `source=postcard`.

## Done criteria

- [ ] `npx tsc --noEmit -p .`, lint on touched files, web unit tests, and `npm run build` all pass
- [ ] `cd server && npm test` passes with the new test
- [ ] `grep -n "ANDROID_APP_URL" "client/src/app/share/[id]/page.tsx"` matches
- [ ] Only in-scope files changed; `plans/README.md` row updated

## STOP conditions

- Plan 007 isn't merged (`server/services/usageEvents.js` missing).
- The register page or auth flow differs from the excerpts (e.g. registration moved to a server action).

## Maintenance notes

- **At public launch**, change `ANDROID_APP_URL` to `https://play.google.com/store/apps/details?id=uk.co.peeporunclub.harmonix&referrer=utm_source%3Dpostcard`.
- During closed testing, the opt-in link only works for listed testers. To recruit testers through postcards, make the closed track's tester list a Google Group that anyone can join, and link the Group's join page from the share page instead.
- Next step, once this shows sign-ups: let a new user start with the exact word from the postcard.
