const { expect } = require('chai');
const db = require('../db');
const { encryptToken } = require('./spotifyCrypto');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

describe('spotifyService foundation contracts', () => {
  let createSpotifyClient;
  let clock;
  let sleepCalls;
  let fetchImpl;
  let client;

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

  function seedTokens(userId, {
    access = 'access-plain',
    refresh = 'refresh-plain',
    expiresAt,
    authorizedAt,
  }) {
    const a = encryptToken(access);
    const r = encryptToken(refresh);
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
      'spotify-user-1',
      'Listener',
      authorizedAt.toISOString(),
      expiresAt.toISOString(),
      authorizedAt.toISOString()
    );
  }

  beforeEach(() => {
    ensureUser('svc-user-a');
    ensureUser('svc-user-b');
    db.prepare('DELETE FROM spotify_oauth_transactions').run();
    db.prepare('DELETE FROM user_spotify_tokens').run();
    db.prepare('DELETE FROM user_spotify_playlists').run();
    clock = new Date('2026-07-20T12:00:00.000Z');
    sleepCalls = [];
    fetchImpl = async () => {
      throw new Error('unexpected fetch');
    };
    client = createSpotifyClient({
      fetch: (...args) => fetchImpl(...args),
      now: () => new Date(clock.getTime()),
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
      timeoutMs: 50,
    });
  });

  it('supports injected fetch, fake clock, and fake sleep seams', () => {
    expect(createSpotifyClient).to.be.a('function');
    expect(client.getValidAccessToken).to.be.a('function');
    expect(client.spotifyRequest).to.be.a('function');
  });

  it('serializes pre-expiry refresh and retains or rotates refresh tokens atomically', async () => {
    seedTokens('svc-user-a', {
      expiresAt: new Date(clock.getTime() + 30_000),
      authorizedAt: new Date(clock.getTime() - 60_000),
      refresh: 'refresh-v1',
    });

    let refreshCalls = 0;
    fetchImpl = async (url, opts) => {
      if (String(url).includes('/api/token')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        const body = opts.body?.toString?.() || '';
        expect(body).to.include('refresh_token=refresh-v1');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: `access-new-${refreshCalls}`,
            expires_in: 3600,
            // omit refresh_token on first call to prove retention; rotate on second suite below
            ...(refreshCalls === 1 ? {} : { refresh_token: 'refresh-v2' }),
          }),
        };
      }
      throw new Error(`unexpected ${url}`);
    };

    const [t1, t2] = await Promise.all([
      client.getValidAccessToken('svc-user-a'),
      client.getValidAccessToken('svc-user-a'),
    ]);
    expect(t1).to.equal('access-new-1');
    expect(t2).to.equal('access-new-1');
    expect(refreshCalls).to.equal(1);

    const row = db.prepare('SELECT * FROM user_spotify_tokens WHERE user_id = ?').get('svc-user-a');
    const { decryptToken } = require('./spotifyCrypto');
    expect(decryptToken({
      ciphertext: row.refresh_ciphertext,
      iv: row.refresh_iv,
      tag: row.refresh_tag,
      keyVersion: row.refresh_key_version,
    })).to.equal('refresh-v1');

    // Force another refresh with rotation
    clock = new Date(clock.getTime() + 3700_000);
    seedTokens('svc-user-a', {
      access: 'stale',
      refresh: 'refresh-v1',
      expiresAt: new Date(clock.getTime() + 10_000),
      authorizedAt: new Date(clock.getTime() - 60_000),
    });
    refreshCalls = 0;
    fetchImpl = async (url) => {
      if (String(url).includes('/api/token')) {
        refreshCalls += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'access-rotated',
            refresh_token: 'refresh-v2',
            expires_in: 3600,
          }),
        };
      }
      throw new Error(`unexpected ${url}`);
    };
    await client.getValidAccessToken('svc-user-a');
    const row2 = db.prepare('SELECT * FROM user_spotify_tokens WHERE user_id = ?').get('svc-user-a');
    expect(decryptToken({
      ciphertext: row2.refresh_ciphertext,
      iv: row2.refresh_iv,
      tag: row2.refresh_tag,
      keyVersion: row2.refresh_key_version,
    })).to.equal('refresh-v2');
  });

  it('deletes credentials on invalid_grant without retry', async () => {
    seedTokens('svc-user-a', {
      expiresAt: new Date(clock.getTime() + 10_000),
      authorizedAt: new Date(clock.getTime() - 60_000),
    });
    let calls = 0;
    fetchImpl = async () => {
      calls += 1;
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      };
    };
    try {
      await client.refreshAccessToken('svc-user-a');
      expect.fail('expected reconnect_required');
    } catch (err) {
      expect(err.code).to.equal('reconnect_required');
      expect(err.reason).to.equal('invalid_grant');
    }
    expect(calls).to.equal(1);
    const row = db.prepare('SELECT * FROM user_spotify_tokens WHERE user_id = ?').get('svc-user-a');
    expect(row).to.equal(undefined);
  });

  it('waits exact Retry-After seconds on 429 with capped retries and per-user admission', async () => {
    seedTokens('svc-user-a', {
      access: 'good-access',
      expiresAt: new Date(clock.getTime() + 3600_000),
      authorizedAt: new Date(clock.getTime() - 60_000),
    });

    let calls = 0;
    fetchImpl = async (url) => {
      if (String(url).includes('/api/token')) throw new Error('should not refresh');
      calls += 1;
      if (calls <= 2) {
        return {
          ok: false,
          status: 429,
          headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? '3' : null) },
          json: async () => ({}),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ ok: true }),
      };
    };

    const result = await client.spotifyRequest('svc-user-a', '/me');
    expect(result).to.deep.equal({ ok: true });
    expect(sleepCalls).to.deep.equal([3000, 3000]);
    expect(calls).to.equal(3);

    // Per-user admission: second concurrent call is rejected while first holds the slot.
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let inFlight = 0;
    fetchImpl = async () => {
      inFlight += 1;
      await gate;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ ok: true }),
      };
    };
    const first = client.spotifyRequest('svc-user-a', '/me');
    await new Promise((r) => setTimeout(r, 5));
    try {
      await client.spotifyRequest('svc-user-a', '/me');
      expect.fail('expected admission rejection');
    } catch (err) {
      expect(err.code).to.equal('spotify_rate_limited');
    }
    release();
    await first;
    expect(inFlight).to.equal(1);
  });

  it('never searches more than ten tracks and never adds more than 100 uris per request', async () => {
    seedTokens('svc-user-a', {
      access: 'good-access',
      expiresAt: new Date(clock.getTime() + 3600_000),
      authorizedAt: new Date(clock.getTime() - 60_000),
    });
    let searchedUrl = '';
    fetchImpl = async (url) => {
      searchedUrl = String(url);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          tracks: {
            items: Array.from({ length: 15 }, (_, i) => ({ id: `t${i}` })),
          },
        }),
      };
    };
    const tracks = await client.searchTracks('svc-user-a', 'hello', { limit: 50 });
    expect(searchedUrl).to.match(/limit=10/);
    expect(tracks).to.have.lengthOf(10);
    expect(() => client.assertAddBatchSize(new Array(101).fill('spotify:track:x'))).to.throw(
      /100/
    );
    expect(() => client.assertAddBatchSize(new Array(100).fill('spotify:track:x'))).to.not.throw();
  });

  it('uses current /me/playlists and /playlists/{id}/items endpoints only', async () => {
    seedTokens('svc-user-a', {
      access: 'good-access',
      expiresAt: new Date(clock.getTime() + 3600_000),
      authorizedAt: new Date(clock.getTime() - 60_000),
    });
    const urls = [];
    fetchImpl = async (url) => {
      urls.push(String(url));
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ items: [], next: null }),
      };
    };
    await client.listCurrentUserPlaylists('svc-user-a');
    expect(urls.some((u) => u.includes('/me/playlists'))).to.equal(true);
    expect(urls.some((u) => /\/users\/.+\/playlists/.test(u))).to.equal(false);
    expect(urls.some((u) => /\/playlists\/.+\/tracks/.test(u))).to.equal(false);
  });

  it('enforces six-month authorization expiry as reconnect_required', () => {
    seedTokens('svc-user-a', {
      expiresAt: new Date(clock.getTime() + 3600_000),
      authorizedAt: new Date(clock.getTime() - 181 * 24 * 60 * 60 * 1000),
    });
    const status = client.getConnectionStatus('svc-user-a');
    expect(status.status).to.equal('reconnect_required');
    expect(status.reason).to.equal('authorization_expired');
  });
});
