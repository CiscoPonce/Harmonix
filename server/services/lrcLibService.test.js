const { expect } = require('chai');
const { plainToSynced, normalizeLyricsPayload, fetchLyricsForTrack } = require('./lrcLibService');

describe('lrcLibService', () => {
  it('builds synced lyrics from plain text', () => {
    const synced = plainToSynced('hola mundo\ncomo estas\nbien gracias', 180);
    expect(synced).to.contain('[0:00.');
    expect(synced).to.contain('hola mundo');
    expect(synced.split('\n')).to.have.lengthOf(3);
  });

  it('normalizes plain-only LRCLib payloads', () => {
    const out = normalizeLyricsPayload({
      plainLyrics: 'line one\nline two\nline three',
    }, 120);
    expect(out.syncedLyrics).to.contain('line one');
    expect(out.plainLyrics).to.contain('line one');
  });

  it('falls back to search when direct get misses', async () => {
    const mockFetch = async (url) => {
      if (url.includes('/api/get')) {
        return { status: 404, ok: false };
      }
      if (url.includes('/api/search')) {
        return {
          ok: true,
          json: async () => [{
            trackName: 'Despacito',
            artistName: 'Luis Fonsi',
            duration: 229,
            syncedLyrics: '[00:10.00] Despacito\n[00:20.00] Quiero respirar\n[00:30.00] tu cuello despacito',
            plainLyrics: 'Despacito\nQuiero respirar\n tu cuello despacito',
          }],
        };
      }
      throw new Error(`unexpected ${url}`);
    };

    const lyrics = await fetchLyricsForTrack('Luis Fonsi', 'Despacito', 229, mockFetch);
    expect(lyrics).to.not.be.null;
    expect(lyrics.syncedLyrics).to.contain('Despacito');
  });

  it('falls back to search when direct get returns 504 gateway timeout', async () => {
    let searchCalled = false;
    const mockFetch = async (url) => {
      if (url.includes('/api/get')) {
        return { status: 504, ok: false };
      }
      if (url.includes('/api/search')) {
        searchCalled = true;
        return {
          ok: true,
          json: async () => [{
            trackName: 'Dákiti',
            artistName: 'Bad Bunny',
            duration: 205,
            syncedLyrics: '[00:10.00] Dákiti\n[00:20.00] La bebé\n[00:30.00] con su amiga',
            plainLyrics: 'Dákiti\nLa bebé\ncon su amiga',
          }],
        };
      }
      throw new Error(`unexpected ${url}`);
    };

    const lyrics = await fetchLyricsForTrack('Bad Bunny', 'Dákiti', 205, mockFetch);
    expect(searchCalled).to.equal(true);
    expect(lyrics).to.not.be.null;
    expect(lyrics.syncedLyrics).to.contain('Dákiti');
  });
});
