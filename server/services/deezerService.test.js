const { expect } = require('chai');
const deezer = require('../services/deezerService');

describe('deezerService', () => {
  it('previewProxyPath returns same-origin audio route', () => {
    expect(deezer.previewProxyPath(123456)).to.equal('/api/audio/preview/123456');
  });
});
