const { expect } = require('chai');
const db = require('../db');
const { encryptToken } = require('../services/spotifyCrypto');
const oauth = require('../services/spotifyOAuthService');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const mockRes = () => {
  const r = {
    statusCode: 200,
    headers: {},
    body: undefined,
    redirectedTo: undefined,
  };
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
  r.redirect = (code, url) => {
    r.statusCode = code;
    r.redirectedTo = url;
    return r;
  };
  r.send = (d) => {
    r.body = d;
    return r;
  };
  return r;
};

function findHandler(router, method, path) {
  const layer = router.stack.find(
    (s) => s.route && s.route.path === path && s.route.methods[method]
  );
  if (!layer) return null;
  return layer.route.stack[0].handle;
}

describe('spotify routes foundation contracts', () => {
  let protectedRouter;
  let callbackRouter;
  let originalFetch;
  let logs;

  before(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_REDIRECT_URI = 'https://example.test/api/spotify/oauth/callback';
    process.env.SPOTIFY_WEB_SUCCESS_URL = 'https://example.test/playlists?spotify=connected';
    process.env.SPOTIFY_WEB_ERROR_URL = 'https://example.test/settings?spotify=error';
    process.env.SPOTIFY_ANDROID_SUCCESS_URL = 'https://example.test/app/library?spotify=connected';
    process.env.SPOTIFY_ANDROID_ERROR_URL = 'https://example.test/app/settings?spotify=error';
    process.env.SPOTIFY_SCOPES =
      'playlist-read-private playlist-read-collaborative playlist-modify-private';
    delete require.cache[require.resolve('../services/spotifyService')];
    delete require.cache[require.resolve('./spotify')];
    ({ protectedRouter, callbackRouter } = require('./spotify'));
  });

  function ensureUser(id) {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      id,
      `${id}@test.com`,
      'x'
    );
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
      'playlist-read-private',
      'sp-1',
      'Name',
      now,
      new Date(Date.now() + 3600_000).toISOString(),
      now
    );
  }

  let origError;

  beforeEach(() => {
    ensureUser('sp-route-a');
    ensureUser('sp-route-b');
    db.prepare('DELETE FROM spotify_oauth_transactions').run();
    db.prepare('DELETE FROM user_spotify_tokens').run();
    db.prepare('DELETE FROM user_spotify_playlists').run();
    db.prepare('DELETE FROM playlists WHERE user_id IN (?, ?)').run('sp-route-a', 'sp-route-b');
    logs = [];
    originalFetch = global.fetch;
    origError = console.error;
    console.error = (...args) => {
      logs.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    console.error = origError;
    global.fetch = originalFetch;
  });

  it('status/start/disconnect require req.user.id', async () => {
    const status = findHandler(protectedRouter, 'get', '/status');
    const start = findHandler(protectedRouter, 'post', '/auth/start');
    const disconnect = findHandler(protectedRouter, 'delete', '/connection');
    expect(status && start && disconnect).to.exist;

    for (const handler of [status, start, disconnect]) {
      const res = mockRes();
      await handler({ user: null, body: { client: 'web' } }, res);
      expect(res.statusCode).to.equal(401);
    }

    const res = mockRes();
    await status({ user: { id: 'sp-route-a' } }, res);
    expect(res.statusCode).to.equal(200);
    expect(res.body).to.deep.equal({
      status: 'disconnected',
      display_name: null,
      reason: null,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      client_id_prefix: 'test-cli',
      playback_scopes_ok: false,
    });
    expect(JSON.stringify(res.body)).to.not.match(/access|refresh|ciphertext/i);
  });

  it('callback is authorized only by atomically consumed OAuth state', async () => {
    const callback = findHandler(callbackRouter, 'get', '/callback');
    expect(callback).to.exist;

    const tx = oauth.createOAuthTransaction({ userId: 'sp-route-a', clientKind: 'web' });
    global.fetch = async (url) => {
      if (String(url).includes('/api/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'tok-access',
            refresh_token: 'tok-refresh',
            expires_in: 3600,
            scope: process.env.SPOTIFY_SCOPES,
          }),
        };
      }
      if (String(url).includes('/v1/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'spotify-me', display_name: 'Ada' }),
        };
      }
      throw new Error(`unexpected ${url}`);
    };

    const res = mockRes();
    await callback({ query: { code: 'auth-code', state: tx.state } }, res);
    expect(res.statusCode).to.equal(302);
    expect(res.redirectedTo).to.equal(process.env.SPOTIFY_WEB_SUCCESS_URL);

    const tokens = db.prepare('SELECT * FROM user_spotify_tokens WHERE user_id = ?').get('sp-route-a');
    expect(tokens).to.exist;
    expect(JSON.stringify(tokens)).to.not.include('tok-access');
    expect(JSON.stringify(tokens)).to.not.include('tok-refresh');

    const replay = mockRes();
    await callback({ query: { code: 'auth-code', state: tx.state } }, replay);
    expect(replay.statusCode).to.equal(302);
    expect(replay.redirectedTo).to.equal(process.env.SPOTIFY_WEB_ERROR_URL);
  });

  it('rejects callback replay, interception, and open-return attempts', async () => {
    const start = findHandler(protectedRouter, 'post', '/auth/start');
    const callback = findHandler(callbackRouter, 'get', '/callback');

    const badStart = mockRes();
    await start(
      { user: { id: 'sp-route-a' }, body: { client: 'web', returnUrl: 'https://evil.test' } },
      badStart
    );
    expect(badStart.statusCode).to.equal(400);

    const startRes = mockRes();
    await start({ user: { id: 'sp-route-a' }, body: { client: 'android' } }, startRes);
    expect(startRes.statusCode).to.equal(200);
    const url = new URL(startRes.body.authorization_url);
    expect(url.hostname).to.equal('accounts.spotify.com');
    expect(url.searchParams.get('code_challenge_method')).to.equal('S256');
    const state = url.searchParams.get('state');

    // Interception: wrong/missing state
    const intercepted = mockRes();
    await callback({ query: { code: 'x', state: 'not-a-real-state' } }, intercepted);
    expect(intercepted.redirectedTo).to.equal(process.env.SPOTIFY_WEB_ERROR_URL);

    // Consume once via forged exchange failure path still consumes when valid
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
    });
    const failOnce = mockRes();
    await callback({ query: { code: 'x', state } }, failOnce);
    expect(failOnce.redirectedTo).to.equal(process.env.SPOTIFY_ANDROID_ERROR_URL);

    const replay = mockRes();
    await callback({ query: { code: 'x', state } }, replay);
    expect(replay.redirectedTo).to.match(/spotify=error/);
  });

  it('never returns or logs tokens, codes, or state material', async () => {
    const callback = findHandler(callbackRouter, 'get', '/callback');
    const tx = oauth.createOAuthTransaction({ userId: 'sp-route-a', clientKind: 'web' });
    global.fetch = async () => {
      throw new Error(`token leak code=SECRETCODE state=${tx.state} access_token=ATOKEN`);
    };
    const res = mockRes();
    await callback({ query: { code: 'SECRETCODE', state: tx.state } }, res);
    expect(res.redirectedTo).to.equal(process.env.SPOTIFY_WEB_ERROR_URL);
    const joined = logs.join('\n');
    expect(joined).to.not.include('SECRETCODE');
    expect(joined).to.not.include('ATOKEN');
    expect(joined).to.not.include(tx.state);
    expect(JSON.stringify(res.body || {})).to.not.include('SECRETCODE');
  });

  it('disconnect is idempotent and removes tokens, transactions, personal data, and Spotify cache', async () => {
    const disconnect = findHandler(protectedRouter, 'delete', '/connection');
    seedTokens('sp-route-a');
    seedTokens('sp-route-b');
    oauth.createOAuthTransaction({ userId: 'sp-route-a', clientKind: 'web' });
    db.prepare(`
      INSERT INTO user_spotify_playlists (
        user_id, spotify_playlist_id, name, external_url, artwork_url, track_count,
        is_owner, is_collaborative, is_restricted, detail_access, snapshot_id,
        synced_at, revalidated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 'full', NULL, ?, ?, ?)
    `).run(
      'sp-route-a',
      'pl-shared',
      'Mine',
      'https://open.spotify.com/playlist/pl-shared',
      null,
      3,
      new Date().toISOString(),
      new Date().toISOString(),
      new Date(Date.now() + 86400000).toISOString()
    );
    db.prepare(`
      INSERT INTO user_spotify_playlists (
        user_id, spotify_playlist_id, name, external_url, artwork_url, track_count,
        is_owner, is_collaborative, is_restricted, detail_access, snapshot_id,
        synced_at, revalidated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, 'full', NULL, ?, ?, ?)
    `).run(
      'sp-route-b',
      'pl-shared',
      'Other',
      'https://open.spotify.com/playlist/pl-shared',
      null,
      3,
      new Date().toISOString(),
      new Date().toISOString(),
      new Date(Date.now() + 86400000).toISOString()
    );

    // Seed user-owned Harmonix playlist match evidence + export jobs for both users.
    db.prepare('INSERT OR REPLACE INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(
      'hx-pl-a',
      'sp-route-a',
      'A Mix'
    );
    db.prepare('INSERT OR REPLACE INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(
      'hx-pl-b',
      'sp-route-b',
      'B Mix'
    );
    db.prepare('DELETE FROM song_cache WHERE song_id IN (?, ?)').run('song-a', 'song-b');
    db.prepare(
      `INSERT INTO song_cache (
         song_id, track_json, cached_at, spotify_uri, spotify_track_id, spotify_market
       ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`
    ).run('song-a', JSON.stringify({ title: 'A' }), 'spotify:track:a', 'a', 'US');
    db.prepare(
      `INSERT INTO song_cache (
         song_id, track_json, cached_at, spotify_uri, spotify_track_id, spotify_market
       ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)`
    ).run('song-b', JSON.stringify({ title: 'B' }), 'spotify:track:b', 'b', 'US');
    db.prepare(
      'INSERT OR REPLACE INTO playlist_songs (id, playlist_id, song_id) VALUES (?, ?, ?)'
    ).run('entry-a', 'hx-pl-a', 'song-a');
    db.prepare(
      'INSERT OR REPLACE INTO playlist_songs (id, playlist_id, song_id) VALUES (?, ?, ?)'
    ).run('entry-b', 'hx-pl-b', 'song-b');
    db.prepare('DELETE FROM spotify_export_jobs WHERE user_id IN (?, ?)').run(
      'sp-route-a',
      'sp-route-b'
    );
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO spotify_export_jobs (
         id, user_id, source_playlist_id, stage, current_count, total_count,
         matched_count, unmatched_count, exported_count, failed_count,
         created_at, updated_at
       ) VALUES (?, ?, ?, 'completed', 1, 1, 1, 0, 1, 0, ?, ?)`
    ).run('job-a', 'sp-route-a', 'hx-pl-a', now, now);
    db.prepare(
      `INSERT INTO spotify_export_jobs (
         id, user_id, source_playlist_id, stage, current_count, total_count,
         matched_count, unmatched_count, exported_count, failed_count,
         created_at, updated_at
       ) VALUES (?, ?, ?, 'completed', 1, 1, 1, 0, 1, 0, ?, ?)`
    ).run('job-b', 'sp-route-b', 'hx-pl-b', now, now);

    const res1 = mockRes();
    await disconnect({ user: { id: 'sp-route-a' } }, res1);
    expect(res1.body).to.deep.equal({ status: 'disconnected' });

    const res2 = mockRes();
    await disconnect({ user: { id: 'sp-route-a' } }, res2);
    expect(res2.body).to.deep.equal({ status: 'disconnected' });

    expect(db.prepare('SELECT * FROM user_spotify_tokens WHERE user_id = ?').get('sp-route-a')).to
      .equal(undefined);
    expect(db.prepare('SELECT * FROM spotify_oauth_transactions WHERE user_id = ?').get('sp-route-a'))
      .to.equal(undefined);
    expect(
      db.prepare('SELECT * FROM user_spotify_playlists WHERE user_id = ?').get('sp-route-a')
    ).to.equal(undefined);
    expect(
      db.prepare('SELECT * FROM spotify_export_jobs WHERE user_id = ?').get('sp-route-a')
    ).to.equal(undefined);
    const clearedMatch = db.prepare('SELECT spotify_uri FROM song_cache WHERE song_id = ?').get(
      'song-a'
    );
    expect(clearedMatch.spotify_uri).to.equal(null);
    // Harmonix playlist rows themselves remain (local content).
    expect(db.prepare('SELECT * FROM playlists WHERE id = ?').get('hx-pl-a')).to.exist;

    // Cross-user residue must remain (same Spotify playlist provider ID).
    expect(db.prepare('SELECT * FROM user_spotify_tokens WHERE user_id = ?').get('sp-route-b')).to
      .exist;
    expect(
      db
        .prepare('SELECT * FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
        .get('sp-route-b', 'pl-shared')
    ).to.exist;
    expect(
      db.prepare('SELECT * FROM spotify_export_jobs WHERE user_id = ?').get('sp-route-b')
    ).to.exist;
    const otherMatch = db.prepare('SELECT spotify_uri FROM song_cache WHERE song_id = ?').get(
      'song-b'
    );
    expect(otherMatch.spotify_uri).to.equal('spotify:track:b');
  });

  it('rejects SQL metacharacter playlist/export IDs via parameterized ownership checks', async () => {
    const detail = findHandler(protectedRouter, 'get', '/playlists/:id');
    expect(detail).to.exist;
    const evil = "x' OR '1'='1";
    const res = mockRes();
    await detail({ user: { id: 'sp-route-a' }, params: { id: evil } }, res);
    expect(res.statusCode).to.equal(404);
    expect(res.body.error).to.equal('Playlist not found');
  });

  it('maps cross-user local playlist access to non-disclosing 404', async () => {
    const detail = findHandler(protectedRouter, 'get', '/playlists/:id');
    db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(
      'owned-by-b',
      'sp-route-b',
      'Secret'
    );
    const res = mockRes();
    await detail({ user: { id: 'sp-route-a' }, params: { id: 'owned-by-b' } }, res);
    expect(res.statusCode).to.equal(404);
    expect(res.body.error).to.equal('Playlist not found');
  });
});
