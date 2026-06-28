# Releases

Harmonix uses [release-please](https://github.com/googleapis/release-please) to
automate version bumps, `CHANGELOG.md`, Git tags, and GitHub Releases.

## Current version

See [`version.txt`](../version.txt) and [GitHub Releases](https://github.com/CiscoPonce/Harmonix/releases).

Initial release: **v0.0.1** (displayed as v0.01).

## How it works

1. Commits on `main` use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` — new feature (patch bump while &lt; 1.0.0)
   - `fix:` — bug fix (patch bump)
   - `feat!:` or `BREAKING CHANGE:` — breaking change (minor bump while &lt; 1.0.0)
2. The **release-please** GitHub Action opens (or updates) a Release PR with
   changelog and version file updates.
3. When you merge that PR, release-please tags the release and publishes a
   GitHub Release.
4. The **attach-apk-to-release** workflow uploads `releases/Harmonix-debug.apk`
   to each published release.

## Commit examples

```text
feat: add offline word cache for daily word card

fix: prevent song search input from clipping on small screens

docs: update Capacitor sideload instructions
```

## Force a specific version

Add to the commit body (one-time):

```text
Release-As: 0.0.2
```

Or merge a release PR manually after editing the version in the Release PR.

## Files updated on each release

| File | Purpose |
|------|---------|
| `version.txt` | Canonical app version |
| `CHANGELOG.md` | Release notes |
| `client/package.json` | Frontend version |
| `server/package.json` | Backend version |
| `client/android/app/build.gradle` | Android `versionName` |
| `README.md` | Version badge line |

## Repo settings (one-time)

In GitHub → **Settings → Actions → General**, enable:

**Allow GitHub Actions to create and approve pull requests**

Without this, release-please cannot open Release PRs.
