# Phase 19 — Account profile

**Status:** Complete 2026-11-08  
**Milestone:** after v2.1  
**Surfaces:** API (`server/`), web Settings (`client/src/app/settings/page.tsx`), Flutter Settings (`mobile/lib/screens/settings_screen.dart`)  
**Planned at:** `ce57705`

## Goal

The Account page (Settings) opens with a personal header: photo, username, bio, and the existing day streak. Under that, the same page shows days learned, words obtained, reviews finished, and achievements that use those counts. Learning preferences, Spotify, password, and the rest of Settings stay below it.

Feedback asked for that block at the very top of the account page. Today the web card shows the email and a letter circle. Android shows the email and a generic person icon, and the streak is a small tile near the bottom.

## Decisions locked

| ID | Decision |
|----|----------|
| D-19-01 | This is the signed-in learner’s own Account page. It is not a public profile, a social feed, or something other learners can open. |
| D-19-02 | Login stays the email address. `username` is a display handle only. |
| D-19-03 | Username is optional. Stored lowercase. 3–20 characters, `^[a-z0-9_]+$`. Unique. Empty clears it. Reserved: `admin`, `harmonix`, `support`, `hello`. |
| D-19-04 | Bio is optional plain text, trimmed, 160 characters max. Reject control characters and `<` `>`. Empty clears it. |
| D-19-05 | The photo is optional. JPEG, PNG, or WebP, at most 512 KB, checked by magic bytes (JPEG also decoded with the existing `jpeg-js`). Store the bytes in SQLite table `user_avatars`, so the existing database backup keeps them. One photo per user. The owner can remove it. |
| D-19-06 | Only the signed-in user can read or change their photo. `GET /api/user/avatar` requires auth. No public avatar URL. |
| D-19-07 | The streak in the header is `streak_days` from `GET /api/progress/stats`, already computed from `daily_words` dates. The 7-day achievement uses the longest run of those same dates, so a streak that later breaks is still earned. |
| D-19-08 | Web and Android both get the header. The shipped Play app is Flutter `mobile/`. Do not edit Capacitor `client/android`. |
| D-19-09 | This screen ships as Android `1.0.21+24`. `1.0.20+23` stays the email-code build and is not uploaded on its own. |
| D-19-10 | Android photo pick uses the system picker. The merged manifest must not gain `READ_MEDIA_IMAGES` or `READ_EXTERNAL_STORAGE`. |
| D-19-11 | One count per idea, shared by the account tiles and the achievements. Days = distinct `daily_words.date`. Words obtained = `COUNT(*)` of `daily_words` (the Words tile). Learning done = `user_vocab_progress` rows with `reps > 0`. Current streak = `computeDailyWordStreak`. |
| D-19-12 | `daily_word_7` is 7 different days, not 7 days in a row. The stored description that says “in a row” is wrong and must be changed. `streak_7` is the consecutive one. |
| D-19-13 | `vocab_50` counts words obtained, the same number as the Words tile. It must not keep counting only reviewed rows (`reps > 0`). Reviewed words get their own achievement, `review_10`, at 10 reviews. |
| D-19-14 | `quiz_perfect` stays in the database but is not listed and is not awarded. No shipped screen takes a quiz. Playlist creation stays the Curator achievement. |
| D-19-15 | A day counts toward the streak when that date has at least one word. The Today tile shows how many words were obtained today. It does not show a target of 10. |
| D-19-16 | Account order, top to bottom, on web and Android: profile header, then words / days / reviewed / today and the achievements, then learning preferences, then Spotify, then appearance (the light/dark switch that already exists), then password on the web. Android keeps the daily reminder with appearance. Log out and Delete account stay last. The streak number is only in the header. |
| D-19-17 | Achievement titles and descriptions (`streak_7`, `daily_word_7`, `vocab_50`, `review_10`, `playlist_first`) are localized across all 6 UI languages (`en`, `es`, `fr`, `de`, `pt`, `it`) on web and Android, falling back to the server string if unknown. |
| D-19-18 | Web `AppShell` reflects the signed-in learner's circular avatar photo (when `has_avatar` is true) or uppercase initial and `@username` tooltip in the top-right Account link; unused `BadgeGrid.tsx` and `DashboardMatureCards.tsx` are removed. |
| D-19-19 | Self-service account deletion (`DELETE /api/user/account`) transactionally deletes the user and all owned rows (avatars, badges, progress, stats, daily words, queue, playlists, quizzes, Spotify tokens/playlists/exports, postcards) and clears the refresh cookie. `/privacy` and `docs/PLAY-CONSOLE-LISTING.md` document optional profile photo/username/bio storage and in-app deletion. |

## Non-goals

- Showing the profile on Discover, Library, postcards, or the admin user list
- Importing the Spotify photo or Spotify display name into this header
- Changing email, password rules, or signup verification
- Changing the SRS formula or how many XP points a word adds
- Taking badges away from someone who already unlocked them
- iOS, Wear, or the watch-page files already dirty in the working tree
- Bumping the Play version or uploading an AAB
- TTS, glosses, song reuse, or Spotify Connect
- Custom colors or extra palettes. Light and dark stay as they are. Palettes wait until closed testing is done and the product is further along. Do not start a color-token migration in this phase.

## Plans

| Plan | Name | Status |
|------|------|--------|
| [19-01](./19-01-PLAN.md) | Store username, bio, and account photo | Complete |
| [19-02](./19-02-PLAN.md) | Account header on web and Android | Complete |
| [19-03](./19-03-PLAN.md) | Make account achievements match days, words, reviews, and streak | Complete |
| [19-04](./19-04-PLAN.md) | Account profile polish, localized badges, and self-service account deletion | Complete |
