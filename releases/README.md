# Releases

Installable builds are not stored in this repository.

| Audience | What to install |
|----------|-----------------|
| Play testers | The Internal testing link after the signed AAB is uploaded |
| Play production | The Play Store listing, after Internal testing is green |
| Engineers | Build locally from `mobile/` — see [mobile/PLAY-STORE.md](../mobile/PLAY-STORE.md) |

**Current Play candidate:** `1.0.8` (versionCode `11`), application id `com.harmonix.app`.

The AAB is produced on the release machine and uploaded in Play Console. It is gitignored (`*.aab`, `*.apk`), along with `upload-keystore.jks` and `key.properties`.

Platform changelog tags (`v0.0.x`) are separate from the Play version. See the Releases section in the [README](../README.md).
