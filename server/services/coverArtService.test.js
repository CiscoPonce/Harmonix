const { expect } = require('chai');
const { ensureTrackCover } = require('./coverArtService');

const noNetwork = async (url) => {
  throw new Error(`unexpected fetch: ${url}`);
};

describe('coverArtService', () => {
  describe('ensureTrackCover', () => {
    it('drops a client preview on a non-allowlisted host', async () => {
      const track = await ensureTrackCover('x', {
        cover: 'https://e-cdns-images.dzcdn.net/c.jpg',
        preview: 'https://169.254.169.254/x',
      }, noNetwork);
      expect(track).to.not.have.property('preview');
      expect(track.cover).to.equal('https://e-cdns-images.dzcdn.net/c.jpg');
    });

    it('keeps a Deezer CDN preview', async () => {
      const track = await ensureTrackCover('x', {
        cover: 'https://e-cdns-images.dzcdn.net/c.jpg',
        preview: 'https://cdnt-preview.dzcdn.net/x.mp3',
      }, noNetwork);
      expect(track.preview).to.equal('https://cdnt-preview.dzcdn.net/x.mp3');
    });
  });
});
