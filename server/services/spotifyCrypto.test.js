const { expect } = require('chai');
const crypto = require('crypto');
const db = require('../db');

const TEST_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const PLAINTEXT_SENTINEL = 'spotify-access-token-PLAINTEXT-SENTINEL-do-not-store';

describe('spotifyCrypto', () => {
  let spotifyCrypto;

  before(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    delete require.cache[require.resolve('./spotifyCrypto')];
    spotifyCrypto = require('./spotifyCrypto');
  });

  afterEach(() => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY_VERSION = 'v1';
    delete require.cache[require.resolve('./spotifyCrypto')];
    spotifyCrypto = require('./spotifyCrypto');
  });

  it('loadEncryptionKey requires a 32-byte base64 key and fails closed when missing', () => {
    delete process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY;
    delete require.cache[require.resolve('./spotifyCrypto')];
    const mod = require('./spotifyCrypto');
    expect(() => mod.loadEncryptionKey()).to.throw(/SPOTIFY_TOKEN_ENCRYPTION_KEY/);
  });

  it('loadEncryptionKey rejects malformed keys', () => {
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = 'not-a-valid-key';
    delete require.cache[require.resolve('./spotifyCrypto')];
    const mod = require('./spotifyCrypto');
    expect(() => mod.loadEncryptionKey()).to.throw(/SPOTIFY_TOKEN_ENCRYPTION_KEY|malformed|32/);
  });

  it('encryptToken/decryptToken round-trips AES-256-GCM with unique IVs and versioned envelope', () => {
    const a = spotifyCrypto.encryptToken('token-one');
    const b = spotifyCrypto.encryptToken('token-one');
    expect(a.ciphertext).to.be.a('string').and.not.equal('token-one');
    expect(a.iv).to.be.a('string');
    expect(a.tag).to.be.a('string');
    expect(a.keyVersion).to.equal('v1');
    expect(a.iv).to.not.equal(b.iv);
    expect(a.ciphertext).to.not.equal(b.ciphertext);
    expect(spotifyCrypto.decryptToken(a)).to.equal('token-one');
    expect(spotifyCrypto.decryptToken(b)).to.equal('token-one');
  });

  it('fails closed on modified IV, ciphertext, tag, or wrong key', () => {
    const envelope = spotifyCrypto.encryptToken('secret-value');

    const badIv = { ...envelope, iv: Buffer.from(envelope.iv, 'base64') };
    badIv.iv[0] ^= 0xff;
    badIv.iv = Buffer.from(badIv.iv).toString('base64');
    expect(() => spotifyCrypto.decryptToken(badIv)).to.throw();

    const badCt = { ...envelope, ciphertext: Buffer.from(envelope.ciphertext, 'base64') };
    badCt.ciphertext[0] ^= 0xff;
    badCt.ciphertext = Buffer.from(badCt.ciphertext).toString('base64');
    expect(() => spotifyCrypto.decryptToken(badCt)).to.throw();

    const badTag = { ...envelope, tag: Buffer.from(envelope.tag, 'base64') };
    badTag.tag[0] ^= 0xff;
    badTag.tag = Buffer.from(badTag.tag).toString('base64');
    expect(() => spotifyCrypto.decryptToken(badTag)).to.throw();

    const otherKey = crypto.randomBytes(32).toString('base64');
    process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY = otherKey;
    delete require.cache[require.resolve('./spotifyCrypto')];
    const other = require('./spotifyCrypto');
    expect(() => other.decryptToken(envelope)).to.throw();
  });

  it('never persists plaintext token sentinels in user_spotify_tokens rows', () => {
    const userId = 'crypto-sentinel-user';
    db.prepare('INSERT OR IGNORE INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      userId,
      `${userId}@test.com`,
      'x'
    );
    db.prepare('DELETE FROM user_spotify_tokens WHERE user_id = ?').run(userId);

    const access = spotifyCrypto.encryptToken(PLAINTEXT_SENTINEL);
    const refresh = spotifyCrypto.encryptToken(`${PLAINTEXT_SENTINEL}-refresh`);
    db.prepare(`
      INSERT INTO user_spotify_tokens (
        user_id,
        access_ciphertext, access_iv, access_tag, access_key_version,
        refresh_ciphertext, refresh_iv, refresh_tag, refresh_key_version,
        scopes, spotify_user_id, spotify_display_name,
        authorized_at, expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', '+1 hour'), datetime('now'))
    `).run(
      userId,
      access.ciphertext, access.iv, access.tag, access.keyVersion,
      refresh.ciphertext, refresh.iv, refresh.tag, refresh.keyVersion,
      'playlist-read-private',
      'sp-user-1',
      'Display'
    );

    const row = db.prepare('SELECT * FROM user_spotify_tokens WHERE user_id = ?').get(userId);
    const serialized = JSON.stringify(row);
    expect(serialized).to.not.include(PLAINTEXT_SENTINEL);
    expect(spotifyCrypto.decryptToken({
      ciphertext: row.access_ciphertext,
      iv: row.access_iv,
      tag: row.access_tag,
      keyVersion: row.access_key_version,
    })).to.equal(PLAINTEXT_SENTINEL);

    db.prepare('DELETE FROM user_spotify_tokens WHERE user_id = ?').run(userId);
  });
});
