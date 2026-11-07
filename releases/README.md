# Releases

Installable builds are not stored in this repository.

| Audience | What to install |
|----------|-----------------|
| Play testers | The closed-testing link after the signed AAB is uploaded |
| Play production | The Play Store listing, after the closed test has 12 opted-in testers for 14 days |
| Engineers | Build locally from `mobile/` — see [mobile/PLAY-STORE.md](../mobile/PLAY-STORE.md) |

**On Play closed testing:** `1.0.18` (version code `21`), application id `uk.co.peeporunclub.harmonix`. Tested on a phone on 7 November 2026.

**In this repo, not uploaded:** `1.0.19` (version code `22`).

The AAB is produced on the release machine and uploaded in Play Console. It is gitignored (`*.aab`, `*.apk`), along with `upload-keystore.jks` and `key.properties`.

Platform changelog tags (`v0.0.x`) are separate from the Play version. See the Releases section in the [README](../README.md).
