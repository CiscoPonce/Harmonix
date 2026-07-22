'use strict';

const { expect } = require('chai');
const {
  spotifyUriToWebUrl,
  spotifySearchUrl,
  sanitizePostcardInput,
} = require('./share');

describe('share postcard helpers', () => {
  it('maps spotify track URIs to open.spotify.com URLs', () => {
    expect(spotifyUriToWebUrl('spotify:track:abc123XYZ')).to.equal(
      'https://open.spotify.com/track/abc123XYZ'
    );
    expect(spotifyUriToWebUrl('not-a-uri')).to.equal(null);
  });

  it('builds a Spotify search URL fallback', () => {
    expect(spotifySearchUrl('Coldplay', 'Yellow')).to.equal(
      `https://open.spotify.com/search/${encodeURIComponent('Coldplay Yellow')}`
    );
  });

  it('requires word + song fields', () => {
    expect(() => sanitizePostcardInput({})).to.throw(/word\.text/);
    expect(() =>
      sanitizePostcardInput({ word: { text: 'hola' }, song: { title: 'X' } })
    ).to.throw(/song\.title/);
  });

  it('sanitizes a valid postcard body', () => {
    const card = sanitizePostcardInput({
      word: { text: '  hola ', translation: 'hello' },
      lyric: { snippet: 'hola mundo', char_start: 0, char_end: 4 },
      song: { id: '1', title: 'Song', artist: 'Artist' },
    });
    expect(card.word.text).to.equal('hola');
    expect(card.lyric.snippet).to.equal('hola mundo');
    expect(card.song.artist).to.equal('Artist');
  });
});
