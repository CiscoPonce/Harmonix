/**
 * Pure Spotify / provider-aware contracts for web (Phase 12).
 * Dependency-free — safe for Node 24 type-stripped unit tests.
 */

export type SpotifyProvider = 'spotify' | 'harmonix';

export type ConnectionState =
  | 'connect'
  | 'connected'
  | 'reconnect'
  | 'connecting'
  | 'disconnecting'
  | 'disconnected'
  | 'provider_error';

/** Backend GET /api/spotify/status allowlist (never includes tokens). */
export type BackendSpotifyStatus =
  | 'disconnected'
  | 'connected'
  | 'reconnect_required'
  | 'provider_error';

/** Fixed non-secret OAuth return query outcomes (`?spotify=`). */
export type SpotifyCallbackOutcome = 'connected' | 'error';

export interface SpotifyPlaylistListResponse {
  playlists: Array<SpotifyPlaylistListItemDto & { track_count: number | null; artwork_url: string | null }>;
  onward_url: string | null;
}

export type ExportOutcome = 'matched' | 'unmatched' | 'cached' | 'export_failed';

export type MatchRejectReason =
  | 'ambiguous_tie'
  | 'weak_candidate'
  | 'missing_artist'
  | 'missing_title'
  | 'invalid_uri'
  | 'edition_conflict'
  | 'local_track'
  | 'unavailable'
  | 'duration_conflict';

export interface ProviderIdentity {
  provider: SpotifyProvider;
  provider_id: string;
  stable_id: string;
}

export interface SpotifyConnectionDto {
  state: ConnectionState;
  display_name: string | null;
  reason: string | null;
}

export interface SpotifyPlaylistListItemDto {
  provider: SpotifyProvider;
  provider_id: string;
  stable_id: string;
  name: string;
  external_url: string | null;
}

export interface SpotifyPlaylistDetailDto {
  provider: SpotifyProvider;
  provider_id: string;
  stable_id: string;
  name: string;
  restricted: boolean;
  external_url: string | null;
  tracks: Array<{ name: string; artists: string }>;
}

export interface SpotifyExportReportRowDto {
  source_identity: string;
  outcome: ExportOutcome;
  reason: string | null;
  spotify_uri: string | null;
}

export interface SpotifyExportReportDto {
  destination_url: string | null;
  partial_state: 'none' | 'no_create' | 'created_empty' | 'partially_added' | null;
  rows: SpotifyExportReportRowDto[];
}

const ALLOWED_PROVIDERS = new Set<string>(['spotify', 'harmonix']);

export function isSpotifyProvider(value: unknown): value is SpotifyProvider {
  return typeof value === 'string' && ALLOWED_PROVIDERS.has(value);
}

export function providerStableId(provider: SpotifyProvider, providerId: string): string {
  if (!isSpotifyProvider(provider)) {
    throw new Error(`unknown provider: ${String(provider)}`);
  }
  if (typeof providerId !== 'string' || providerId.trim().length === 0) {
    throw new Error('provider_id is required');
  }
  if (providerId.includes(':')) {
    throw new Error('provider_id must not contain ":"');
  }
  return `${provider}:${providerId}`;
}

export function parseProviderStableId(stableId: string): ProviderIdentity {
  if (typeof stableId !== 'string' || !stableId.includes(':')) {
    throw new Error('raw-ID-only navigation is rejected; provider prefix required');
  }
  const idx = stableId.indexOf(':');
  const provider = stableId.slice(0, idx);
  const provider_id = stableId.slice(idx + 1);
  if (!isSpotifyProvider(provider)) {
    throw new Error(`unknown provider: ${provider}`);
  }
  if (!provider_id) {
    throw new Error('provider_id is required');
  }
  return {
    provider,
    provider_id,
    stable_id: providerStableId(provider, provider_id),
  };
}

/** Allow only API-provided HTTPS open.spotify.com URLs. */
export function safeSpotifyUrl(url: string | null | undefined): string | null {
  if (url == null || typeof url !== 'string' || url.trim().length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    return null;
  }
  if (parsed.hostname !== 'open.spotify.com') {
    return null;
  }
  return parsed.toString();
}

function asStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  return value;
}

export function parseConnectionDto(raw: unknown): SpotifyConnectionDto {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid connection DTO');
  }
  const obj = raw as Record<string, unknown>;
  const state = obj.state;
  const allowed: ConnectionState[] = [
    'connect',
    'connected',
    'reconnect',
    'connecting',
    'disconnecting',
    'disconnected',
    'provider_error',
  ];
  if (typeof state !== 'string' || !allowed.includes(state as ConnectionState)) {
    throw new Error('invalid connection state');
  }
  return {
    state: state as ConnectionState,
    display_name: asStringOrNull(obj.display_name),
    reason: asStringOrNull(obj.reason),
  };
}

/** Allow only backend-returned HTTPS accounts.spotify.com authorize URLs. */
export function safeSpotifyAuthorizationUrl(url: string | null | undefined): string | null {
  if (url == null || typeof url !== 'string' || url.trim().length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    return null;
  }
  if (parsed.hostname !== 'accounts.spotify.com') {
    return null;
  }
  if (!parsed.pathname.startsWith('/authorize')) {
    return null;
  }
  return parsed.toString();
}

export function parseSpotifyCallbackOutcome(
  value: string | null | undefined
): SpotifyCallbackOutcome | null {
  if (value == null || typeof value !== 'string') return null;
  if (value === 'connected') return 'connected';
  if (value === 'error' || value === 'cancelled') return 'error';
  return null;
}

export function mapBackendStatusToUiState(status: string): ConnectionState {
  switch (status) {
    case 'disconnected':
      return 'connect';
    case 'connected':
      return 'connected';
    case 'reconnect_required':
      return 'reconnect';
    case 'provider_error':
      return 'provider_error';
    default:
      throw new Error(`invalid backend status: ${status}`);
  }
}

export function parseSpotifyStatusResponse(raw: unknown): SpotifyConnectionDto {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid status response');
  }
  const obj = raw as Record<string, unknown>;
  const status = asStringOrNull(obj.status);
  if (!status) {
    throw new Error('invalid status response');
  }
  return {
    state: mapBackendStatusToUiState(status),
    display_name: asStringOrNull(obj.display_name),
    reason: asStringOrNull(obj.reason),
  };
}

export function parseSpotifyAuthStartResponse(raw: unknown): string {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid authorization start response');
  }
  const obj = raw as Record<string, unknown>;
  const url = safeSpotifyAuthorizationUrl(asStringOrNull(obj.authorization_url));
  if (!url) {
    throw new Error('authorization URL failed host validation');
  }
  return url;
}

export function parseSpotifyPlaylistListResponse(raw: unknown): SpotifyPlaylistListResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid playlist list response');
  }
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj.playlists) ? obj.playlists : [];
  const playlists = list.map((item) => {
    const base = parsePlaylistListItemDto(item);
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const trackRaw = row.track_count;
    const track_count =
      typeof trackRaw === 'number' && Number.isFinite(trackRaw) ? trackRaw : null;
    return {
      ...base,
      track_count,
      artwork_url: asStringOrNull(row.artwork_url),
    };
  });
  return {
    playlists,
    onward_url: safeSpotifyUrl(asStringOrNull(obj.onward_url)),
  };
}

export function parsePlaylistListItemDto(raw: unknown): SpotifyPlaylistListItemDto {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid playlist list item DTO');
  }
  const obj = raw as Record<string, unknown>;
  if (!isSpotifyProvider(obj.provider)) {
    throw new Error('missing/null provider on list item');
  }
  const provider_id = asStringOrNull(obj.provider_id);
  if (!provider_id) {
    throw new Error('missing/null provider_id on list item');
  }
  const name = asStringOrNull(obj.name) ?? '';
  const stable =
    asStringOrNull(obj.stable_id) ?? providerStableId(obj.provider, provider_id);
  const identity = parseProviderStableId(stable);
  if (identity.provider !== obj.provider || identity.provider_id !== provider_id) {
    throw new Error('stable_id does not match provider fields');
  }
  return {
    provider: obj.provider,
    provider_id,
    stable_id: identity.stable_id,
    name,
    external_url: safeSpotifyUrl(asStringOrNull(obj.external_url)),
  };
}

/** Cap Spotify shelf cards at 20 per Spotify design guidelines. */
export function capSpotifyPlaylistShelf<T>(items: T[], max = 20): T[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, max);
}

export type SpotifyListErrorKind =
  | 'disconnected'
  | 'reconnect'
  | 'offline'
  | 'rate_limited'
  | 'provider_error';

export interface SpotifyListErrorView {
  kind: SpotifyListErrorKind;
  message: string;
  retryAfterSeconds: number | null;
}

/** Map provider list failures to safe, copywritten recovery states. */
export function mapSpotifyListError(input: {
  status?: number;
  body?: unknown;
  offline?: boolean;
}): SpotifyListErrorView {
  if (input.offline || input.status === 0) {
    return {
      kind: 'offline',
      message: 'You’re offline. Reconnect to sync Spotify playlists or export music.',
      retryAfterSeconds: null,
    };
  }

  const body =
    input.body && typeof input.body === 'object'
      ? (input.body as Record<string, unknown>)
      : {};
  const error = typeof body.error === 'string' ? body.error : null;
  const retryRaw = body.retry_after;
  const retryAfterSeconds =
    typeof retryRaw === 'number' && Number.isFinite(retryRaw) ? retryRaw : null;

  if (input.status === 409 && error === 'spotify_disconnected') {
    return {
      kind: 'disconnected',
      message: 'Connect Spotify from Settings to see your playlists.',
      retryAfterSeconds: null,
    };
  }
  if (input.status === 409 && error === 'reconnect_required') {
    return {
      kind: 'reconnect',
      message: 'Your Spotify connection expired. Reconnect to continue.',
      retryAfterSeconds: null,
    };
  }
  if (input.status === 429 || error === 'spotify_rate_limited') {
    const duration =
      retryAfterSeconds != null ? `${retryAfterSeconds}` : 'a moment';
    return {
      kind: 'rate_limited',
      message: `Spotify needs a moment. Try again in ${duration}.`,
      retryAfterSeconds,
    };
  }
  return {
    kind: 'provider_error',
    message:
      'Spotify is unavailable right now. Your Harmonix library is still available. Try again.',
    retryAfterSeconds: null,
  };
}

export function parsePlaylistDetailDto(raw: unknown): SpotifyPlaylistDetailDto {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid playlist detail DTO');
  }
  const obj = raw as Record<string, unknown>;
  if (!isSpotifyProvider(obj.provider)) {
    throw new Error('missing/null provider on detail');
  }
  const provider_id = asStringOrNull(obj.provider_id);
  if (!provider_id) {
    throw new Error('missing/null provider_id on detail');
  }
  const stable =
    asStringOrNull(obj.stable_id) ?? providerStableId(obj.provider, provider_id);
  const tracksRaw = Array.isArray(obj.tracks) ? obj.tracks : [];
  const tracks = tracksRaw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({
      name: asStringOrNull(t.name) ?? '',
      artists: asStringOrNull(t.artists) ?? '',
    }));
  return {
    provider: obj.provider,
    provider_id,
    stable_id: parseProviderStableId(stable).stable_id,
    name: asStringOrNull(obj.name) ?? '',
    restricted: Boolean(obj.restricted),
    external_url: safeSpotifyUrl(asStringOrNull(obj.external_url)),
    tracks,
  };
}

export function parseExportReportDto(raw: unknown): SpotifyExportReportDto {
  if (!raw || typeof raw !== 'object') {
    throw new Error('invalid export report DTO');
  }
  const obj = raw as Record<string, unknown>;
  const rowsRaw = Array.isArray(obj.rows) ? obj.rows : [];
  const rows: SpotifyExportReportRowDto[] = rowsRaw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => {
      const outcome = asStringOrNull(r.outcome);
      const allowed: ExportOutcome[] = ['matched', 'unmatched', 'cached', 'export_failed'];
      if (!outcome || !allowed.includes(outcome as ExportOutcome)) {
        throw new Error(`unstable export outcome: ${String(r.outcome)}`);
      }
      return {
        source_identity: asStringOrNull(r.source_identity) ?? '',
        outcome: outcome as ExportOutcome,
        reason: asStringOrNull(r.reason),
        spotify_uri: asStringOrNull(r.spotify_uri),
      };
    });
  const partial = asStringOrNull(obj.partial_state);
  const partialAllowed = ['none', 'no_create', 'created_empty', 'partially_added'] as const;
  return {
    destination_url: safeSpotifyUrl(asStringOrNull(obj.destination_url)),
    partial_state:
      partial && (partialAllowed as readonly string[]).includes(partial)
        ? (partial as (typeof partialAllowed)[number])
        : null,
    rows,
  };
}
