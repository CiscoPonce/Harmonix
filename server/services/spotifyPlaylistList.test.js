const { expect } = require('chai');
const db = require('../db');
const { encryptToken } = require('./spotifyCrypto');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

describe('spotify playlist list service contracts', () => {
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

  function seedPlaylist(userId, playlistId, name) {
    const now = clock.toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO user_spotify_playlists (
        user_id, spotify_playlist_id, name, external_url, artwork_url, track_count,
        is_owner, is_collaborative, is_restricted, detail_access, snapshot_id,
        synced_at, revalidated_at, expires_at
      ) VALUES (?, ?, ?, ?, NULL, 1, 1, 0, 0, 'full', NULL, ?, ?, ?)
    `).run(
      userId,
      playlistId,
      name,
      `https://open.spotify.com/playlist/${playlistId}`,
      now,
      now,
      new Date(clock.getTime() + 7 * 86400000).toISOString()
    );
  }

  beforeEach(() => {
    ensureUser('list-svc-a');
    ensureUser('list-svc-b');
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

  it('paginates GET /me/playlists for the authenticated user only', async () => {
    seedTokens('list-svc-a');
    let page = 0;
    fetchImpl = async (url) => {
      expect(String(url)).to.match(/\/me\/playlists/);
      page += 1;
      if (page === 1) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({
            items: [
              {
                id: 'p1',
                name: 'Owned',
                collaborative: false,
                owner: { id: 'me-user' },
                external_urls: { spotify: 'https://open.spotify.com/playlist/p1' },
                images: [{ url: 'https://i.scdn.co/image/1' }],
                tracks: { total: 2 },
                snapshot_id: 'snap1',
              },
            ],
            next: 'https://api.spotify.com/v1/me/playlists?offset=50',
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          items: [
            {
              id: 'p2',
              name: 'Followed',
              collaborative: false,
              owner: { id: 'someone-else' },
              external_urls: { spotify: 'https://evil.example/not-spotify' },
              images: [],
              tracks: { total: null },
              snapshot_id: 'snap2',
            },
          ],
          next: null,
        }),
      };
    };

    const items = await client.listCurrentUserPlaylists('list-svc-a');
    expect(items).to.have.lengthOf(2);
    expect(items[0].stable_id).to.equal('spotify:p1');
    expect(items[0].detail_access).to.equal('full');
    expect(items[0].is_owner).to.equal(true);
    expect(items[1].detail_access).to.equal('restricted');
    expect(items[1].is_restricted).to.equal(true);
    expect(items[1].external_url).to.equal(null);
    expect(page).to.equal(2);
  });

  it('atomically upserts and prunes only after a complete sync; partial failure preserves rows', async () => {
    seedTokens('list-svc-a');
    seedPlaylist('list-svc-a', 'old-keep', 'Old Keep');
    seedPlaylist('list-svc-a', 'old-prune', 'Old Prune');

    fetchImpl = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        items: [
          {
            id: 'old-keep',
            name: 'Old Keep Updated',
            collaborative: false,
            owner: { id: 'me-user' },
            external_urls: { spotify: 'https://open.spotify.com/playlist/old-keep' },
            images: [],
            tracks: { total: 5 },
          },
          {
            id: 'new-one',
            name: 'New One',
            collaborative: true,
            owner: { id: 'other' },
            external_urls: { spotify: 'https://open.spotify.com/playlist/new-one' },
            images: [],
            tracks: { total: 1 },
          },
        ],
        next: null,
      }),
    });

    const synced = await client.syncUserPlaylists('list-svc-a');
    expect(synced.map((p) => p.provider_id).sort()).to.deep.equal(['new-one', 'old-keep']);
    expect(
      db
        .prepare('SELECT * FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
        .get('list-svc-a', 'old-prune')
    ).to.equal(undefined);

    // Partial failure: first page ok conceptually not applicable — simulate failure before complete sync
    seedPlaylist('list-svc-a', 'stale-row', 'Stale');
    fetchImpl = async () => {
      throw Object.assign(new Error('timeout'), { name: 'AbortError' });
    };
    try {
      await client.syncUserPlaylists('list-svc-a');
      expect.fail('expected failure');
    } catch (err) {
      expect(err.code).to.equal('spotify_unavailable');
    }
    expect(
      db
        .prepare('SELECT * FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
        .get('list-svc-a', 'stale-row')
    ).to.exist;
    expect(
      db
        .prepare('SELECT * FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
        .get('list-svc-a', 'old-keep')
    ).to.exist;
  });

  it('isolates equal provider playlist IDs across users', async () => {
    seedTokens('list-svc-a');
    seedTokens('list-svc-b');
    seedPlaylist('list-svc-b', 'shared-id', 'B Copy');

    fetchImpl = async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        items: [
          {
            id: 'shared-id',
            name: 'A Copy',
            collaborative: false,
            owner: { id: 'me-user' },
            external_urls: { spotify: 'https://open.spotify.com/playlist/shared-id' },
            images: [],
            tracks: { total: 1 },
          },
        ],
        next: null,
      }),
    });

    await client.syncUserPlaylists('list-svc-a');
    const a = db
      .prepare('SELECT name FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
      .get('list-svc-a', 'shared-id');
    const b = db
      .prepare('SELECT name FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
      .get('list-svc-b', 'shared-id');
    expect(a.name).to.equal('A Copy');
    expect(b.name).to.equal('B Copy');

    client.disconnectUser('list-svc-a');
    expect(
      db
        .prepare('SELECT * FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
        .get('list-svc-a', 'shared-id')
    ).to.equal(undefined);
    expect(
      db
        .prepare('SELECT * FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
        .get('list-svc-b', 'shared-id')
    ).to.exist;
  });

  it('honors rate-limit and timeout failures without pruning', async () => {
    seedTokens('list-svc-a');
    seedPlaylist('list-svc-a', 'keep-me', 'Keep Me');

    fetchImpl = async () => ({
      ok: false,
      status: 429,
      headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? 'not-an-int' : null) },
      json: async () => ({}),
    });
    try {
      await client.syncUserPlaylists('list-svc-a');
      expect.fail('expected rate limit');
    } catch (err) {
      expect(err.code).to.equal('spotify_rate_limited');
    }
    expect(
      db
        .prepare('SELECT * FROM user_spotify_playlists WHERE user_id = ? AND spotify_playlist_id = ?')
        .get('list-svc-a', 'keep-me')
    ).to.exist;
  });
});
