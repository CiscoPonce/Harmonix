# Phase 12: Spotify API Integration - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 35 new/modified files
**Analogs found:** 29 / 35

## Vertical Slice Order

1. **Settings link → OAuth → Library:** persistence, crypto, OAuth transaction, token/provider wrapper, status/start/callback/disconnect/read routes, route mounting, web/mobile Settings, provider-aware Library, callback-to-Library navigation, and their tests.
2. **Playlist detail:** provider-aware IDs, Spotify list/detail DTOs, restricted followed-playlist state, in-app detail, and API-provided `Open in Spotify`.
3. **Export and refinement:** deterministic matching, cache policy, validation-before-mutation export, progress/report UI, branded assets, and corpus/partial-failure tests.

Do not begin with export UI. The first executable end-to-end seam is a Settings connection card that completes backend-owned OAuth and lands on a Library whose Harmonix section remains usable while Spotify loads.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `server/db.js` | migration/config | CRUD | existing inline schema/migrations in same file | exact |
| `server/index.js` | config/route mount | request-response | existing authenticated router mounts in same file | exact |
| `server/routes/spotify.js` | route/controller | request-response | `server/routes/playlists.js` | exact |
| `server/services/spotifyOAuthService.js` | service | request-response + CRUD | `server/auth.js` plus `server/routes/playlists.js` | partial |
| `server/services/spotifyCrypto.js` | utility | transform | Node crypto usage in `server/auth.js` | role-match |
| `server/services/spotifyService.js` | service | request-response | `server/services/deezerService.js` | exact |
| `server/services/spotifyMatchService.js` | service/utility | transform | `server/services/deezerService.js` | exact |
| `server/services/spotifyExportService.js` | service | batch + CRUD | `server/routes/progress.js` plus `deezerService.js` | role-match |
| `server/routes/spotify.test.js` | test | request-response | `server/routes/playlists.test.js` | exact |
| `server/services/spotifyOAuthService.test.js` | test | CRUD/transform | `server/routes/playlists.test.js` | role-match |
| `server/services/spotifyCrypto.test.js` | test | transform | `server/services/deezerService.test.js` | role-match |
| `server/services/spotifyService.test.js` | test | request-response | `server/services/deezerService.test.js` | exact |
| `server/services/spotifyMatchService.test.js` | test | transform | `server/services/deezerService.test.js` | exact |
| `server/services/spotifyMatchCorpus.test.js` | test | batch/transform | `server/services/dailyWordService.test.js` | role-match |
| `server/services/spotifyExportService.test.js` | test | batch + CRUD | `server/services/dailyWordService.test.js` | role-match |
| `server/services/fixtures/spotify-match-corpus.json` | test fixture | batch | none | none |
| `client/src/app/settings/page.tsx` | component/page | request-response | `client/src/app/dashboard/page.tsx` | role-match |
| `client/src/app/playlists/page.tsx` | component/page | request-response | same file | exact |
| `client/src/app/playlists/[id]/page.tsx` | component/page | request-response | same file | exact |
| `client/src/app/playlists/[provider]/[id]/page.tsx` | component/page | request-response | `client/src/app/playlists/[id]/page.tsx` | exact |
| `client/src/components/SpotifyConnectionCard.tsx` | component | event-driven + request-response | dashboard cards and shared `Button` | role-match |
| `client/src/components/SpotifyExportDialog.tsx` | component | event-driven + request-response | no accessible dialog exists | none |
| `client/src/components/SpotifyMatchReport.tsx` | component | transform/render | `client/src/components/DashboardMatureCards.tsx` | role-match |
| `client/src/lib/api.ts` | utility | request-response | same file | exact |
| `client/public/spotify-logo.svg` | asset | file-I/O | none; use official Spotify asset | none |
| `mobile/lib/services/api_client.dart` | service | request-response | same file | exact |
| `mobile/lib/screens/settings_screen.dart` | component/screen | request-response | same file | exact |
| `mobile/lib/screens/library_screen.dart` | component/screen | request-response | same file | exact |
| `mobile/lib/screens/playlist_detail_screen.dart` | component/screen | request-response | same file | exact |
| `mobile/lib/screens/home_shell.dart` | component/router | event-driven | same file | exact |
| `mobile/lib/main.dart` | provider/router config | event-driven | existing root gate in same file | role-match |
| `mobile/android/app/src/main/AndroidManifest.xml` | platform config | event-driven | launcher intent filter in same file | role-match |
| `mobile/test/spotify_settings_test.dart` | widget test | event-driven | `mobile/test/widget_test.dart` | weak |
| `mobile/test/spotify_library_test.dart` | widget test | request-response | `mobile/test/widget_test.dart` | weak |
| `mobile/test/spotify_deep_link_test.dart` | widget/integration test | event-driven | none | none |

`mobile/pubspec.yaml` only needs modification if the approved official logo is bundled as a Flutter asset. The current dependency set already contains `url_launcher`; research recommends no new package.

## Pattern Assignments

### Persistence and atomic state

**Applies to:** `server/db.js`, `spotifyOAuthService.js`, `spotifyService.js`, `spotifyExportService.js`

**Analog:** `server/db.js`

Use inline idempotent schema creation and column-presence migrations. The existing cache table is the extension point for expiring Spotify match metadata:

```javascript
// server/db.js:196-203
db.exec(`
 CREATE TABLE IF NOT EXISTS song_cache (
 song_id TEXT PRIMARY KEY,
 lyrics_json TEXT,
 track_json TEXT,
 cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 expires_at DATETIME
 )
`);
```

Follow the established inspect-before-alter form for nullable Spotify URI/match columns:

```javascript
// server/db.js:42-46
const usersColumns = db.prepare("PRAGMA table_info(users)").all();
if (!usersColumns.some(col => col.name === 'cefr_level')) {
 db.exec("ALTER TABLE users ADD COLUMN cefr_level TEXT DEFAULT 'B1'");
}
```

Use `better-sqlite3` transactions for consume-once OAuth state, encrypted token upsert/refresh rotation, and export bookkeeping:

```javascript
// server/routes/progress.js:50-80
const txn = db.transaction(() => {
  const updates = [];
  // prepared reads/writes
  return updates;
});
const updated = txn();
```

Required additions are `spotify_oauth_transactions`, `user_spotify_tokens`, indexes on user/expiry/state hash, and nullable policy-bounded Spotify match fields on `song_cache`. Every statement remains parameterized; tokens and state never appear in logs.

### Express route boundary and ownership

**Applies to:** `server/routes/spotify.js`, `server/index.js`, `server/routes/spotify.test.js`

**Analog:** `server/routes/playlists.js`

Derive local ownership exclusively from `req.user.id`, validate before service work, and map expected failures to stable JSON:

```javascript
// server/routes/playlists.js:22-38
router.post('/', (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }
  try {
    // parameterized persistence/service call
    res.status(201).json({ playlist });
  } catch (err) {
    console.error('POST /api/playlists error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Preserve cross-user non-disclosure for Harmonix playlist export:

```javascript
// server/routes/playlists.js:43-46
const userId = req.user.id;
const playlist = db.prepare(
  'SELECT * FROM playlists WHERE id = ? AND user_id = ?'
).get(req.params.id, userId);
if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
```

Mount status/start/disconnect/playlists/detail/export behind the existing auth middleware:

```javascript
// server/index.js:293-302
app.use('/api/vocab', authenticateToken, vocabRouter);
app.use('/api/playlists', authenticateToken, playlistsRouter);
app.use('/api/user', authenticateToken, userRouter);
```

The callback is the exception. Mount `GET /api/spotify/oauth/callback` without JWT protection, but let `spotifyOAuthService` authorize it by atomically validating and consuming hashed state. Do not put the whole Spotify router behind `authenticateToken` unless callback mounting is split.

### External provider wrapper

**Applies to:** `spotifyService.js`, `spotifyOAuthService.js`

**Analog:** `server/services/deezerService.js`

Inject `fetch`, use `AbortController`, normalize provider errors, and export small testable functions:

```javascript
// server/services/deezerService.js:82-100
async function fetchWithTimeout(url, fetchImpl = fetch, timeoutMs = DEEZER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error('deezer_timeout');
      timeoutErr.code = 'deezer_timeout';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

Spotify-specific wrapper behavior goes beyond the analog: refresh inside a per-user serialization boundary; retain the old refresh token when Spotify omits a new one; delete the token row on `invalid_grant`; use `/me/playlists` and `/playlists/:id/items`; honor `Retry-After` with a capped retry; and return stable errors such as `spotify_disconnected`, `reconnect_required`, `spotify_rate_limited`, and `spotify_unavailable`.

### Deterministic matching and validation-first export

**Applies to:** `spotifyMatchService.js`, `spotifyExportService.js`, corpus fixture/tests

**Analog:** `server/services/deezerService.js`

Reuse pure normalization/scoring structure, but strengthen acceptance so ambiguity is rejected:

```javascript
// server/services/deezerService.js:3-12
function normText(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

```javascript
// server/services/deezerService.js:130-137
const ranked = candidates
  .map((track) => ({ track, score: scoreTrackMatch(track, artist, title) }))
  .filter(({ track, score }) => track.preview && score >= 2)
  .sort((a, b) => b.score - a.score || (b.track.rank || 0) - (a.track.rank || 0));
return ranked[0]?.track || null;
```

For Spotify, score title, all artists, optional ISRC, duration, edition conflicts, market availability, local/relinked state, and URI validity. Reject ties and below-threshold candidates; popularity is not a correctness signal.

Export orchestration must:
1. Load an owned Harmonix playlist with its source songs.
2. Resolve every source row to cached/matched/unmatched before provider mutation.
3. Stop with a zero-match report without creating a playlist.
4. Create one private playlist, then add accepted URIs in chunks of at most 100.
5. Return one outcome per source row plus exact created/exported/failed counts and API-provided destination URL.

### Backend tests

**Applies to:** all new server test files

**Analogs:** `server/routes/playlists.test.js`, `server/services/deezerService.test.js`, `server/services/dailyWordService.test.js`

Route tests directly select handlers, build `req.user`, and use the shared response fake:

```javascript
// server/routes/playlists.test.js:6-11
const mockRes = () => {
  const r = {};
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (d) => { r.body = d; return r; };
  return r;
};
```

```javascript
// server/routes/playlists.test.js:79-87
const req = { params: { id: pid }, user: { id: 'pl-other' } };
const res = mockRes();
handler(req, res);
expect(res.statusCode).to.equal(404);
```

Service tests inject provider fakes rather than calling Spotify:

```javascript
// server/services/deezerService.test.js:25-49
const mockFetch = async (url) => {
  if (url.includes('Tit')) {
    return {
      ok: true,
      json: async () => ({ data: [{ id: 1741494317, title: 'Tití Me Preguntó' }] }),
    };
  }
  return { ok: true, json: async () => ({ data: [] }) };
};
```

Reset only the test user's Spotify rows in `beforeEach`, matching the existing prepared cleanup style at `server/services/dailyWordService.test.js:35-48`. Add a fake clock/sleep seam for expiry and 429 tests. Assert plaintext token sentinels are absent from SQLite; callback mismatch/expiry/replay fails before token exchange; concurrent refresh rotates once; export creates nothing until matching completes; and corpus tests cover diacritics, featuring/remaster/live/remix collisions, same-title tracks, local/null/unavailable/relinked tracks, and duration disagreement.

### Web authenticated page and shared API

**Applies to:** web Settings, Library, detail, connection/export/report components, `client/src/lib/api.ts`

**Analogs:** `client/src/app/dashboard/page.tsx`, playlist pages, `AppHeader.tsx`

Use the existing auth gate and current light/dark shell:

```typescript
// client/src/app/dashboard/page.tsx:42-57
useEffect(() => {
  if (!isLoading) {
    if (!user) {
      router.push('/login');
    }
  }
}, [user, isLoading, router]);
```

```tsx
// client/src/app/dashboard/page.tsx:166-173
<div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black text-zinc-900 dark:text-white">
  <AppHeader userEmail={user.email} onLogout={logout} homeHref="/dashboard" />
  <main className="flex-1 ... max-w-5xl mx-auto w-full">
```

All calls go through `apiFetch`, which already attaches JWT, retries once after local access-token refresh, and preserves cookies:

```typescript
// client/src/lib/api.ts:53-69
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const config = { ...options, headers, credentials: 'include' };
  // fetch and one auth refresh retry
}
```

The connection card belongs directly below profile/account content on `/settings`. Start auth with an authenticated POST returning an allowlisted authorization URL, then navigate the browser to that URL. Never parse or store Spotify tokens client-side.

Extend the Library's existing scoped request state rather than replacing Harmonix data:

```typescript
// client/src/app/playlists/page.tsx:30-43
const fetchPlaylists = useCallback(async () => {
  try {
    const res = await apiFetch('/playlists');
    if (res.ok) setPlaylists((await res.json()).playlists || []);
    else setError('Could not load your playlists. Try again.');
  } finally {
    setLoading(false);
  }
}, []);
```

Fetch Harmonix and Spotify sections independently (or with `Promise.allSettled`) so one provider cannot blank the other. Navigate with trusted provider-aware IDs: local `/playlists/{id}`, Spotify `/playlists/spotify/{id}`. Keep card navigation separate from delete/export controls, as the existing list does at `client/src/app/playlists/page.tsx:149-160`.

The existing detail page provides cancellation-safe loading and status-specific errors:

```typescript
// client/src/app/playlists/[id]/page.tsx:38-61
let active = true;
async function fetchPlaylist() {
  try {
    const res = await apiFetch(`/playlists/${playlistId}`);
    if (!active) return;
    if (res.ok) setPlaylist(await res.json());
    else if (res.status === 404) setError('Playlist not found.');
  } finally {
    if (active) setLoading(false);
  }
}
return () => { active = false; };
```

Add export only to owned, non-empty Harmonix detail. There is no existing accessible web dialog analog; implement focus trap, Escape/cancel, non-destructive initial focus, and focus restoration from the UI contract rather than copying ad-hoc markup.

### Flutter API boundary

**Applies to:** `mobile/lib/services/api_client.dart`

**Analog:** same file

Add typed convenience methods over the generic authenticated request path:

```dart
// mobile/lib/services/api_client.dart:150-190
Future<Map<String, dynamic>> request(
  String method,
  String path, {
  Map<String, dynamic>? body,
  Map<String, String>? query,
  bool authRetry = true,
}) async {
  // centralized headers, JSON decoding, one auth refresh, ApiException mapping
}
```

```dart
// mobile/lib/services/api_client.dart:313-324
Future<List<dynamic>> playlists() async {
  final data = await request('GET', '/playlists');
  final items = data['playlists'] ?? data['items'];
  if (items is List) return items;
  return [];
}
```

Expose Spotify status/start/disconnect/list/detail/export methods only. OAuth launch uses the returned URL with `url_launcher`; provider tokens never use `FlutterSecureStorage`. Extend `ApiException`'s existing `reason` and `retryAfterSec` fields for reconnect, offline/provider, and rate-limit states.

### Flutter Settings → Library seam

**Applies to:** Settings, Library, detail, HomeShell, main, manifest

**Analogs:** same screens

Insert the connection card after the profile tile and before `APPEARANCE`, exactly at `mobile/lib/screens/settings_screen.dart:69-93`. Preserve Provider access, theme roles, mounted checks, refresh, and persistent content states:

```dart
// mobile/lib/screens/settings_screen.dart:28-44
final api = context.read<ApiClient>();
setState(() => _loading = true);
try {
  final stats = await api.progressStats();
  if (mounted) setState(() => _stats = stats);
} catch (e) {
  if (mounted) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
  }
} finally {
  if (mounted) setState(() => _loading = false);
}
```

Use `HarmonixColors.of(context)` and existing bordered cards:

```dart
// mobile/lib/screens/settings_screen.dart:165-173
decoration: BoxDecoration(
  color: colors.surface,
  border: Border.all(color: colors.border),
  borderRadius: BorderRadius.circular(12),
),
```

Library already has the required playlist-first then recent-discoveries order. Split its current `PLAYLISTS` region into `HARMONIX PLAYLISTS` and `SPOTIFY PLAYLISTS`, but leave `RECENT DISCOVERIES` after both:

```dart
// mobile/lib/screens/library_screen.dart:95-126
Text('PLAYLISTS', style: Theme.of(context).textTheme.titleSmall),
// playlist cards
const SizedBox(height: 24),
Text('RECENT DISCOVERIES', style: Theme.of(context).textTheme.titleSmall),
```

Pass provider and provider ID to detail; do not interpret a Spotify ID as a local ID. The existing detail screen supplies refresh/error/retry and API-provided external-launch patterns:

```dart
// mobile/lib/screens/playlist_detail_screen.dart:133-140
final uri = Uri.parse(context.read<ApiClient>().playerUrlForSongId(id));
if (await canLaunchUrl(uri)) {
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
```

For Spotify, only launch the backend-returned `external_url`; never concatenate user input. Preserve unavailable/null rows rather than dropping them.

`HomeShell` currently owns tab selection locally:

```dart
// mobile/lib/screens/home_shell.dart:14-24
class _HomeShellState extends State<HomeShell> {
  int _index = 2;
  final pages = [
    const DiscoverScreen(),
    const LibraryScreen(),
    LearnScreen(onOpenSearch: () => setState(() => _index = 0)),
    const SettingsScreen(),
  ];
}
```

Refactor this into a controllable navigation state (controller/provider or initial selected tab) so an OAuth completion event selects index `1` once for warm and cold starts. `main.dart`'s `_RootGate` is the handoff point after authentication. Add a verified HTTPS `VIEW`/`BROWSABLE` intent filter beside the launcher filter in `AndroidManifest.xml`; map only the configured host/path. No app-link analog currently exists in the project.

### Flutter tests

**Applies to:** three new Spotify test files

**Analog:** `mobile/test/widget_test.dart`

Keep `flutter_test` imports and deterministic assertions:

```dart
// mobile/test/widget_test.dart:1-13
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('friendlyDailyWordError maps known reasons', () {
    expect(
      friendlyDailyWordError(reason: 'cooldown_active', retryAfterSec: 12),
      contains('12 seconds'),
    );
  });
}
```

The current suite has no widget harness, fake `ApiClient`, navigation, or deep-link analog. Introduce a small injectable fake HTTP client/API state and wrap widgets with the required `Provider` and `MaterialApp`. Cover card placement/states, separated provider groups and stable navigation, restricted detail/deep link, and cold/warm completion selecting Library.

## Shared Patterns

### Authentication and authorization

**Source:** `server/index.js:48-62`, `server/routes/playlists.js:43-46`

- Protected endpoints use Harmonix JWT and `req.user.id`.
- Callback uses one-time hashed state as its sole authorization boundary.
- Local playlist export repeats owner filtering at the DB boundary.
- Client-provided user IDs, callback return URLs, and provider enums are never trusted.

### Response and error contracts

**Sources:** `server/routes/playlists.js:14-19`, `mobile/lib/services/api_client.dart:114-147`

- Routes return JSON `{ error, reason?, retryAfterSec? }`, never raw Spotify payloads or token errors.
- Map provider failures centrally; UI copy derives from stable reasons.
- Harmonix Library data remains visible on Spotify errors.

### Validation and rate control

**Sources:** `server/routes/playlists.js:24-29`, `server/services/deezerService.js:82-108`

- Validate/trim/cap body and path values before provider calls.
- One provider wrapper owns timeout, refresh, per-user admission, pagination, 429 handling, and normalized errors.
- Export validates all matches before any external mutation.

### UI state isolation

**Sources:** web playlist pages and Flutter Library/detail screens

- Loading/error state is scoped to the unresolved section.
- Disable duplicate mutations immediately.
- Keep refresh, retry, and reconnect distinct.
- Use API-provided external links and never add Spotify playback.

## No Analog Found

| File/Concern | Reason / Planner Direction |
|---|---|
| `server/services/fixtures/spotify-match-corpus.json` | No labeled data fixture exists; define explicit expected accept/reject outcomes. |
| `client/src/components/SpotifyExportDialog.tsx` | No accessible dialog implementation exists; implement directly from `12-UI-SPEC.md`. |
| `mobile/test/spotify_deep_link_test.dart` | No deep-link test or routing harness exists. |
| Android App Link configuration | Manifest only has a launcher filter; exact HTTPS host, signing fingerprint, and `assetlinks.json` remain prerequisites. |
| Official Spotify assets | No provider asset exists; source current official files and pass manual branding review. |
| Web component/E2E tests | No framework is configured; planner must explicitly decide whether lint/build plus manual/browser verification is sufficient. |

## Integration Risks the Plan Must Preserve

- `server/index.js` currently protects routers at mount time; the public callback requires a deliberately separate mount.
- Existing web playlist pages use a dark legacy shell, while Phase 12 requires the dashboard's light/green, dark-compatible shell.
- Spotify `/me/playlists` may list followed playlists whose items endpoint returns 403. Represent these as restricted in-app detail plus `Open in Spotify`; do not fake an empty list.
- `better-sqlite3` currently fails to load under Node 24.13.0. Repair the ABI baseline before test results are accepted.
- Current Flutter navigation has no external-event controller and the manifest has no App Link filter.
- Development Mode credentials, exact HTTPS callback, encryption key, five-user allowlist, and production quota approval are external gates, not source-code defaults.

## Metadata

**Analog search scope:** `server/{routes,services}`, `server/db.js`, `server/index.js`, `client/src/{app,components,lib}`, `mobile/{lib,test,android}`
**Primary analogs read:** 18
**Pattern extraction date:** 2026-07-19
