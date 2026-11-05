# Plan 009: Add an opt-in daily reminder notification to the Android app

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c7eb9ff..HEAD -- mobile/pubspec.yaml mobile/android/app/build.gradle.kts mobile/android/app/src/main/AndroidManifest.xml mobile/android/settings.gradle.kts mobile/lib/main.dart mobile/lib/screens/settings_screen.dart mobile/lib/screens/learn_screen.dart mobile/lib/utils/i18n.dart`
> On unexpected changes to the excerpts below, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (new native plugin; Android build config)
- **Depends on**: plans/008-daily-words-into-review-and-streaks.md (the reminder sends people to Review; ship 008 first)
- **Category**: direction
- **Planned at**: commit `c7eb9ff`, 2026-11-05

## Why this matters

Harmonix is a Flutter Android app (Google Play, package `uk.co.peeporunclub.harmonix`) that teaches a word a day from song lyrics. Of 32 people who got a word, 24 never came back for a second day, and the app has **no notifications of any kind**. A daily, local, opt-in reminder at a time the learner chooses is the cheapest way to bring people back. It needs no server and no Firebase.

## Current state

- `mobile/pubspec.yaml`: version `1.0.17+20`; Dart SDK `^3.12.2`; Flutter 3.44.6 stable. Dependencies include `shared_preferences`, `provider`, `url_launcher`. No notification, timezone, or permission plugins.
- `mobile/android/settings.gradle.kts:22-23` pins AGP `9.0.1` and Kotlin `2.3.20` (other plugins rely on these pins).
- `mobile/android/app/build.gradle.kts`: `compileOptions { sourceCompatibility/targetCompatibility = JavaVersion.VERSION_17 }` (lines 29-32); `minSdk = flutter.minSdkVersion`; no `dependencies {}` block; release signing from `key.properties`.
- `mobile/android/app/src/main/AndroidManifest.xml`: only `android.permission.INTERNET`. `MainActivity` uses `launchMode="singleTop"`.
- `mobile/lib/main.dart:17-20`: `main()` calls `WidgetsFlutterBinding.ensureInitialized(); runApp(const HarmonixApp());`. Providers are created in `_HarmonixAppState.build` (lines 77-87): `ApiClient`, `AuthState`, `ThemeController`, `HomeNavigationController`.
- Pattern for a persisted preference controller: `mobile/lib/state/theme_controller.dart` (a `ChangeNotifier` with `load()` and a setter that writes `SharedPreferences`). Copy this shape.
- Settings UI: `mobile/lib/screens/settings_screen.dart:424-442` shows the APPEARANCE section, a `SwitchListTile` styled with `colors.textPrimary`, `colors.textMuted`, `activeThumbColor: colors.onAccent`, `activeTrackColor: colors.accent`. Put a REMINDERS section right after it, styled the same.
- Strings: `mobile/lib/utils/i18n.dart` holds two maps (`translations` and `extra`), each with `en, es, fr, de, pt, it` blocks; `context.tr('key')` picks the learner's home language (line 846). Add new keys to the `extra` map in all six blocks (an existing key in every block is `'dark_mode'`).
- Tests: `mobile/test/*.dart` (`flutter test`); CI runs `flutter analyze --fatal-infos` and `flutter test`.
- Play policy: don't use `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`. Inexact daily scheduling is fine for a reminder.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Deps | `cd mobile && flutter pub get` | exit 0 |
| Analyze | `cd mobile && flutter analyze --fatal-infos` | `No issues found!` |
| Tests | `cd mobile && flutter test` | `All tests passed!` |
| Release build | `cd mobile && JAVA_HOME=$HOME/.local/jdk/jdk-17 flutter build apk --release --dart-define=API_BASE=https://harmonix.peeporunclub.co.uk/api` | `✓ Built build/app/outputs/flutter-apk/app-release.apk` |

## Scope

**In scope**
- `mobile/pubspec.yaml` (add `flutter_local_notifications`, `timezone`, `flutter_timezone`; bump version to `1.0.18+21`)
- `mobile/android/app/build.gradle.kts` (core library desugaring, only if the plugin's README requires it)
- `mobile/android/app/src/main/AndroidManifest.xml` (permissions and receivers from the plugin README)
- `mobile/lib/services/reminder_service.dart` (create): plugin wrapper
- `mobile/lib/state/reminder_controller.dart` (create): preference + scheduling logic
- `mobile/lib/main.dart` (provide `ReminderController`)
- `mobile/lib/screens/settings_screen.dart` (REMINDERS section)
- `mobile/lib/screens/learn_screen.dart` (one-time "Want a daily reminder?" prompt)
- `mobile/lib/utils/i18n.dart` (new keys, six languages)
- `mobile/test/reminder_controller_test.dart` (create)

**Out of scope**
- Firebase / push from the server; the web app.
- Exact alarms, foreground services, background fetch.
- Changing AGP or Kotlin versions in `settings.gradle.kts`.

## Git workflow

Branch `advisor/009-android-reminder`; conventional commits (e.g. `feat(android): opt-in daily reminder`). Do not push, build an AAB, or upload to Play unless told.

## Steps

### Step 1: Add plugins and Android setup

`cd mobile && flutter pub add flutter_local_notifications timezone flutter_timezone`. Open the **installed** `flutter_local_notifications` README (`~/.pub-cache/hosted/pub.dev/flutter_local_notifications-<version>/README.md`). Apply its "Android setup" section exactly: desugaring in `app/build.gradle.kts` (`isCoreLibraryDesugaringEnabled = true` plus a `dependencies { coreLibraryDesugaring(...) }` line, using the version the README gives), the `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED` permissions, and the scheduled-notification receivers in the manifest. Skip anything about exact alarms.

**Verify**: `flutter pub get` → exit 0; release APK build (table above) → `✓ Built`.

### Step 2: Reminder service and controller

- `reminder_service.dart`: an abstract `ReminderScheduler` with `Future<bool> requestPermission()`, `Future<void> scheduleDaily({required int hour, required int minute, required String title, required String body})`, and `Future<void> cancel()`. Then `LocalReminderScheduler implements ReminderScheduler` on top of the plugin: initialize with the app icon (`@mipmap/ic_launcher`), set `tz.setLocalLocation(tz.getLocation(await FlutterTimezone.getLocalTimezone()))` (adapt to the installed `flutter_timezone` API), use notification id `1001`, `matchDateTimeComponents: DateTimeComponents.time`, `androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle`, and channel id `daily_word` named "Daily word".
- `reminder_controller.dart` (shape of `theme_controller.dart`): fields `enabled` (default false), `hour` (default 19), `minute` (default 0), `promptShown` (default false), saved in `SharedPreferences` under the keys `reminder_enabled`, `reminder_hour`, `reminder_minute`, `reminder_prompt_shown`. Methods:
  - `load()`
  - `Future<bool> enable({required String title, required String body})`: requests permission; if refused, leaves `enabled` false and returns false; otherwise schedules and saves.
  - `disable()`
  - `setTime(hour, minute, {title, body})`: reschedules if enabled.
  - `markPromptShown()`
  
  The constructor takes a `ReminderScheduler` so tests can inject a fake.

**Verify**: `mobile/test/reminder_controller_test.dart` with a fake scheduler and `SharedPreferences.setMockInitialValues({})`:
- Enabling with permission granted schedules 19:00 and saves `true`.
- Permission denied → `enabled` stays false and nothing is scheduled.
- `setTime` while enabled reschedules at the new time.
- `disable` cancels.
- `load()` restores the saved values.

`flutter test` → all pass.

### Step 3: Provide it and re-schedule on start

In `main.dart`, add `ChangeNotifierProvider(create: (_) => ReminderController(LocalReminderScheduler())..load())`. When `load()` finds `enabled == true`, it reschedules with the stored time, so the reminder survives app updates. The notification text is passed in from the UI (Step 4) and also saved in prefs (`reminder_title`, `reminder_body`) for this reschedule.

**Verify**: `flutter analyze --fatal-infos` → no issues; `flutter test` → all pass (tests must not touch the real plugin; widget tests that build `HarmonixApp` must still pass. If one fails because of the plugin, make `LocalReminderScheduler` lazy-initialize on first use).

### Step 4: Settings section

After the APPEARANCE block in `settings_screen.dart`, add a `REMINDERS` heading (`context.tr('reminders')`), a `SwitchListTile` (`reminder_daily` / subtitle shows the time, e.g. `19:00`), and when enabled a `ListTile` that opens `showTimePicker` and calls `setTime`. If enabling returns false, show a `SnackBar` with `context.tr('reminder_permission_denied')`.

**Verify**: analyze + test pass.

### Step 5: One-time prompt on the Learn screen

In `learn_screen.dart`, after a word card has loaded successfully and `!reminder.promptShown && !reminder.enabled`, show a small dismissible card above the search dock: text `reminder_prompt`, buttons `reminder_prompt_yes` (calls `enable`) and `reminder_prompt_no`. Either button calls `markPromptShown()`. Show it at most once per install.

**Verify**: analyze + test pass.

### Step 6: Strings (add to the `extra` map, all six blocks)

| key | en | es | fr | de | pt | it |
|---|---|---|---|---|---|---|
| reminders | Reminders | Recordatorios | Rappels | Erinnerungen | Lembretes | Promemoria |
| reminder_daily | Daily word reminder | Recordatorio diario | Rappel quotidien | Tägliche Erinnerung | Lembrete diário | Promemoria quotidiano |
| reminder_title | Your song word is waiting | Tu palabra musical te espera | Ton mot en chanson t'attend | Dein Song-Wort wartet | Sua palavra musical está esperando | La tua parola in musica ti aspetta |
| reminder_body | One new word and a quick review — about a minute. | Una palabra nueva y un repaso rápido: un minuto. | Un nouveau mot et une révision rapide, une minute environ. | Ein neues Wort und eine kurze Wiederholung – etwa eine Minute. | Uma palavra nova e uma revisão rápida: cerca de um minuto. | Una parola nuova e un ripasso veloce: circa un minuto. |
| reminder_prompt | Want a daily reminder to keep your streak? | ¿Quieres un recordatorio diario para mantener tu racha? | Un rappel quotidien pour garder ta série ? | Tägliche Erinnerung, um deine Serie zu halten? | Quer um lembrete diário para manter sua sequência? | Vuoi un promemoria quotidiano per mantenere la serie? |
| reminder_prompt_yes | Yes, remind me | Sí, recuérdame | Oui, rappelle-moi | Ja, erinnere mich | Sim, me lembre | Sì, ricordamelo |
| reminder_prompt_no | Not now | Ahora no | Pas maintenant | Nicht jetzt | Agora não | Non ora |
| reminder_permission_denied | Notifications are off for Harmonix. Turn them on in Android settings. | Las notificaciones de Harmonix están desactivadas. Actívalas en los ajustes de Android. | Les notifications de Harmonix sont désactivées. Active-les dans les réglages Android. | Benachrichtigungen für Harmonix sind aus. Schalte sie in den Android-Einstellungen ein. | As notificações do Harmonix estão desativadas. Ative-as nas configurações do Android. | Le notifiche di Harmonix sono disattivate. Attivale nelle impostazioni di Android. |

Escape apostrophes (`\'`) as the file already does. Pass `context.tr('reminder_title')` / `context.tr('reminder_body')` into `enable`/`setTime`.

**Verify**: `flutter test test/i18n_test.dart` → passes (it checks every language has the same keys); full `flutter test` → all pass.

### Step 7: Version

Set `version: 1.0.18+21` in `pubspec.yaml`.

**Verify**: release APK build → `✓ Built`.

## Test plan

`mobile/test/reminder_controller_test.dart` (Step 2 cases), i18n parity via the existing `test/i18n_test.dart`. Manual (operator, on a phone): enable the reminder, set it 2 minutes ahead, lock the phone → a notification arrives; tap it → the app opens on the word screen; reboot the phone → the reminder still fires the next day.

## Done criteria

- [ ] `flutter analyze --fatal-infos` → No issues found
- [ ] `flutter test` → All tests passed, including `reminder_controller_test.dart`
- [ ] Release APK builds
- [ ] `grep -n "SCHEDULE_EXACT_ALARM\|USE_EXACT_ALARM" mobile/android/app/src/main/AndroidManifest.xml` → no matches
- [ ] `pubspec.yaml` version is `1.0.18+21`
- [ ] Only in-scope files changed; `plans/README.md` row updated

## STOP conditions

- The plugin needs a newer AGP/Kotlin than the pins in `settings.gradle.kts`, or Gradle fails with a Kotlin/AGP version error. Report the error and the plugin version; don't change the pins.
- The installed plugin's README requires exact-alarm permissions for daily schedules.
- An existing widget test fails because a platform channel is missing and lazy initialization doesn't fix it.

## Maintenance notes

- Play Console: the app now posts notifications. No Data safety change, since nothing leaves the device. Mention it in the release notes for 1.0.18.
- The notification text is fixed at scheduling time in the learner's home language. If they change their home language in Settings, re-call `setTime` with the new strings; a small follow-up is fine.
- Measure with plan 007's report: day-1 and day-7 return rates for people who enabled the reminder versus everyone else. Adding a `reminder_enabled` event later needs a tiny API call; not included here.
