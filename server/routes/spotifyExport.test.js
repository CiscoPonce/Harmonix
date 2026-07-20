const { expect } = require('chai');
const db = require('../db');
const { encryptToken } = require('../services/spotifyCrypto');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_EXPORT';

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
    },
  };
}

describe('spotify export route contracts', () => {
  let protectedRouter;

  before(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    delete require.cache[require.resolve('../services/spotifyService')];
    delete require.cache[require.resolve('../services/spotifyExportService')];
    delete require.cache[require.resolve('./spotify')];
    ({ protectedRouter } = require('./spotify'));
  });

  beforeEach(() => {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'export-user-a',
      'export-user-a@test.com',
      'x'
    );
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'export-user-b',
      'export-user-b@test.com',
      'x'
    );
    db.prepare('DELETE FROM spotify_export_jobs').run();
    db.prepare('DELETE FROM playlist_songs').run();
    db.prepare('DELETE FROM playlists WHERE id LIKE ?').run('export-pl-%');
  });

  function seedOwnedPlaylist(userId, playlistId) {
    db.prepare('INSERT OR REPLACE INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(
      playlistId,
      userId,
      'Owned'
    );
    db.prepare('DELETE FROM song_cache WHERE song_id = ?').run(`${playlistId}-song`);
    db.prepare(
      `INSERT INTO song_cache (song_id, track_json, cached_at) VALUES (?, ?, CURRENT_TIMESTAMP)`
    ).run(
      `${playlistId}-song`,
      JSON.stringify({ title: 'Hello', artist: 'Adele', duration_ms: 295000 })
    );
    db.prepare(
      `INSERT OR REPLACE INTO playlist_songs (id, playlist_id, song_id) VALUES (?, ?, ?)`
    ).run(`${playlistId}-entry`, playlistId, `${playlistId}-song`);
  }

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
      'playlist-modify-private',
      'me',
      'Listener',
      now,
      new Date(Date.now() + 3600_000).toISOString(),
      now
    );
  }

  it('POST export requires req.user.id', async () => {
    const post = findHandler(protectedRouter, 'post', '/exports');
    const latest = findHandler(protectedRouter, 'get', '/exports/latest');
    const byId = findHandler(protectedRouter, 'get', '/exports/:id');
    if (!post || !latest || !byId) {
      expect.fail(`${SENTINEL}: export route missing`);
    }
    for (const handler of [post, latest, byId]) {
      const res = mockRes();
      await handler({ user: null, body: {}, query: {}, params: { id: 'x' } }, res);
      expect(res.statusCode).to.equal(401);
    }
  });

  it("returns non-disclosing 404 for another user's Harmonix playlist", async () => {
    const post = findHandler(protectedRouter, 'post', '/exports');
    if (!post) expect.fail(`${SENTINEL}: export cross-user 404 missing`);
    seedOwnedPlaylist('export-user-b', 'export-pl-b');
    seedTokens('export-user-a');
    const res = mockRes();
    await post(
      { user: { id: 'export-user-a' }, body: { source_playlist_id: 'export-pl-b' } },
      res
    );
    expect(res.statusCode).to.equal(404);
    expect(res.body.error).to.equal('Playlist not found');
  });

  it('rejects SQL metacharacter playlist IDs', async () => {
    const post = findHandler(protectedRouter, 'post', '/exports');
    const latest = findHandler(protectedRouter, 'get', '/exports/latest');
    const byId = findHandler(protectedRouter, 'get', '/exports/:id');
    if (!post || !latest || !byId) {
      expect.fail(`${SENTINEL}: export parameterized ID handling missing`);
    }
    seedTokens('export-user-a');
    const evil = "x' OR '1'='1";
    const postRes = mockRes();
    await post({ user: { id: 'export-user-a' }, body: { source_playlist_id: evil } }, postRes);
    expect(postRes.statusCode).to.equal(404);

    const latestRes = mockRes();
    await latest(
      { user: { id: 'export-user-a' }, query: { source_playlist_id: evil } },
      latestRes
    );
    expect(latestRes.statusCode).to.equal(404);

    const byIdRes = mockRes();
    await byId({ user: { id: 'export-user-a' }, params: { id: evil } }, byIdRes);
    expect(byIdRes.statusCode).to.equal(404);
  });

  it('returns 202 for owned playlist export and restores latest/by-id for the owner only', async () => {
    const post = findHandler(protectedRouter, 'post', '/exports');
    const latest = findHandler(protectedRouter, 'get', '/exports/latest');
    const byId = findHandler(protectedRouter, 'get', '/exports/:id');
    seedOwnedPlaylist('export-user-a', 'export-pl-a');
    seedTokens('export-user-a');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts = {}) => {
      const u = String(url);
      const json = (status, body) => ({
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => body,
      });
      if (u.includes('/search')) {
        return json(200, {
          tracks: {
            items: [
              {
                id: 'h',
                uri: 'spotify:track:h',
                name: 'Hello',
                artists: [{ name: 'Adele' }],
                duration_ms: 295000,
                is_local: false,
                is_playable: true,
                external_ids: {},
              },
            ],
          },
        });
      }
      if (opts.method === 'POST' && u.includes('/me/playlists')) {
        return json(201, {
          id: 'dest-route',
          external_urls: { spotify: 'https://open.spotify.com/playlist/dest-route' },
        });
      }
      if (u.includes('/items')) return json(201, {});
      throw new Error(u);
    };

    try {
      // Reload route with fetch-backed default client
      delete require.cache[require.resolve('../services/spotifyService')];
      delete require.cache[require.resolve('../services/spotifyExportService')];
      delete require.cache[require.resolve('./spotify')];
      ({ protectedRouter } = require('./spotify'));
      const postH = findHandler(protectedRouter, 'post', '/exports');
      const latestH = findHandler(protectedRouter, 'get', '/exports/latest');
      const byIdH = findHandler(protectedRouter, 'get', '/exports/:id');

      const created = mockRes();
      await postH(
        {
          user: { id: 'export-user-a' },
          body: { source_playlist_id: 'export-pl-a', idempotency_key: 'k1' },
        },
        created
      );
      expect(created.statusCode).to.equal(202);
      expect(created.body.id).to.be.a('string');
      expect(created.body.stage).to.equal('completed');

      const latestOk = mockRes();
      await latestH(
        {
          user: { id: 'export-user-a' },
          query: { source_playlist_id: 'export-pl-a' },
        },
        latestOk
      );
      expect(latestOk.statusCode).to.equal(200);
      expect(latestOk.body.id).to.equal(created.body.id);

      const cross = mockRes();
      await latestH(
        {
          user: { id: 'export-user-b' },
          query: { source_playlist_id: 'export-pl-a' },
        },
        cross
      );
      expect(cross.statusCode).to.equal(404);

      const byIdOk = mockRes();
      await byIdH({ user: { id: 'export-user-a' }, params: { id: created.body.id } }, byIdOk);
      expect(byIdOk.statusCode).to.equal(200);

      const byIdCross = mockRes();
      await byIdH({ user: { id: 'export-user-b' }, params: { id: created.body.id } }, byIdCross);
      expect(byIdCross.statusCode).to.equal(404);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
