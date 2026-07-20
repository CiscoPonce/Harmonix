const { expect } = require('chai');
const db = require('../db');
const { encryptToken } = require('./spotifyCrypto');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_DETAIL';

describe('spotify playlist detail service contracts', () => {
  let createSpotifyClient;
  let clock;
  let client;
  let fetchImpl;

  before(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_REDIRECT_URI = 'https://example.test/api/spotify/oauth/callback';
    delete require.cache[require.resolve('./spotifyService')];
    ({ createSpotifyClient } = require('./spotifyService'));
  });

  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      id,
      `${id}@test.com`,
      'x'
    );
  }

  function seedTokens(userId, spotifyUserId = 'me-user') {
    const a = encryptToken('access-plain');
    const r = encryptToken('refresh-plain');
    const now = clock.toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO user_spotify_tokens (
        user_id,
        access_ciphertext, access_iv, access_tag, access_key_version,
        refresh_ciphertext, refresh_iv, refresh_tag, refresh_key_version,
        scopes, spotify_user_id, spotify_display_name,
        authorized_at, expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      a.ciphertext, a.iv, a.tag, a.keyVersion,
      r.ciphertext, r.iv, r.tag, r.keyVersion,
      'playlist-read-private',
      spotifyUserId,
      'Listener',
      now,
      new Date(clock.getTime() + 3600_000).toISOString(),
      now
    );
  }

  function seedPlaylist(userId, playlistId, overrides = {}) {
    const now = clock.toISOString();
    const expiresAt =
      overrides.expires_at || new Date(clock.getTime() + 7 * 86400000).toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO user_spotify_playlists (
        user_id, spotify_playlist_id, name, external_url, artwork_url, track_count,
        is_owner, is_collaborative, is_restricted, detail_access, snapshot_id,
        synced_at, revalidated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `).run(
      userId,
      playlistId,
      overrides.name || 'Cached Playlist',
      overrides.external_url || `https://open.spotify.com/playlist/${playlistId}`,
      overrides.artwork_url || null,
      overrides.track_count != null ? overrides.track_count : 3,
      overrides.is_owner != null ? overrides.is_owner : 0,
      overrides.is_collaborative != null ? overrides.is_collaborative : 0,
      overrides.is_restricted != null ? overrides.is_restricted : 1,
      overrides.detail_access || 'restricted',
      overrides.synced_at || now,
      overrides.revalidated_at || now,
      expiresAt
    );
  }

  function jsonResponse(status, body, headers = {}) {
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => headers[String(k).toLowerCase()] || null },
      json: async () => body,
    };
  }

  beforeEach(() => {
    ensureUser('detail-svc-a');
    ensureUser('detail-svc-b');
    db.prepare('DELETE FROM user_spotify_tokens').run();
    db.prepare('DELETE FROM user_spotify_playlists').run();
    clock = new Date('2026-07-20T12:00:00.000Z');
    fetchImpl = async () => {
      throw new Error('unexpected fetch');
    };
    client = createSpotifyClient({
      fetch: (...args) => fetchImpl(...args),
      now: () => new Date(clock.getTime()),
      sleep: async () => {},
    });
  });

  it('loads items via GET /playlists/{id}/items with defensive null/local track parsing', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: getPlaylistDetail not implemented`);
    }
    seedTokens('detail-svc-a');
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/owned1') && !u.includes('/items')) {
        return jsonResponse(200, {
          id: 'owned1',
          name: 'Owned',
          collaborative: false,
          owner: { id: 'me-user' },
          external_urls: { spotify: 'https://open.spotify.com/playlist/owned1' },
          images: [{ url: 'https://i.scdn.co/image/1' }],
          tracks: { total: 4 },
          snapshot_id: 'snap',
        });
      }
      if (u.includes('/playlists/owned1/items')) {
        expect(u).to.match(/\/playlists\/owned1\/items/);
        expect(u).to.not.match(/\/tracks/);
        return jsonResponse(200, {
          items: [
            {
              track: {
                id: 't1',
                name: 'Track One',
                artists: [{ name: 'Artist A' }],
                duration_ms: 120000,
                is_local: false,
              },
            },
            { track: null },
            {
              track: {
                id: null,
                name: 'Local File',
                artists: [],
                duration_ms: 0,
                is_local: true,
              },
            },
            {
              track: {
                id: 't4',
                name: 'Unavailable',
                artists: [{ name: 'B' }],
                duration_ms: 90000,
                is_local: false,
                is_playable: false,
                restrictions: { reason: 'market' },
              },
            },
          ],
          next: null,
        });
      }
      throw new Error(`unexpected url ${u}`);
    };

    const detail = await client.getPlaylistDetail('detail-svc-a', 'owned1');
    expect(detail.detail_state).to.equal('normal');
    expect(detail.restricted).to.equal(false);
    expect(detail.provider).to.equal('spotify');
    expect(detail.provider_id).to.equal('owned1');
    expect(detail.stable_id).to.equal('spotify:owned1');
    expect(detail.items).to.have.length(4);
    expect(detail.items[0].title).to.equal('Track One');
    expect(detail.items[0].availability).to.equal('available');
    expect(detail.items[1].availability).to.equal('null');
    expect(detail.items[2].availability).to.equal('local');
    expect(detail.items[3].availability).to.equal('unavailable');
    expect(detail.items.map((i) => i.position)).to.deep.equal([0, 1, 2, 3]);
  });

  it('maps owner/collaborator restriction to restricted detail without faking empty lists', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: getPlaylistDetail restriction mapping missing`);
    }
    seedTokens('detail-svc-a');
    seedPlaylist('detail-svc-a', 'followed1', {
      name: 'Followed Editorial',
      is_restricted: 1,
      detail_access: 'restricted',
      is_owner: 0,
      track_count: 42,
    });
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/followed1') && !u.includes('/items')) {
        return jsonResponse(200, {
          id: 'followed1',
          name: 'Followed Editorial',
          collaborative: false,
          owner: { id: 'someone-else' },
          external_urls: { spotify: 'https://open.spotify.com/playlist/followed1' },
          images: [],
          tracks: { total: 42 },
        });
      }
      if (u.includes('/playlists/followed1/items')) {
        return jsonResponse(403, { error: { status: 403, message: 'Forbidden' } });
      }
      throw new Error(`unexpected url ${u}`);
    };

    const detail = await client.getPlaylistDetail('detail-svc-a', 'followed1');
    expect(detail.detail_state).to.equal('restricted');
    expect(detail.restricted).to.equal(true);
    expect(detail.name).to.equal('Followed Editorial');
    expect(detail.external_url).to.equal('https://open.spotify.com/playlist/followed1');
    expect(detail.track_count).to.equal(42);
    expect(detail.items).to.deep.equal([]);
    expect(detail.tracks).to.deep.equal([]);
  });

  it('uses fresh same-user normalized metadata for restricted detail', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: freshness path missing`);
    }
    seedTokens('detail-svc-a');
    seedPlaylist('detail-svc-a', 'followed2', {
      name: 'Cached Followed',
      external_url: 'https://open.spotify.com/playlist/followed2',
      track_count: 7,
    });
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/followed2') && !u.includes('/items')) {
        return jsonResponse(403, { error: { status: 403 } });
      }
      throw new Error(`unexpected url ${u}`);
    };

    const detail = await client.getPlaylistDetail('detail-svc-a', 'followed2');
    expect(detail.detail_state).to.equal('restricted');
    expect(detail.name).to.equal('Cached Followed');
    expect(detail.track_count).to.equal(7);
    expect(detail.external_url).to.equal('https://open.spotify.com/playlist/followed2');
  });

  it('revalidates stale membership before trusting cached detail metadata', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: freshness revalidation missing`);
    }
    seedTokens('detail-svc-a');
    seedPlaylist('detail-svc-a', 'stale1', {
      name: 'Stale Name',
      expires_at: new Date(clock.getTime() - 1000).toISOString(),
    });
    let synced = false;
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/stale1') && !u.includes('/items') && !u.includes('/me/')) {
        return jsonResponse(403, { error: { status: 403 } });
      }
      if (u.includes('/me/playlists')) {
        synced = true;
        return jsonResponse(200, {
          items: [
            {
              id: 'stale1',
              name: 'Revalidated Name',
              collaborative: false,
              owner: { id: 'someone-else' },
              external_urls: { spotify: 'https://open.spotify.com/playlist/stale1' },
              images: [],
              tracks: { total: 9 },
              snapshot_id: 'new',
            },
          ],
          next: null,
        });
      }
      throw new Error(`unexpected url ${u}`);
    };

    const detail = await client.getPlaylistDetail('detail-svc-a', 'stale1');
    expect(synced).to.equal(true);
    expect(detail.name).to.equal('Revalidated Name');
    expect(detail.detail_state).to.equal('restricted');
    expect(detail.track_count).to.equal(9);
    const row = db
      .prepare(
        'SELECT name, expires_at FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?'
      )
      .get('detail-svc-a', 'stale1');
    expect(row.name).to.equal('Revalidated Name');
    expect(new Date(row.expires_at).getTime()).to.be.greaterThan(clock.getTime());
  });

  it('never serves stale fields when revalidation fails', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: failed revalidation safety missing`);
    }
    seedTokens('detail-svc-a');
    seedPlaylist('detail-svc-a', 'stale-fail', {
      name: 'Should Not Leak',
      expires_at: new Date(clock.getTime() - 1000).toISOString(),
    });
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/stale-fail') && !u.includes('/items') && !u.includes('/me/')) {
        return jsonResponse(403, { error: { status: 403 } });
      }
      if (u.includes('/me/playlists')) {
        return jsonResponse(503, { error: { status: 503 } });
      }
      throw new Error(`unexpected url ${u}`);
    };

    try {
      await client.getPlaylistDetail('detail-svc-a', 'stale-fail');
      expect.fail('expected provider failure');
    } catch (err) {
      expect(err.code).to.be.oneOf(['spotify_unavailable', 'provider_error']);
    }
  });

  it('returns non-disclosing failure for absent direct restricted IDs', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: absent direct ID handling missing`);
    }
    seedTokens('detail-svc-a');
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/unknown') && !u.includes('/items')) {
        return jsonResponse(403, { error: { status: 403 } });
      }
      throw new Error(`unexpected url ${u}`);
    };

    try {
      await client.getPlaylistDetail('detail-svc-a', 'unknown');
      expect.fail('expected not found');
    } catch (err) {
      expect(err.code).to.equal('not_found');
    }
  });

  it('does not disclose cross-user normalized metadata for identical provider IDs', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: cross-user isolation missing`);
    }
    seedTokens('detail-svc-a');
    seedTokens('detail-svc-b', 'other-user');
    seedPlaylist('detail-svc-b', 'shared-id', {
      name: 'User B Secret',
      track_count: 99,
    });
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/shared-id') && !u.includes('/items')) {
        return jsonResponse(403, { error: { status: 403 } });
      }
      throw new Error(`unexpected url ${u}`);
    };

    try {
      await client.getPlaylistDetail('detail-svc-a', 'shared-id');
      expect.fail('expected not found');
    } catch (err) {
      expect(err.code).to.equal('not_found');
    }
  });

  it('caps displayed items at 20 while preserving source order', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: item cap missing`);
    }
    seedTokens('detail-svc-a');
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/long1') && !u.includes('/items')) {
        return jsonResponse(200, {
          id: 'long1',
          name: 'Long',
          collaborative: false,
          owner: { id: 'me-user' },
          external_urls: { spotify: 'https://open.spotify.com/playlist/long1' },
          images: [],
          tracks: { total: 25 },
        });
      }
      if (u.includes('/playlists/long1/items')) {
        return jsonResponse(200, {
          items: Array.from({ length: 25 }, (_, i) => ({
            track: {
              id: `t${i}`,
              name: `T${i}`,
              artists: [{ name: 'A' }],
              duration_ms: 1000,
              is_local: false,
            },
          })),
          next: null,
        });
      }
      throw new Error(`unexpected url ${u}`);
    };

    const detail = await client.getPlaylistDetail('detail-svc-a', 'long1');
    expect(detail.items).to.have.length(20);
    expect(detail.items[0].title).to.equal('T0');
    expect(detail.items[19].title).to.equal('T19');
    expect(detail.track_count).to.equal(25);
  });

  it('maps playlist 404 to removed/not_found', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: 404 mapping missing`);
    }
    seedTokens('detail-svc-a');
    fetchImpl = async () => jsonResponse(404, { error: { status: 404 } });
    try {
      await client.getPlaylistDetail('detail-svc-a', 'gone');
      expect.fail('expected not found');
    } catch (err) {
      expect(err.code).to.equal('not_found');
    }
  });

  it('rejects invalid provider IDs', async () => {
    if (typeof client.getPlaylistDetail !== 'function') {
      expect.fail(`${SENTINEL}: ID validation missing`);
    }
    seedTokens('detail-svc-a');
    try {
      await client.getPlaylistDetail('detail-svc-a', "x' OR '1'='1");
      expect.fail('expected invalid_request');
    } catch (err) {
      expect(err.code).to.equal('invalid_request');
    }
  });
});
