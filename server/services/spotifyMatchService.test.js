const { expect } = require('chai');
const db = require('../db');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_MATCH';

function loadMatcher() {
  try {
    return require('./spotifyMatchService');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /spotifyMatchService/.test(err.message)) {
      return null;
    }
    throw err;
  }
}

describe('spotifyMatchService contracts', () => {
  it('exposes pure rankCandidates and selectMatch helpers', () => {
    const matcher = loadMatcher();
    if (
      !matcher ||
      typeof matcher.rankCandidates !== 'function' ||
      typeof matcher.selectMatch !== 'function'
    ) {
      expect.fail(`${SENTINEL}: rankCandidates/selectMatch missing`);
    }
    const source = { title: 'Hello', artist: 'Adele', duration_ms: 295000 };
    const candidates = [
      {
        id: 'spotify-hello',
        uri: 'spotify:track:hello',
        name: 'Hello',
        artists: ['Adele'],
        duration_ms: 295000,
        is_local: false,
        is_playable: true,
        popularity: 1,
      },
    ];
    const ranked = matcher.rankCandidates(source, candidates, { market: 'US' });
    expect(ranked).to.be.an('array').with.lengthOf(1);
    expect(ranked[0].id).to.equal('spotify-hello');
    expect(ranked[0]).to.not.have.property('popularity');
    const selected = matcher.selectMatch(source, candidates, { market: 'US' });
    expect(selected.outcome).to.equal('accept');
    expect(selected.spotify_id).to.equal('spotify-hello');
  });

  it('matches diacritics and featured-artist equivalents without AI', () => {
    const matcher = loadMatcher();
    if (!matcher || typeof matcher.selectMatch !== 'function') {
      expect.fail(`${SENTINEL}: diacritic/featured matching missing`);
    }
    const source = {
      title: 'Despacito',
      artist: 'Luis Fonsi feat. Daddy Yankee',
      duration_ms: 228000,
    };
    const candidates = [
      {
        id: 'spotify-despacito',
        uri: 'spotify:track:6habFhsOp2NvshLv26DqMb',
        name: 'Despacito',
        artists: ['Luis Fonsi', 'Daddy Yankee'],
        duration_ms: 228093,
        is_local: false,
        is_playable: true,
        popularity: 50,
      },
      {
        id: 'spotify-despacito-remix',
        uri: 'spotify:track:despacito-remix',
        name: 'Despacito - Remix',
        artists: ['Luis Fonsi', 'Daddy Yankee', 'Justin Bieber'],
        duration_ms: 230413,
        is_local: false,
        is_playable: true,
        popularity: 99,
      },
    ];
    const result = matcher.selectMatch(source, candidates, { market: 'ES' });
    expect(result.outcome).to.equal('accept');
    expect(result.spotify_id).to.equal('spotify-despacito');
    expect(result).to.not.have.property('ai');
  });

  it('rejects ambiguous ties and never uses popularity as a tie-breaker (D-12-13)', () => {
    const matcher = loadMatcher();
    if (!matcher || typeof matcher.selectMatch !== 'function') {
      expect.fail(`${SENTINEL}: ambiguous_tie rejection missing`);
    }
    const source = {
      title: 'Stay',
      artist: 'Artist A',
      duration_ms: 200000,
    };
    const candidates = [
      {
        id: 'spotify-stay-a',
        uri: 'spotify:track:stay-a',
        name: 'Stay',
        artists: ['Artist A'],
        duration_ms: 200000,
        is_local: false,
        is_playable: true,
        popularity: 10,
      },
      {
        id: 'spotify-stay-b',
        uri: 'spotify:track:stay-b',
        name: 'Stay',
        artists: ['Artist A'],
        duration_ms: 200000,
        is_local: false,
        is_playable: true,
        popularity: 99,
      },
    ];
    const result = matcher.selectMatch(source, candidates, { market: 'US' });
    expect(result.outcome).to.equal('reject');
    expect(result.reason).to.equal('ambiguous_tie');
  });

  it('rejects edition conflicts, weak candidates, missing fields, invalid URIs, local, unavailable, and duration conflicts', () => {
    const matcher = loadMatcher();
    if (!matcher || typeof matcher.selectMatch !== 'function') {
      expect.fail(`${SENTINEL}: hard-negative rejection matrix missing`);
    }
    const cases = [
      {
        reason: 'edition_conflict',
        source: { title: 'Fix You', artist: 'Coldplay', duration_ms: 295000 },
        candidates: [
          {
            id: 'live',
            uri: 'spotify:track:live',
            name: 'Fix You - Live',
            artists: ['Coldplay'],
            duration_ms: 310000,
            is_local: false,
            is_playable: true,
            popularity: 60,
          },
        ],
      },
      {
        reason: 'weak_candidate',
        source: { title: 'Yellow', artist: 'Coldplay', duration_ms: 266000 },
        candidates: [
          {
            id: 'weak',
            uri: 'spotify:track:weak',
            name: 'Yellow Submarine',
            artists: ['The Beatles'],
            duration_ms: 158000,
            is_local: false,
            is_playable: true,
            popularity: 99,
          },
        ],
      },
      {
        reason: 'missing_artist',
        source: { title: 'Imagine', artist: '', duration_ms: 183000 },
        candidates: [
          {
            id: 'imagine',
            uri: 'spotify:track:imagine',
            name: 'Imagine',
            artists: ['John Lennon'],
            duration_ms: 183000,
            is_local: false,
            is_playable: true,
            popularity: 80,
          },
        ],
      },
      {
        reason: 'missing_title',
        source: { title: '', artist: 'Radiohead', duration_ms: 237000 },
        candidates: [
          {
            id: 'creep',
            uri: 'spotify:track:creep',
            name: 'Creep',
            artists: ['Radiohead'],
            duration_ms: 238640,
            is_local: false,
            is_playable: true,
            popularity: 80,
          },
        ],
      },
      {
        reason: 'invalid_uri',
        source: { title: 'Royals', artist: 'Lorde', duration_ms: 190000 },
        candidates: [
          {
            id: 'bad-uri',
            uri: 'https://open.spotify.com/track/royals',
            name: 'Royals',
            artists: ['Lorde'],
            duration_ms: 190185,
            is_local: false,
            is_playable: true,
            popularity: 80,
          },
        ],
      },
      {
        reason: 'local_track',
        source: { title: 'Local File Song', artist: 'Local Artist', duration_ms: 180000 },
        candidates: [
          {
            id: 'local',
            uri: 'spotify:track:local',
            name: 'Local File Song',
            artists: ['Local Artist'],
            duration_ms: 180000,
            is_local: true,
            is_playable: true,
            popularity: 0,
          },
        ],
      },
      {
        reason: 'unavailable',
        source: { title: 'Market Blocked', artist: 'Some Band', duration_ms: 200000 },
        candidates: [
          {
            id: 'unavail',
            uri: 'spotify:track:unavail',
            name: 'Market Blocked',
            artists: ['Some Band'],
            duration_ms: 200000,
            is_local: false,
            is_playable: false,
            popularity: 50,
          },
        ],
      },
      {
        reason: 'duration_conflict',
        source: { title: 'Clocks', artist: 'Coldplay', duration_ms: 307000 },
        candidates: [
          {
            id: 'short',
            uri: 'spotify:track:short',
            name: 'Clocks',
            artists: ['Coldplay'],
            duration_ms: 120000,
            is_local: false,
            is_playable: true,
            popularity: 90,
          },
        ],
      },
    ];

    for (const c of cases) {
      const result = matcher.selectMatch(c.source, c.candidates, { market: 'US' });
      expect(result.outcome, c.reason).to.equal('reject');
      expect(result.reason, c.reason).to.equal(c.reason);
    }
  });

  it('never ranks more than ten candidates per source track', () => {
    const matcher = loadMatcher();
    if (!matcher || typeof matcher.rankCandidates !== 'function') {
      expect.fail(`${SENTINEL}: ten-candidate cap missing`);
    }
    const source = { title: 'Hello', artist: 'Adele', duration_ms: 295000 };
    const candidates = Array.from({ length: 15 }, (_, i) => ({
      id: `c${i}`,
      uri: `spotify:track:c${i}`,
      name: 'Hello',
      artists: ['Adele'],
      duration_ms: 295000,
      is_local: false,
      is_playable: true,
      popularity: i,
    }));
    const ranked = matcher.rankCandidates(source, candidates, { market: 'US' });
    expect(ranked).to.have.lengthOf.at.most(10);
  });

  it('reuses same-market unexpired cache and revalidates across US→GB / GB→US markets (D-12-12)', async () => {
    const matcher = loadMatcher();
    if (!matcher || typeof matcher.resolveSpotifyMatch !== 'function') {
      expect.fail(`${SENTINEL}: resolveSpotifyMatch cache path missing`);
    }

    const songId = 'match-cache-song-1';
    db.prepare('DELETE FROM song_cache WHERE song_id = ?').run(songId);
    db.prepare(
      `INSERT INTO song_cache (song_id, track_json, cached_at) VALUES (?, '{}', CURRENT_TIMESTAMP)`
    ).run(songId);

    const source = {
      song_id: songId,
      identity: `harmonix:${songId}`,
      title: 'Midnight City',
      artist: 'M83',
      duration_ms: 243000,
    };

    let searchCalls = 0;
    let trackCalls = [];
    const client = {
      searchTracks: async () => {
        searchCalls += 1;
        return [
          {
            id: 'track-us',
            uri: 'spotify:track:track-us',
            name: 'Midnight City',
            artists: [{ name: 'M83' }],
            duration_ms: 243000,
            is_local: false,
            is_playable: true,
            external_ids: {},
          },
        ];
      },
      spotifyRequest: async (_userId, path) => {
        trackCalls.push(path);
        if (String(path).includes('market=GB')) {
          return {
            id: 'track-gb-relink',
            uri: 'spotify:track:track-gb-relink',
            name: 'Midnight City',
            artists: [{ name: 'M83' }],
            duration_ms: 243000,
            is_local: false,
            is_playable: true,
            linked_from: { id: 'track-us', uri: 'spotify:track:track-us' },
            external_ids: {},
          };
        }
        if (String(path).includes('market=US')) {
          return {
            id: 'track-us',
            uri: 'spotify:track:track-us',
            name: 'Midnight City',
            artists: [{ name: 'M83' }],
            duration_ms: 243000,
            is_local: false,
            is_playable: true,
            external_ids: {},
          };
        }
        throw new Error(`unexpected path ${path}`);
      },
    };

    const first = await matcher.resolveSpotifyMatch('user-a', source, {
      market: 'US',
      spotifyClient: client,
      now: () => new Date('2026-07-20T12:00:00.000Z'),
    });
    expect(first.outcome).to.equal('accept');
    expect(first.spotify_uri).to.equal('spotify:track:track-us');
    expect(searchCalls).to.equal(1);

    const cached = await matcher.resolveSpotifyMatch('user-a', source, {
      market: 'US',
      spotifyClient: client,
      now: () => new Date('2026-07-21T12:00:00.000Z'),
    });
    expect(cached.from_cache).to.equal(true);
    expect(cached.spotify_uri).to.equal('spotify:track:track-us');
    expect(searchCalls).to.equal(1);

    const gb = await matcher.resolveSpotifyMatch('user-a', source, {
      market: 'GB',
      spotifyClient: client,
      now: () => new Date('2026-07-21T12:00:00.000Z'),
    });
    expect(gb.outcome).to.equal('accept');
    expect(gb.revalidated).to.equal(true);
    expect(gb.spotify_uri).to.equal('spotify:track:track-gb-relink');
    expect(trackCalls.some((p) => String(p).includes('market=GB'))).to.equal(true);
    expect(searchCalls).to.equal(1);

    const backUs = await matcher.resolveSpotifyMatch('user-a', source, {
      market: 'US',
      spotifyClient: client,
      now: () => new Date('2026-07-21T13:00:00.000Z'),
    });
    expect(backUs.outcome).to.equal('accept');
    expect(backUs.spotify_uri).to.equal('spotify:track:track-us');

    matcher.clearSpotifyMatchEvidence(songId);
    const cleared = matcher.readCachedEvidence(songId);
    expect(cleared.spotify_uri).to.equal(null);
  });
});
