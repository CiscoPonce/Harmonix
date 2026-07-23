const { expect } = require('chai');
const deezer = require('./deezerService');

describe('deezerService', () => {
  it('previewProxyPath returns same-origin audio route', () => {
    expect(deezer.previewProxyPath(123456)).to.equal('/api/audio/preview/123456');
    expect(deezer.previewProxyPath('itunes_1', 'Luis Fonsi', 'Despacito')).to.equal(
      '/api/audio/preview/itunes_1?artist=Luis+Fonsi&title=Despacito'
    );
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
});
