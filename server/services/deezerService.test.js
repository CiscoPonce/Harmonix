const { expect } = require('chai');
const deezer = require('./deezerService');

describe('deezerService', () => {
  it('previewProxyPath returns same-origin audio route', () => {
    expect(deezer.previewProxyPath(123456)).to.equal('/api/audio/preview/123456');
    expect(deezer.previewProxyPath('itunes_1', 'Luis Fonsi', 'Despacito')).to.equal(
      '/api/audio/preview/itunes_1?artist=Luis+Fonsi&title=Despacito'
    );
    expect(deezer.previewProxyPath('itunes_1', { name: 'The Beatles' }, 'Hey Jude')).to.equal(
      '/api/audio/preview/itunes_1?artist=The+Beatles&title=Hey+Jude'
    );
    expect(deezer.artistName({ name: 'The Beatles' })).to.equal('The Beatles');
  });

  it('coverFromDeezerTrack prefers medium album art', () => {
    expect(
      deezer.coverFromDeezerTrack({
        album: {
          cover_small: 'https://e.dzcdn.net/s.jpg',
          cover_medium: 'https://e.dzcdn.net/m.jpg',
          cover_big: 'https://e.dzcdn.net/b.jpg',
        },
      })
    ).to.equal('https://e.dzcdn.net/m.jpg');
  });

  it('extractCoverFromCachedTrack reads cover field', () => {
    expect(deezer.extractCoverFromCachedTrack({ cover: 'https://x/c.jpg' })).to.equal(
      'https://x/c.jpg'
    );
    expect(
      deezer.extractCoverFromCachedTrack(JSON.stringify({ cover_medium: 'https://x/m.jpg' }))
    ).to.equal('https://x/m.jpg');
  });

  it('strips feat./ft. from artist strings', () => {
    expect(deezer.stripFeaturing('Luis Fonsi ft. Daddy Yankee')).to.equal('Luis Fonsi');
    expect(deezer.stripFeaturing('Artist (feat. Someone)')).to.equal('Artist');
  });

  it('scores strong title and artist matches higher', () => {
    const track = {
      title: 'Despacito',
      artist: { name: 'Luis Fonsi' },
      preview: 'https://cdn.example/p.mp3',
      rank: 900000,
    };
    const score = deezer.scoreTrackMatch(track, 'Luis Fonsi', 'Despacito');
    expect(score).to.be.at.least(8);
  });

  it('finds a track via fallback title-only search', async () => {
    const mockFetch = async (url) => {
      if (url.includes('Bad%20Bunny') || url.includes('Bad+Bunny')) {
        return {
          ok: true,
          json: async () => ({ data: [] }),
        };
      }
      if (url.includes('Tit')) {
        return {
          ok: true,
          json: async () => ({
            data: [{
              id: 1741494317,
              title: 'Tití Me Preguntó',
              duration: 243,
              preview: 'https://cdn.example/preview.mp3',
              rank: 975674,
              artist: { name: 'Bad Bunny' },
            }],
          }),
        };
      }
      return { ok: true, json: async () => ({ data: [] }) };
    };

    const track = await deezer.searchTrack('Bad Bunny', 'Tití Me Preguntó', mockFetch);
    expect(track).to.not.be.null;
    expect(track.id).to.equal(1741494317);
  });

  it('builds an iTunes chart URL for every learning language and style', () => {
    const storefronts = { en: 'us', es: 'es', fr: 'fr', de: 'de', pt: 'br', it: 'it' };
    const styles = { pop: 14, rock: 21, 'hip-hop': 18 };
    for (const [lang, country] of Object.entries(storefronts)) {
      for (const [style, genreId] of Object.entries(styles)) {
        expect(deezer.itunesChartUrl(lang, style)).to.equal(
          `https://itunes.apple.com/${country}/rss/topsongs/limit=100/genre=${genreId}/json`
        );
      }
      expect(deezer.itunesChartUrl(lang, 'any')).to.equal(
        `https://itunes.apple.com/${country}/rss/topsongs/limit=100/json`
      );
    }
    expect(deezer.itunesChartUrl('es', 'reggaeton')).to.equal(
      'https://itunes.apple.com/mx/rss/topsongs/limit=100/genre=12/json'
    );
  });

  it('asks several country charts for one style', () => {
    const rock = deezer.itunesChartUrls('en', 'rock');
    expect(rock).to.deep.equal([
      'https://itunes.apple.com/us/rss/topsongs/limit=100/genre=21/json',
      'https://itunes.apple.com/gb/rss/topsongs/limit=100/genre=21/json',
      'https://itunes.apple.com/au/rss/topsongs/limit=100/genre=21/json',
      'https://itunes.apple.com/ca/rss/topsongs/limit=100/genre=21/json',
    ]);
    expect(deezer.itunesChartUrls('es', 'reggaeton')).to.include(
      'https://itunes.apple.com/co/rss/topsongs/limit=100/genre=12/json'
    );
  });

  it('merges country charts and keeps each song once', async () => {
    const mockFetch = async (url) => {
      const country = String(url).split('/')[3];
      const title = country === 'gb' ? 'Fisherman\'s Blues' : 'Enter Sandman';
      const artist = country === 'gb' ? 'The Waterboys' : 'Metallica';
      return {
        ok: true,
        json: async () => ({
          feed: {
            entry: [
              { 'im:name': { label: title }, 'im:artist': { label: artist } },
              { 'im:name': { label: 'Enter Sandman' }, 'im:artist': { label: 'Metallica' } },
            ],
          },
        }),
      };
    };
    const songs = await deezer.fetchItunesChartSongs('en', 'rock', mockFetch);
    expect(songs.map((song) => song.song_title)).to.deep.equal([
      'Enter Sandman',
      'Fisherman\'s Blues',
    ]);
    expect(songs.every((song) => song.genre === 'rock')).to.equal(true);
  });

  it('reads tracks from a genre album chart when the song chart is not enough', async () => {
    expect(deezer.itunesAlbumChartUrl('en', 'rock', 100, 'us')).to.equal(
      'https://itunes.apple.com/us/rss/topalbums/limit=100/genre=21/json'
    );
    const ids = deezer.parseItunesAlbumIds({
      feed: { entry: [{ id: { attributes: { 'im:id': '99' } } }, { id: {} }] },
    });
    expect(ids).to.deep.equal(['99']);
    const tracks = deezer.parseItunesLookupTracks({
      results: [
        { wrapperType: 'collection', collectionName: 'Palace' },
        { wrapperType: 'track', kind: 'song', artistName: 'Greta Van Fleet', trackName: 'Heat Above' },
      ],
    }, 'rock');
    expect(tracks).to.deep.equal([
      { song_title: 'Heat Above', artist: 'Greta Van Fleet', genre: 'rock' },
    ]);

    const mockFetch = async (url) => {
      const href = String(url);
      if (href.includes('/rss/topalbums/')) {
        const id = href.includes('/gb/') ? '2' : '1';
        return {
          ok: true,
          json: async () => ({ feed: { entry: [{ id: { attributes: { 'im:id': id } } }] } }),
        };
      }
      expect(href).to.include('lookup?id=');
      return {
        ok: true,
        json: async () => ({
          results: [
            { wrapperType: 'track', kind: 'song', artistName: 'Greta Van Fleet', trackName: 'Heat Above' },
            { wrapperType: 'track', kind: 'song', artistName: 'Greta Van Fleet', trackName: 'Broken Bells' },
          ],
        }),
      };
    };
    const songs = await deezer.fetchItunesAlbumTracks('en', 'rock', mockFetch);
    expect(songs.map((song) => song.song_title)).to.deep.equal(['Heat Above', 'Broken Bells']);
  });

  it('parses an iTunes chart into unused-song candidates', () => {
    const songs = deezer.parseItunesChart({
      feed: {
        entry: [
          { 'im:name': { label: 'Make Me Love You' }, 'im:artist': { label: 'Nickelback' } },
          { 'im:name': { label: '' }, 'im:artist': { label: 'Nope' } },
        ],
      },
    }, 'rock');
    expect(songs).to.deep.equal([
      { song_title: 'Make Me Love You', artist: 'Nickelback', genre: 'rock' },
    ]);
  });

  it('falls back to iTunes when Deezer search fails', async () => {
    const mockFetch = async (url) => {
      if (url.includes('api.deezer.com')) {
        return { ok: false, status: 403, json: async () => ({}) };
      }
      if (url.includes('itunes.apple.com/search')) {
        return {
          ok: true,
          json: async () => ({
            results: [{
              trackId: 1447401620,
              trackName: 'Despacito',
              artistName: 'Luis Fonsi & Daddy Yankee',
              previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
              trackTimeMillis: 229387,
              artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/100x100bb.jpg',
            }],
          }),
        };
      }
      return { ok: true, json: async () => ({ results: [] }) };
    };

    const track = await deezer.searchTrack('Luis Fonsi', 'Despacito', mockFetch);
    expect(track).to.not.be.null;
    expect(track.id).to.equal('itunes_1447401620');
    expect(track.provider).to.equal('itunes');
    expect(track.preview).to.include('itunes.apple.com');
  });

  it('fetchTrack resolves itunes_ ids via lookup', async () => {
    const mockFetch = async (url) => {
      expect(url).to.include('itunes.apple.com/lookup');
      return {
        ok: true,
        json: async () => ({
          results: [{
            trackId: 99,
            trackName: 'Test',
            artistName: 'Artist',
            previewUrl: 'https://audio-ssl.itunes.apple.com/x.m4a',
            trackTimeMillis: 30000,
          }],
        }),
      };
    };
    const track = await deezer.fetchTrack('itunes_99', mockFetch);
    expect(track.id).to.equal('itunes_99');
    expect(track.preview).to.include('x.m4a');
  });

  it('searchCatalog falls back to iTunes when Deezer is blocked', async () => {
    const mockFetch = async (url) => {
      if (String(url).includes('api.deezer.com')) {
        return { ok: false, status: 403, json: async () => ({}) };
      }
      expect(url).to.include('itunes.apple.com/search');
      return {
        ok: true,
        json: async () => ({
          results: [{
            trackId: 1441164614,
            trackName: 'Hey Jude',
            artistName: 'The Beatles',
            previewUrl: 'https://audio-ssl.itunes.apple.com/hey.m4a',
            artworkUrl100: 'https://is1-ssl.mzstatic.com/100x100bb.jpg',
            trackTimeMillis: 431000,
          }],
        }),
      };
    };
    const tracks = await deezer.searchCatalog('ey jude', mockFetch);
    expect(tracks).to.have.length(1);
    expect(tracks[0].title).to.equal('Hey Jude');
    expect(tracks[0].id).to.equal('itunes_1441164614');
    expect(tracks[0].artist.name).to.equal('The Beatles');
  });
});
