const { expect } = require('chai');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_EXPORT';

function loadService() {
  try {
    return require('./spotifyExportService');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /spotifyExportService/.test(err.message)) {
      return null;
    }
    throw err;
  }
}

describe('spotify export service contracts', () => {
  it('validates ownership before any Spotify create/add mutation', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: exportPlaylist ownership gate missing`);
    }
    expect.fail(`${SENTINEL}: export ownership-before-mutation contract not green yet`);
  });

  it('enforces mutation order: match → create private playlist → add in batches of ≤100', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export mutation order missing`);
    }
    expect.fail(`${SENTINEL}: export mutation-order contract not green yet`);
  });

  it('never searches more than ten candidates per track and returns unmatched report rows', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export match batching missing`);
    }
    expect.fail(`${SENTINEL}: export search≤10 and unmatched report not green yet`);
  });

  it('stops safely on rate interruption without orphaning partial exports incorrectly', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export rate interruption handling missing`);
    }
    expect.fail(`${SENTINEL}: export 429 interruption contract not green yet`);
  });
});
