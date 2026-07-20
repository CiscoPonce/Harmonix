const { expect } = require('chai');
const db = require('../db');
const { encryptToken } = require('../services/spotifyCrypto');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_DETAIL';

function findHandler(router, method, path) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  return layer ? layer.route.stack[0].handle : null;
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      this.body = null;
      return this;
    },
  };
}

describe('spotify playlist detail route contracts', () => {
  let protectedRouter;
  let createSpotifyClient;
  let originalFetch;

  before(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_REDIRECT_URI = 'https://example.test/api/spotify/oauth/callback';
    delete require.cache[require.resolve('../services/spotifyService')];
    delete require.cache[require.resolve('./spotify')];
    ({ createSpotifyClient } = require('../services/spotifyService'));
    ({ protectedRouter } = require('./spotify'));
  });

  beforeEach(() => {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'detail-user-a',
      'detail-user-a@test.com',
      'x'
    );
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'detail-user-b',
      'detail-user-b@test.com',
      'x'
    );
    db.prepare('DELETE FROM user_spotify_tokens WHERE user_id IN (?, ?)').run(
      'detail-user-a',
      'detail-user-b'
    );
    db.prepare('DELETE FROM user_spotify_playlists WHERE user_id IN (?, ?)').run(
      'detail-user-a',
      'detail-user-b'
    );
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function seedTokens(userId) {
    const a = encryptToken('access-plain');
    const r = encryptToken('refresh-plain');
    const now = new Date().toISOString();
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
      'me-user',
      'Listener',
      now,
      new Date(Date.now() + 3600_000).toISOString(),
      now
    );
  }

  function seedPlaylist(userId, playlistId, name) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO user_spotify_playlists (
        user_id, spotify_playlist_id, name, external_url, artwork_url, track_count,
        is_owner, is_collaborative, is_restricted, detail_access, snapshot_id,
        synced_at, revalidated_at, expires_at
      ) VALUES (?, ?, ?, ?, NULL, 3, 0, 0, 1, 'restricted', NULL, ?, ?, ?)
    `).run(
      userId,
      playlistId,
      name,
      `https://open.spotify.com/playlist/${playlistId}`,
      now,
      now,
      new Date(Date.now() + 7 * 86400000).toISOString()
    );
  }

  it('GET detail requires req.user.id and scopes lookup to that user', async () => {
    const handler = findHandler(protectedRouter, 'get', '/playlists/:id');
    if (!handler) {
      expect.fail(`${SENTINEL}: playlist detail route missing`);
    }
    const unauth = mockRes();
    await handler({ user: null, params: { id: 'pl1' } }, unauth);
    expect(unauth.statusCode).to.equal(401);

    seedTokens('detail-user-a');
    seedPlaylist('detail-user-a', 'pl1', 'Mine');
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/pl1') && !u.includes('/items')) {
        return {
          ok: false,
          status: 403,
          headers: { get: () => null },
          json: async () => ({ error: { status: 403 } }),
        };
      }
      throw new Error(`unexpected ${u}`);
    };

    // Reload module so default client uses patched fetch? Route uses module-level defaultClient.
    // spotifyService resolves fetch at call time via globalThis.fetch — good.
    const res = mockRes();
    await handler({ user: { id: 'detail-user-a' }, params: { id: 'pl1' } }, res);
    expect(res.statusCode).to.equal(200);
    expect(res.body.provider).to.equal('spotify');
    expect(res.body.provider_id).to.equal('pl1');
    expect(res.body.detail_state).to.equal('restricted');
    expect(res.body.restricted).to.equal(true);
    expect(res.body.name).to.equal('Mine');
  });

  it('returns non-disclosing 404 for cross-user or unknown provider IDs', async () => {
    const handler = findHandler(protectedRouter, 'get', '/playlists/:id');
    if (!handler) {
      expect.fail(`${SENTINEL}: cross-user detail 404 missing`);
    }
    seedTokens('detail-user-a');
    seedPlaylist('detail-user-b', 'secret-pl', 'Secret');
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/secret-pl') && !u.includes('/items')) {
        return {
          ok: false,
          status: 403,
          headers: { get: () => null },
          json: async () => ({ error: { status: 403 } }),
        };
      }
      throw new Error(`unexpected ${u}`);
    };

    const res = mockRes();
    await handler({ user: { id: 'detail-user-a' }, params: { id: 'secret-pl' } }, res);
    expect(res.statusCode).to.equal(404);
    expect(res.body.error).to.equal('Playlist not found');
  });

  it('rejects SQL metacharacter provider IDs', async () => {
    const handler = findHandler(protectedRouter, 'get', '/playlists/:id');
    if (!handler) {
      expect.fail(`${SENTINEL}: detail parameterized ID handling missing`);
    }
    seedTokens('detail-user-a');
    const evil = "x' OR '1'='1";
    const res = mockRes();
    await handler({ user: { id: 'detail-user-a' }, params: { id: evil } }, res);
    expect(res.statusCode).to.be.oneOf([400, 404]);
    if (res.statusCode === 404) {
      expect(res.body.error).to.equal('Playlist not found');
    } else {
      expect(res.body.error).to.equal('invalid_request');
    }
  });

  it('returns normal detail payload for owned playlists', async () => {
    const handler = findHandler(protectedRouter, 'get', '/playlists/:id');
    if (!handler) {
      expect.fail(`${SENTINEL}: normal detail route missing`);
    }
    seedTokens('detail-user-a');
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/playlists/owned-route') && !u.includes('/items')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            id: 'owned-route',
            name: 'Owned Route',
            collaborative: false,
            owner: { id: 'me-user' },
            external_urls: { spotify: 'https://open.spotify.com/playlist/owned-route' },
            images: [],
            tracks: { total: 1 },
          }),
        };
      }
      if (u.includes('/playlists/owned-route/items')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            items: [
              {
                track: {
                  id: 't1',
                  name: 'Song',
                  artists: [{ name: 'Art' }],
                  duration_ms: 1000,
                  is_local: false,
                },
              },
            ],
            next: null,
          }),
        };
      }
      throw new Error(`unexpected ${u}`);
    };

    const res = mockRes();
    await handler({ user: { id: 'detail-user-a' }, params: { id: 'owned-route' } }, res);
    expect(res.statusCode).to.equal(200);
    expect(res.body.detail_state).to.equal('normal');
    expect(res.body.items).to.have.length(1);
    expect(res.body.tracks[0].name).to.equal('Song');
  });
});
