const { expect } = require('chai');
const db = require('../db');

const SENTINEL = 'NOT_IMPLEMENTED_SPOTIFY_DETAIL';

function loadRouter() {
  try {
    return require('./spotify');
  } catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && /spotify/.test(err.message)) {
      return null;
    }
    throw err;
  }
}

describe('spotify playlist detail route contracts', () => {
  beforeEach(() => {
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      'detail-user-a',
      'detail-user-a@test.com',
      'x'
    );
  });

  it('GET detail requires req.user.id and scopes lookup to that user', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: playlist detail route missing`);
    }
    expect.fail(`${SENTINEL}: authenticated detail route not green yet`);
  });

  it('returns non-disclosing 404 for cross-user or unknown provider IDs', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: cross-user detail 404 missing`);
    }
    expect.fail(`${SENTINEL}: cross-user detail 404 contract not green yet`);
  });

  it('rejects SQL metacharacter provider IDs', () => {
    const router = loadRouter();
    if (!router) {
      expect.fail(`${SENTINEL}: detail parameterized ID handling missing`);
    }
    expect.fail(`${SENTINEL}: SQL metacharacter detail ID contract not green yet`);
  });
});
