const { expect } = require('chai');
const deezer = require('./deezerService');

describe('deezerService', () => {
  it('previewProxyPath returns same-origin audio route', () => {
    expect(deezer.previewProxyPath(123456)).to.equal('/api/audio/preview/123456');
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
});
