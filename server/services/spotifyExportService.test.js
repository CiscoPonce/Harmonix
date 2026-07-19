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

  it('enforces mutation order: classify all → create private playlist → add in batches of ≤100', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export mutation order missing`);
    }
    expect.fail(`${SENTINEL}: export mutation-order contract not green yet`);
  });

  it('classifies every source song before create; zero matches create nothing', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: zero-match no-create path missing`);
    }
    expect.fail(`${SENTINEL}: zero-match creates nothing contract not green yet`);
  });

  it('never searches more than ten candidates per track and returns unmatched report rows', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export match batching missing`);
    }
    expect.fail(`${SENTINEL}: export search≤10 and unmatched report not green yet`);
  });

  it('reuses same-market song_cache matches and revalidates across markets (D-12-12)', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: same-market cache reuse missing`);
    }
    expect.fail(`${SENTINEL}: cache reuse / cross-market revalidation not green yet`);
  });

  it('never sends Spotify content into AI / NVIDIA NIM (no-AI boundary)', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: no-AI export boundary missing`);
    }
    expect.fail(`${SENTINEL}: no-AI export boundary not green yet`);
  });

  it('chunks add-item mutations at most 100 URIs', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: 100-item batching missing`);
    }
    expect.fail(`${SENTINEL}: add-item ≤100 batching not green yet`);
  });

  it('stops safely on rate interruption without orphaning partial exports incorrectly', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: export rate interruption handling missing`);
    }
    expect.fail(`${SENTINEL}: export 429 interruption contract not green yet`);
  });

  it('distinguishes no-create, created-empty, and partially-added failure states', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: partial export state reporting missing`);
    }
    expect.fail(`${SENTINEL}: pre/post-create partial state contracts not green yet`);
  });

  it('pre-create failure reports no destination; post-create/add failure reports exact partial state and safe destination URL', () => {
    const svc = loadService();
    if (!svc || typeof svc.exportPlaylist !== 'function') {
      expect.fail(`${SENTINEL}: destination URL reporting missing`);
    }
    expect.fail(`${SENTINEL}: destination URL partial-failure report not green yet`);
  });
});
