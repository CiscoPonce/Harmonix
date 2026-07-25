# Plan 004: Flutter Hear-it must honor live preview provider (iTunes fallback)

> **Drift check**: `git diff --stat 6ced6d9..HEAD -- mobile/lib/screens/learn_screen.dart mobile/lib/utils/hear_it_timing.dart mobile/lib/services/api_client.dart server/routes/audio.js`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6ced6d9`, 2026-07-25

## Why this matters

Phase 16 marked Hear-it “Done” but `docs/DUAL-FRONTEND-QA.md` still says **Partial** for timing. Web reads `X-Harmonix-Preview-Provider` from the audio proxy (Coolify often falls back Deezer → iTunes, offset 0). Flutter seeks using payload `preview_provider` / `preview_offset` only — if payload says Deezer mid-track but bytes are iTunes opening, the sung word is missed. Matches user “Hear-it timing still wrong”.

## Current state

- Server sets header: `server/routes/audio.js` (~36-59) — `X-Harmonix-Preview-Provider`.
- Web: `DailyWordCard.tsx` `playDeezerClip` (~318-366) fetches blob, reads header, calls `computeDeezerHearWindow({ preview_provider: streamedProvider, ... })`.
- Flutter: `learn_screen.dart` `_playPreview` (~284-317) uses `just_audio` `setUrl` + payload fields only; `hear_it_timing.dart` already supports `previewProvider` / iTunes offset 0.
- Tests: `mobile/test/hear_it_timing_test.dart` covers pure timing; no integration for header.

## Steps

### 1. Fetch preview with headers before seek

In Flutter `_playPreview` (or a small helper in `api_client.dart` / `utils/`):

1. `GET` the resolved preview URL with auth cookies/bearer the same way other media requests work.
2. Read response header `x-harmonix-preview-provider` (case-insensitive).
3. Prefer header over payload `preview_provider`.
4. Write bytes to a temp file **or** use `just_audio` / `LockCachingAudioSource` / `AudioSource.uri` after computing seek — match whatever pattern the app already uses for authenticated media. If `setUrl` cannot expose headers, **must** use an HTTP client fetch first (web does this).

### 2. Pass streamed provider into `computeDeezerHearWindow`

```dart
final win = computeDeezerHearWindow(
  // ... lyric fields ...
  previewOffset: audio?['preview_offset'] as num?,
  previewProvider: streamedProvider, // from header, fallback payload
  durationSeconds: audio?['duration_seconds'] as num?,
);
```

If `!win.shouldPlay`, keep current SnackBar (do not play misleading start).

### 3. Seek + stop timer (already present)

Keep existing stop timer behavior from the prior Hear-it port.

### 4. Tests

- Extend `hear_it_timing_test.dart` if needed (already has iTunes offset 0).
- Prefer a unit test of a new pure helper `resolveStreamedPreviewProvider(headers, payloadProvider)`.
- Manual: on device/emulator against production, Hear-it for a geo-blocked Deezer track should land near the word (or honest “preview doesn’t include”).

## Done criteria

- [ ] Flutter uses live `X-Harmonix-Preview-Provider` when present.
- [ ] iTunes → offset 0 path; Deezer → payload/heuristic offset.
- [ ] `docs/DUAL-FRONTEND-QA.md` row “Hear-it timing” updated from Partial → Verified **only after** device check.
- [ ] Phase 16 context note: Hear-it provider parity required (not optional).

## STOP conditions

- If authenticated media fetch cannot stream on Android without major refactor — STOP and report; do not ship a broken half-fetch.
- Do not enable Spotify Web Playback SDK on Flutter (D-16-07).

## Out of scope

- Server preview window acceptance (plan optional follow-up / CORRECTNESS-05)
- Web Hear-it (already correct)
- Genre catalog (005)

## Commands

| Purpose | Command | Expected |
|---------|---------|----------|
| Flutter unit tests | `cd mobile && flutter test test/hear_it_timing_test.dart` | all pass |
| Analyze | `cd mobile && flutter analyze lib/screens/learn_screen.dart lib/utils/` | no new errors |
