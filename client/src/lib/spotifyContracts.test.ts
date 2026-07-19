import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseConnectionDto,
  parseExportReportDto,
  parsePlaylistDetailDto,
  parsePlaylistListItemDto,
  parseProviderStableId,
  providerStableId,
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
    assert.equal(detail.external_url, null);
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
});
