const { expect } = require('chai');
const db = require('../db');
const { encryptToken } = require('../services/spotifyCrypto');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const mockRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => {
    r.statusCode = c;
    return r;
  };
  r.json = (d) => {
    r.body = d;
    return r;
  };
  r.sendStatus = (c) => {
    r.statusCode = c;
    return r;
  };
  return r;
};

function findHandler(router, method, path) {
  const layer = router.stack.find(
    (s) => s.route && s.route.path === path && s.route.methods[method]
  );
  return layer ? layer.route.stack[0].handle : null;
}

describe('spotify playlist list route contracts', () => {
  let protectedRouter;
  let originalFetch;

  before(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_REDIRECT_URI = 'https://example.test/api/spotify/oauth/callback';
    process.env.SPOTIFY_WEB_SUCCESS_URL = 'https://example.test/playlists?spotify=connected';
    process.env.SPOTIFY_WEB_ERROR_URL = 'https://example.test/settings?spotify=error';
    process.env.SPOTIFY_ANDROID_SUCCESS_URL = 'https://example.test/app/library?spotify=connected';
    process.env.SPOTIFY_ANDROID_ERROR_URL = 'https://example.test/app/settings?spotify=error';
    delete require.cache[require.resolve('../services/spotifyService')];
    delete require.cache[require.resolve('./spotify')];
    ({ protectedRouter } = require('./spotify'));
  });

  beforeEach(() => {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'list-user-a',
      'list-user-a@test.com',
      'x'
    );
    db.prepare('DELETE FROM user_spotify_tokens WHERE user_id = ?').run('list-user-a');
    db.prepare('DELETE FROM user_spotify_playlists WHERE user_id = ?').run('list-user-a');
    originalFetch = global.fetch;
    const a = encryptToken('access-plain');
    const r = encryptToken('refresh-plain');
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO user_spotify_tokens (
        user_id,
        access_ciphertext, access_iv, access_tag, access_key_version,
        refresh_ciphertext, refresh_iv, refresh_tag, refresh_key_version,
        scopes, spotify_user_id, spotify_display_name,
        authorized_at, expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'list-user-a',
      a.ciphertext, a.iv, a.tag, a.keyVersion,
      r.ciphertext, r.iv, r.tag, r.keyVersion,
      'playlist-read-private',
      'me-user',
      'Listener',
      now,
      new Date(Date.now() + 3600_000).toISOString(),
      now
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('GET /api/spotify/playlists requires req.user.id', async () => {
    const handler = findHandler(protectedRouter, 'get', '/playlists');
    expect(handler).to.exist;
    const denied = mockRes();
    await handler({ user: null }, denied);
    expect(denied.statusCode).to.equal(401);
  });

  it('returns provider, provider_id, stable_id, external_url, ownership, and detail_access fields', async () => {
    const handler = findHandler(protectedRouter, 'get', '/playlists');
    global.fetch = async (url) => {
      expect(String(url)).to.match(/\/me\/playlists/);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          items: [
            {
              id: 'pl1',
              name: 'My List',
              collaborative: false,
              owner: { id: 'me-user' },
              external_urls: { spotify: 'https://open.spotify.com/playlist/pl1' },
              images: [{ url: 'https://i.scdn.co/image/x' }],
              tracks: { total: 4 },
              snapshot_id: 's1',
            },
          ],
          next: null,
        }),
      };
    };

    const res = mockRes();
    await handler({ user: { id: 'list-user-a' } }, res);
    expect(res.statusCode).to.equal(200);
    expect(res.body.playlists).to.have.lengthOf(1);
    const item = res.body.playlists[0];
    expect(item).to.include({
      provider: 'spotify',
      provider_id: 'pl1',
      stable_id: 'spotify:pl1',
      external_url: 'https://open.spotify.com/playlist/pl1',
      is_owner: true,
      detail_access: 'full',
    });
    expect(item).to.have.property('artwork_url');
    expect(item).to.have.property('track_count', 4);
    expect(item).to.have.property('is_restricted', false);
  });

  it('rejects SQL metacharacter query inputs with parameterized statements', async () => {
    const handler = findHandler(protectedRouter, 'get', '/playlists/:id');
    const res = mockRes();
    await handler(
      { user: { id: 'list-user-a' }, params: { id: "abc'; DROP TABLE users;--" } },
      res
    );
    expect(res.statusCode).to.equal(404);
    const users = db.prepare('SELECT id FROM users WHERE id = ?').get('list-user-a');
    expect(users).to.exist;
  });
});
