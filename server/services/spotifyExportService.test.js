const { expect } = require('chai');
const db = require('../db');
const { encryptToken } = require('./spotifyCrypto');
const { createSpotifyExportService } = require('./spotifyExportService');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_EXPORT';

describe('spotify export service contracts', () => {
  let clock;
  let fetchImpl;
  let calls;
  let aiCalled;
  let svc;

  before(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_MATCH_CACHE_POLICY = 'ttl=7d;revalidate_on_export;delete_on_disconnect';
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
      'playlist-modify-private playlist-read-private',
      'me-user',
      'Listener',
      now,
      new Date(clock.getTime() + 3600_000).toISOString(),
      now
    );
  }

  function seedPlaylist(userId, playlistId, songs) {
    db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(playlistId);
    db.prepare('DELETE FROM playlists WHERE id = ?').run(playlistId);
    db.prepare('INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)').run(
      playlistId,
      userId,
      'Export Source'
    );
    for (const song of songs) {
      db.prepare('DELETE FROM song_cache WHERE song_id = ?').run(song.song_id);
      db.prepare(
        `INSERT INTO song_cache (song_id, track_json, cached_at) VALUES (?, ?, CURRENT_TIMESTAMP)`
      ).run(song.song_id, JSON.stringify(song.track));
      db.prepare(
        `INSERT INTO playlist_songs (id, playlist_id, song_id) VALUES (?, ?, ?)`
      ).run(`${playlistId}-${song.song_id}`, playlistId, song.song_id);
    }
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
    ensureUser('export-svc-a');
    ensureUser('export-svc-b');
    db.prepare('DELETE FROM spotify_export_jobs').run();
    db.prepare('DELETE FROM user_spotify_tokens WHERE user_id LIKE ?').run('export-svc-%');
    clock = new Date('2026-07-20T12:00:00.000Z');
    calls = [];
    aiCalled = false;
    fetchImpl = async () => {
      throw new Error('unexpected fetch');
    };

    delete require.cache[require.resolve('./spotifyService')];
    const { createSpotifyClient } = require('./spotifyService');
    const spotifyClient = createSpotifyClient({
      fetch: (...args) => fetchImpl(...args),
      now: () => new Date(clock.getTime()),
      sleep: async () => {},
    });

    svc = createSpotifyExportService({
      spotifyClient,
      now: () => new Date(clock.getTime()),
      aiProbe: { called: () => aiCalled },
    });
  });

  it('validates ownership before any Spotify create/add mutation', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: exportPlaylist ownership gate missing`);
    }
    seedTokens('export-svc-a');
    seedPlaylist('export-svc-b', 'pl-b', [
      { song_id: 's1', track: { title: 'Hello', artist: 'Adele', duration_ms: 295000 } },
    ]);
    let createCalled = false;
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/me/playlists') && !u.includes('limit=')) createCalled = true;
      return jsonResponse(201, { id: 'x' });
    };
    try {
      await svc.exportPlaylist('export-svc-a', 'pl-b');
      expect.fail('expected not_found');
    } catch (err) {
      expect(err.code).to.equal('not_found');
    }
    expect(createCalled).to.equal(false);
  });

  it('enforces mutation order: classify all → create private playlist → add in batches of ≤100', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export mutation order missing`);
    }
    seedTokens('export-svc-a');
    seedPlaylist('export-svc-a', 'pl-order', [
      { song_id: 'o1', track: { title: 'Hello', artist: 'Adele', duration_ms: 295000 } },
      { song_id: 'o2', track: { title: 'Someone Like You', artist: 'Adele', duration_ms: 285000 } },
    ]);
    const order = [];
    fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/search')) {
        order.push('search');
        const id = u.includes('Someone') ? 't2' : 't1';
        return jsonResponse(200, {
          tracks: {
            items: [
              {
                id,
                uri: `spotify:track:${id}`,
                name: id === 't2' ? 'Someone Like You' : 'Hello',
                artists: [{ name: 'Adele' }],
                duration_ms: id === 't2' ? 285000 : 295000,
                is_local: false,
                is_playable: true,
                external_ids: {},
              },
            ],
          },
        });
      }
      if (u.includes('/me/playlists') && opts.method === 'POST') {
        order.push('create');
        const body = JSON.parse(opts.body);
        expect(body.public).to.equal(false);
        return jsonResponse(201, {
          id: 'dest-1',
          external_urls: { spotify: 'https://open.spotify.com/playlist/dest-1' },
        });
      }
      if (u.includes('/playlists/dest-1/items')) {
        order.push('add');
        const body = JSON.parse(opts.body);
        expect(body.uris.length).to.be.at.most(100);
        return jsonResponse(201, { snapshot_id: 'snap' });
      }
      throw new Error(`unexpected ${u}`);
    };

    const mutationLog = [];
    const result = await svc.exportPlaylist('export-svc-a', 'pl-order', { mutationLog });
    expect(result.stage).to.equal('completed');
    expect(order.filter((x) => x === 'search').length).to.equal(2);
    expect(order.indexOf('create')).to.be.greaterThan(order.lastIndexOf('search'));
    expect(order.indexOf('add')).to.be.greaterThan(order.indexOf('create'));
    expect(mutationLog).to.deep.equal(['create', 'add']);
  });

  it('classifies every source song before create; zero matches create nothing', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: zero-match no-create path missing`);
    }
    seedTokens('export-svc-a');
    seedPlaylist('export-svc-a', 'pl-zero', [
      { song_id: 'z1', track: { title: 'Yellow', artist: 'Coldplay', duration_ms: 266000 } },
    ]);
    let createCalled = false;
    fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/search')) {
        return jsonResponse(200, {
          tracks: {
            items: [
              {
                id: 'unrelated',
                uri: 'spotify:track:unrelated',
                name: 'Yellow Submarine',
                artists: [{ name: 'The Beatles' }],
                duration_ms: 158000,
                is_local: false,
                is_playable: true,
                external_ids: {},
              },
            ],
          },
        });
      }
      if (opts.method === 'POST' && u.includes('/me/playlists')) {
        createCalled = true;
      }
      throw new Error(`unexpected ${u}`);
    };
    const result = await svc.exportPlaylist('export-svc-a', 'pl-zero');
    expect(createCalled).to.equal(false);
    expect(result.matched_count).to.equal(0);
    expect(result.partial_state).to.equal('no_create');
    expect(result.destination_provider_id).to.equal(null);
    expect(result.report.rows[0].outcome).to.equal('unmatched');
  });

  it('never searches more than ten candidates per track and returns unmatched report rows', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export match batching missing`);
    }
    seedTokens('export-svc-a');
    seedPlaylist('export-svc-a', 'pl-cap', [
      { song_id: 'c1', track: { title: 'Stay', artist: 'Artist A', duration_ms: 200000 } },
    ]);
    fetchImpl = async (url) => {
      const u = String(url);
      if (u.includes('/search')) {
        expect(u).to.match(/limit=10/);
        const items = Array.from({ length: 10 }, (_, i) => ({
          id: `stay-${i}`,
          uri: `spotify:track:stay-${i}`,
          name: 'Stay',
          artists: [{ name: 'Artist A' }],
          duration_ms: 200000,
          is_local: false,
          is_playable: true,
          external_ids: {},
        }));
        return jsonResponse(200, { tracks: { items } });
      }
      throw new Error(`unexpected ${u}`);
    };
    const result = await svc.exportPlaylist('export-svc-a', 'pl-cap');
    expect(result.report.rows[0].outcome).to.equal('unmatched');
    expect(result.report.rows[0].reason).to.equal('ambiguous_tie');
    expect(result.destination_url).to.equal(null);
  });

  it('reuses same-market song_cache matches and revalidates across markets (D-12-12)', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: same-market cache reuse missing`);
    }
    seedTokens('export-svc-a');
    seedPlaylist('export-svc-a', 'pl-cache', [
      { song_id: 'cache-1', track: { title: 'Hello', artist: 'Adele', duration_ms: 295000 } },
    ]);
    let searchCount = 0;
    fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/search')) {
        searchCount += 1;
        return jsonResponse(200, {
          tracks: {
            items: [
              {
                id: 'hello-us',
                uri: 'spotify:track:hello-us',
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
      if (u.includes('/tracks/hello-us') && u.includes('market=GB')) {
        return jsonResponse(200, {
          id: 'hello-gb',
          uri: 'spotify:track:hello-gb',
          name: 'Hello',
          artists: [{ name: 'Adele' }],
          duration_ms: 295000,
          is_local: false,
          is_playable: true,
          external_ids: {},
        });
      }
      if (u.includes('/me/playlists') && opts.method === 'POST') {
        return jsonResponse(201, {
          id: 'dest-cache',
          external_urls: { spotify: 'https://open.spotify.com/playlist/dest-cache' },
        });
      }
      if (u.includes('/items')) {
        return jsonResponse(201, { snapshot_id: 's' });
      }
      throw new Error(`unexpected ${u}`);
    };

    const first = await svc.exportPlaylist('export-svc-a', 'pl-cache', { market: 'US', force: true });
    expect(first.stage).to.equal('completed');
    expect(searchCount).to.equal(1);

    const second = await svc.exportPlaylist('export-svc-a', 'pl-cache', { market: 'US', force: true });
    expect(second.report.rows[0].outcome).to.be.oneOf(['cached', 'matched']);
    expect(searchCount).to.equal(1);

    const gb = await svc.exportPlaylist('export-svc-a', 'pl-cache', { market: 'GB', force: true });
    expect(gb.stage).to.equal('completed');
    expect(gb.report.rows[0].spotify_uri).to.equal('spotify:track:hello-gb');
  });

  it('never sends Spotify content into AI / NVIDIA NIM (no-AI boundary)', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: no-AI export boundary missing`);
    }
    seedTokens('export-svc-a');
    seedPlaylist('export-svc-a', 'pl-ai', [
      { song_id: 'ai1', track: { title: 'Hello', artist: 'Adele', duration_ms: 295000 } },
    ]);
    fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/search')) {
        return jsonResponse(200, {
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
        return jsonResponse(201, {
          id: 'd',
          external_urls: { spotify: 'https://open.spotify.com/playlist/d' },
        });
      }
      if (u.includes('/items')) return jsonResponse(201, {});
      throw new Error(u);
    };
    await svc.exportPlaylist('export-svc-a', 'pl-ai', { force: true });
    expect(aiCalled).to.equal(false);
  });

  it('chunks add-item mutations at most 100 URIs', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: 100-item batching missing`);
    }
    seedTokens('export-svc-a');
    const songs = Array.from({ length: 101 }, (_, i) => ({
      song_id: `b${i}`,
      track: { title: `Song ${i}`, artist: 'Batch Artist', duration_ms: 200000 },
    }));
    seedPlaylist('export-svc-a', 'pl-batch', songs);
    const batchSizes = [];
    fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/search')) {
        const m = /Song%20(\d+)/.exec(u) || /Song (\d+)/.exec(decodeURIComponent(u));
        const n = m ? m[1] : '0';
        return jsonResponse(200, {
          tracks: {
            items: [
              {
                id: `id-${n}`,
                uri: `spotify:track:id-${n}`,
                name: `Song ${n}`,
                artists: [{ name: 'Batch Artist' }],
                duration_ms: 200000,
                is_local: false,
                is_playable: true,
                external_ids: {},
              },
            ],
          },
        });
      }
      if (opts.method === 'POST' && u.includes('/me/playlists')) {
        return jsonResponse(201, {
          id: 'dest-batch',
          external_urls: { spotify: 'https://open.spotify.com/playlist/dest-batch' },
        });
      }
      if (u.includes('/items')) {
        const body = JSON.parse(opts.body);
        batchSizes.push(body.uris.length);
        expect(body.uris.length).to.be.at.most(100);
        return jsonResponse(201, {});
      }
      throw new Error(u);
    };
    const result = await svc.exportPlaylist('export-svc-a', 'pl-batch', { force: true });
    expect(result.exported_count).to.equal(101);
    expect(batchSizes).to.deep.equal([100, 1]);
  });

  it('stops safely on rate interruption without orphaning partial exports incorrectly', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export rate interruption handling missing`);
    }
    seedTokens('export-svc-a');
    const songs = Array.from({ length: 101 }, (_, i) => ({
      song_id: `r${i}`,
      track: { title: `Rate ${i}`, artist: 'Rate Artist', duration_ms: 200000 },
    }));
    seedPlaylist('export-svc-a', 'pl-rate', songs);
    let addCalls = 0;
    fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/search')) {
        const m = /Rate%20(\d+)/.exec(u) || /Rate (\d+)/.exec(decodeURIComponent(u));
        const n = m ? m[1] : '0';
        return jsonResponse(200, {
          tracks: {
            items: [
              {
                id: `rid-${n}`,
                uri: `spotify:track:rid-${n}`,
                name: `Rate ${n}`,
                artists: [{ name: 'Rate Artist' }],
                duration_ms: 200000,
                is_local: false,
                is_playable: true,
                external_ids: {},
              },
            ],
          },
        });
      }
      if (opts.method === 'POST' && u.includes('/me/playlists')) {
        return jsonResponse(201, {
          id: 'dest-rate',
          external_urls: { spotify: 'https://open.spotify.com/playlist/dest-rate' },
        });
      }
      if (u.includes('/items')) {
        addCalls += 1;
        if (addCalls >= 2) {
          // Persist 429 across wrapper retries so the job stops as partial.
          return jsonResponse(429, { error: { message: 'rate' } }, { 'retry-after': '1' });
        }
        return jsonResponse(201, {});
      }
      throw new Error(u);
    };
    const result = await svc.exportPlaylist('export-svc-a', 'pl-rate', { force: true });
    expect(result.stage).to.equal('partial');
    expect(result.safe_reason).to.equal('rate_limited');
    expect(result.exported_count).to.equal(100);
    expect(result.destination_url).to.equal('https://open.spotify.com/playlist/dest-rate');
    expect(result.partial_state).to.equal('partially_added');
  });

  it('distinguishes no-create, created-empty, and partially-added failure states', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: partial export state reporting missing`);
    }
    seedTokens('export-svc-a');
    seedPlaylist('export-svc-a', 'pl-pre', [
      { song_id: 'p1', track: { title: 'Hello', artist: 'Adele', duration_ms: 295000 } },
    ]);
    fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/search')) {
        return jsonResponse(200, {
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
        return jsonResponse(500, { error: { message: 'boom' } });
      }
      throw new Error(u);
    };
    const pre = await svc.exportPlaylist('export-svc-a', 'pl-pre', { force: true });
    expect(pre.partial_state).to.equal('no_create');
    expect(pre.destination_url).to.equal(null);
    expect(pre.stage).to.equal('failed');
  });

  it('pre-create failure reports no destination; post-create/add failure reports exact partial state and safe destination URL', async () => {
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: destination URL reporting missing`);
    }
    seedTokens('export-svc-a');
    seedPlaylist('export-svc-a', 'pl-post', [
      { song_id: 'q1', track: { title: 'Hello', artist: 'Adele', duration_ms: 295000 } },
    ]);
    fetchImpl = async (url, opts = {}) => {
      const u = String(url);
      if (u.includes('/search')) {
        return jsonResponse(200, {
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
        return jsonResponse(201, {
          id: 'dest-post',
          external_urls: { spotify: 'https://open.spotify.com/playlist/dest-post' },
        });
      }
      if (u.includes('/items')) {
        return jsonResponse(500, { error: { message: 'add failed' } });
      }
      throw new Error(u);
    };
    const post = await svc.exportPlaylist('export-svc-a', 'pl-post', { force: true });
    expect(post.destination_url).to.equal('https://open.spotify.com/playlist/dest-post');
    expect(post.partial_state).to.equal('created_empty');
    expect(post.stage).to.equal('partial');
    expect(post.exported_count).to.equal(0);
  });
});
