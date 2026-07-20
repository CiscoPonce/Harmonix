import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mapBackendStatusToUiState,
  parseConnectionDto,
  parseExportReportDto,
  parsePlaylistDetailDto,
  parsePlaylistListItemDto,
  parseSpotifyAuthStartResponse,
  parseSpotifyCallbackOutcome,
  parseSpotifyPlaylistListResponse,
  parseSpotifyStatusResponse,
  parseProviderStableId,
  providerStableId,
  safeSpotifyAuthorizationUrl,
  safeSpotifyUrl,
} from './spotifyContracts.ts';

describe('providerStableId', () => {
  it('round-trips provider + provider_id', () => {
    const stable = providerStableId('spotify', 'abc123');
    assert.equal(stable, 'spotify:abc123');
    const parsed = parseProviderStableId(stable);
    assert.deepEqual(parsed, {
      provider: 'spotify',
      provider_id: 'abc123',
      stable_id: 'spotify:abc123',
    });
  });

  it('rejects unknown providers', () => {
    assert.throws(() => parseProviderStableId('deezer:x'), /unknown provider/);
    assert.throws(
      () => providerStableId('deezer' as 'spotify', 'x'),
      /unknown provider/
    );
  });

  it('rejects raw-ID-only navigation', () => {
    assert.throws(() => parseProviderStableId('abc123'), /raw-ID-only/);
  });

  it('prevents spotify:x and harmonix:x collisions', () => {
    const a = providerStableId('spotify', 'x');
    const b = providerStableId('harmonix', 'x');
    assert.notEqual(a, b);
    assert.equal(parseProviderStableId(a).provider, 'spotify');
    assert.equal(parseProviderStableId(b).provider, 'harmonix');
  });
});

describe('safeSpotifyUrl', () => {
  it('accepts HTTPS open.spotify.com URLs', () => {
    assert.equal(
      safeSpotifyUrl('https://open.spotify.com/playlist/abc'),
      'https://open.spotify.com/playlist/abc'
    );
  });

  it('rejects unsafe schemes and hosts', () => {
    assert.equal(safeSpotifyUrl('javascript:alert(1)'), null);
    assert.equal(safeSpotifyUrl('http://open.spotify.com/playlist/abc'), null);
    assert.equal(safeSpotifyUrl('https://evil.example/spotify'), null);
    assert.equal(safeSpotifyUrl('spotify:playlist:abc'), null);
    assert.equal(safeSpotifyUrl(null), null);
    assert.equal(safeSpotifyUrl(undefined), null);
  });
});

describe('DTO parsers', () => {
  it('parses connection states and null provider metadata', () => {
    const dto = parseConnectionDto({
      state: 'connected',
      display_name: null,
      reason: null,
    });
    assert.equal(dto.state, 'connected');
    assert.equal(dto.display_name, null);
  });

  it('rejects missing/null provider on list items', () => {
    assert.throws(
      () => parsePlaylistListItemDto({ provider: null, provider_id: 'x', name: 'A' }),
      /missing\/null provider/
    );
  });

  it('parses list items with stable_id and safe external_url', () => {
    const item = parsePlaylistListItemDto({
      provider: 'spotify',
      provider_id: 'pl1',
      name: 'Hits',
      external_url: 'https://open.spotify.com/playlist/pl1',
    });
    assert.equal(item.stable_id, 'spotify:pl1');
    assert.equal(item.external_url, 'https://open.spotify.com/playlist/pl1');
  });

  it('parses detail restricted flag and strips unsafe external URLs', () => {
    const detail = parsePlaylistDetailDto({
      provider: 'spotify',
      provider_id: 'pl2',
      name: 'Followed',
      restricted: true,
      external_url: 'javascript:alert(1)',
      tracks: [{ name: 'T', artists: 'A' }],
    });
    assert.equal(detail.restricted, true);
    assert.equal(detail.detail_state, 'restricted');
    assert.equal(detail.external_url, null);
  });

  it('caps detail items at 20 and preserves availability rows', () => {
    const items = Array.from({ length: 25 }, (_, i) => ({
      position: i,
      title: `T${i}`,
      artists: 'A',
      duration_ms: 1000,
      availability: i === 1 ? 'null' : 'available',
      reason: i === 1 ? 'null_track' : null,
    }));
    const detail = parsePlaylistDetailDto({
      provider: 'spotify',
      provider_id: 'long',
      name: 'Long',
      detail_state: 'normal',
      external_url: 'https://open.spotify.com/playlist/long',
      items,
    });
    assert.equal(detail.items.length, 20);
    assert.equal(detail.items[0].title, 'T0');
    assert.equal(detail.items[1].availability, 'null');
    assert.equal(detail.items[19].title, 'T19');
  });

  it('parses export reports with stable reason codes and partial states', () => {
    const report = parseExportReportDto({
      destination_url: 'https://open.spotify.com/playlist/dest',
      partial_state: 'partially_added',
      rows: [
        {
          source_identity: 'harmonix:song-1',
          outcome: 'unmatched',
          reason: 'ambiguous_tie',
          spotify_uri: null,
        },
      ],
    });
    assert.equal(report.partial_state, 'partially_added');
    assert.equal(report.rows[0].reason, 'ambiguous_tie');
  });

  it('parses export job status with ownership fields and progress counts', async () => {
    const { parseExportJobDto, isExportJobActive, exportProgressLabel } = await import(
      './spotifyContracts.ts'
    );
    const job = parseExportJobDto({
      id: 'job-1',
      source_playlist_id: 'pl-1',
      stage: 'adding',
      current_count: 50,
      total_count: 120,
      matched_count: 100,
      unmatched_count: 20,
      exported_count: 50,
      failed_count: 0,
      destination_provider_id: 'dest',
      destination_url: 'https://open.spotify.com/playlist/dest',
      safe_reason: null,
      partial_state: 'partially_added',
      report: {
        destination_url: 'https://open.spotify.com/playlist/dest',
        partial_state: 'partially_added',
        rows: [],
      },
    });
    assert.equal(job.id, 'job-1');
    assert.equal(isExportJobActive(job.stage), true);
    assert.match(exportProgressLabel(job), /Adding matched tracks/);
  });
});

describe('safeSpotifyAuthorizationUrl', () => {
  it('accepts HTTPS accounts.spotify.com authorization URLs', () => {
    const url =
      'https://accounts.spotify.com/authorize?client_id=abc&response_type=code&redirect_uri=https%3A%2F%2Fexample.test%2Fcallback';
    assert.equal(safeSpotifyAuthorizationUrl(url), url);
  });

  it('rejects non-Spotify authorization hosts and unsafe schemes', () => {
    assert.equal(safeSpotifyAuthorizationUrl('https://evil.example/authorize'), null);
    assert.equal(safeSpotifyAuthorizationUrl('http://accounts.spotify.com/authorize'), null);
    assert.equal(
      safeSpotifyAuthorizationUrl('https://accounts.spotify.com.evil.example/authorize'),
      null
    );
    assert.equal(safeSpotifyAuthorizationUrl('javascript:alert(1)'), null);
    assert.equal(safeSpotifyAuthorizationUrl(null), null);
  });
});

describe('parseSpotifyCallbackOutcome', () => {
  it('allowlists fixed non-secret callback outcomes', () => {
    assert.equal(parseSpotifyCallbackOutcome('connected'), 'connected');
    assert.equal(parseSpotifyCallbackOutcome('error'), 'error');
    assert.equal(parseSpotifyCallbackOutcome('cancelled'), 'error');
  });

  it('rejects secrets and unknown query values', () => {
    assert.equal(parseSpotifyCallbackOutcome('AQDxcode'), null);
    assert.equal(parseSpotifyCallbackOutcome('access_token'), null);
    assert.equal(parseSpotifyCallbackOutcome(null), null);
    assert.equal(parseSpotifyCallbackOutcome(undefined), null);
  });
});

describe('mapBackendStatusToUiState', () => {
  it('maps backend allowlist statuses onto Settings card UI states', () => {
    assert.equal(mapBackendStatusToUiState('disconnected'), 'connect');
    assert.equal(mapBackendStatusToUiState('connected'), 'connected');
    assert.equal(mapBackendStatusToUiState('reconnect_required'), 'reconnect');
    assert.equal(mapBackendStatusToUiState('provider_error'), 'provider_error');
  });
});

describe('parseSpotifyStatusResponse', () => {
  it('parses safe status fields without requiring tokens', () => {
    const dto = parseSpotifyStatusResponse({
      status: 'connected',
      display_name: 'Listener',
      reason: null,
    });
    assert.equal(dto.state, 'connected');
    assert.equal(dto.display_name, 'Listener');
  });

  it('maps disconnected backend status to connect UI state', () => {
    const dto = parseSpotifyStatusResponse({
      status: 'disconnected',
      display_name: null,
      reason: null,
    });
    assert.equal(dto.state, 'connect');
  });
});

describe('parseSpotifyAuthStartResponse', () => {
  it('returns a validated accounts.spotify.com authorization URL', () => {
    const url =
      'https://accounts.spotify.com/authorize?client_id=x&response_type=code&redirect_uri=y';
    assert.equal(
      parseSpotifyAuthStartResponse({ authorization_url: url }),
      url
    );
  });

  it('rejects caller destinations that are not Spotify authorize hosts', () => {
    assert.throws(
      () =>
        parseSpotifyAuthStartResponse({
          authorization_url: 'https://evil.example/oauth',
        }),
      /authorization/
    );
  });
});

describe('parseSpotifyPlaylistListResponse', () => {
  it('parses provider-aware list items and preserves stable IDs', () => {
    const items = parseSpotifyPlaylistListResponse({
      playlists: [
        {
          provider: 'spotify',
          provider_id: 'pl1',
          name: 'Hits',
          external_url: 'https://open.spotify.com/playlist/pl1',
          track_count: 4,
          artwork_url: null,
          onward_url: 'https://open.spotify.com/',
        },
      ],
      onward_url: 'https://open.spotify.com/',
    });
    assert.equal(items.playlists.length, 1);
    assert.equal(items.playlists[0].stable_id, 'spotify:pl1');
    assert.equal(items.playlists[0].track_count, 4);
    assert.equal(items.onward_url, 'https://open.spotify.com/');
  });

  it('strips unsafe onward URLs', () => {
    const items = parseSpotifyPlaylistListResponse({
      playlists: [],
      onward_url: 'javascript:alert(1)',
    });
    assert.equal(items.onward_url, null);
  });
});

describe('capSpotifyPlaylistShelf', () => {
  it('caps Spotify shelves at 20 items', async () => {
    const { capSpotifyPlaylistShelf } = await import('./spotifyContracts.ts');
    const many = Array.from({ length: 25 }, (_, i) => ({ id: i }));
    assert.equal(capSpotifyPlaylistShelf(many).length, 20);
    assert.equal(capSpotifyPlaylistShelf(many, 20)[19].id, 19);
  });
});

describe('mapSpotifyListError', () => {
  it('maps disconnected, rate-limit, offline, and reconnect errors to safe copy', async () => {
    const { mapSpotifyListError } = await import('./spotifyContracts.ts');
    assert.equal(mapSpotifyListError({ status: 409, body: { error: 'spotify_disconnected' } }).kind, 'disconnected');
    assert.equal(mapSpotifyListError({ status: 409, body: { error: 'reconnect_required' } }).kind, 'reconnect');
    assert.match(
      mapSpotifyListError({ status: 429, body: { error: 'spotify_rate_limited', retry_after: 30 } }).message,
      /moment|30/
    );
    assert.equal(mapSpotifyListError({ status: 0, offline: true }).kind, 'offline');
    assert.equal(mapSpotifyListError({ status: 503 }).kind, 'provider_error');
  });
});

describe('export reason-to-copy matrix (D-12-13 / D-12-15)', () => {
  it('maps zero-match, no_create, partial, and progress stages to distinct stable copy', async () => {
    const { exportProgressLabel, parseExportJobDto } = await import('./spotifyContracts.ts');

    const zero = parseExportJobDto({
      id: 'z',
      source_playlist_id: 'pl',
      stage: 'failed',
      current_count: 2,
      total_count: 2,
      matched_count: 0,
      unmatched_count: 2,
      exported_count: 0,
      failed_count: 0,
      destination_provider_id: null,
      destination_url: null,
      safe_reason: 'zero_matches',
      partial_state: 'no_create',
      report: { destination_url: null, partial_state: 'no_create', rows: [] },
    });
    assert.match(exportProgressLabel(zero), /No tracks were confidently matched/);

    const noCreate = parseExportJobDto({
      id: 'n',
      source_playlist_id: 'pl',
      stage: 'failed',
      current_count: 1,
      total_count: 1,
      matched_count: 1,
      unmatched_count: 0,
      exported_count: 0,
      failed_count: 0,
      destination_provider_id: null,
      destination_url: null,
      safe_reason: null,
      partial_state: 'no_create',
      report: { destination_url: null, partial_state: 'no_create', rows: [] },
    });
    assert.match(exportProgressLabel(noCreate), /No new playlist was created/);

    const partial = parseExportJobDto({
      id: 'p',
      source_playlist_id: 'pl',
      stage: 'partial',
      current_count: 2,
      total_count: 3,
      matched_count: 2,
      unmatched_count: 1,
      exported_count: 1,
      failed_count: 0,
      destination_provider_id: 'd',
      destination_url: 'https://open.spotify.com/playlist/d',
      safe_reason: 'rate_limited',
      partial_state: 'partially_added',
      report: {
        destination_url: 'https://open.spotify.com/playlist/d',
        partial_state: 'partially_added',
        rows: [],
      },
    });
    assert.match(exportProgressLabel(partial), /Exported 1 of 2 matched tracks/);

    const matching = parseExportJobDto({
      id: 'm',
      source_playlist_id: 'pl',
      stage: 'matching',
      current_count: 1,
      total_count: 4,
      matched_count: 0,
      unmatched_count: 0,
      exported_count: 0,
      failed_count: 0,
      destination_provider_id: null,
      destination_url: null,
      safe_reason: null,
      partial_state: null,
      report: null,
    });
    assert.match(exportProgressLabel(matching), /Matching tracks \(1 of 4\)/);

    assert.notEqual(exportProgressLabel(zero), exportProgressLabel(noCreate));
    assert.notEqual(exportProgressLabel(partial), exportProgressLabel(matching));
  });
});
